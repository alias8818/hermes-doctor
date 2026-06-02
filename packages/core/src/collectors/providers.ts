import type { CollectorResult } from "../schemas/collector.js";
import {
  asArray,
  asRecord,
  asString,
  loadHermesConfig,
  parseEnvFile,
  pick,
} from "../utils/config.js";
import { readTextFile, pathExists } from "../utils/fs.js";
import type { CollectorContext } from "./context.js";
import type { ProviderData } from "./data.js";
import { isLocalhostUrl, probeHttp } from "./probe.js";
import { addEvidence, finalize, newAccumulator, runArea } from "./result.js";

const EMPTY: ProviderData = {};

interface KnownProvider {
  name: string;
  defaultEnv: string;
  keyPrefix?: string;
}

/**
 * All built-in Hermes provider backends (v24).
 * These are recognized backends that ship with Hermes — they have well-known
 * default endpoints and are exempt from the custom-base-url check.
 * Sorted alphabetically for readability.
 */
const KNOWN_PROVIDERS: KnownProvider[] = [
  { name: "anthropic", defaultEnv: "ANTHROPIC_API_KEY", keyPrefix: "sk-ant-" },
  { name: "arcee", defaultEnv: "ARCEE_API_KEY" },
  { name: "auto", defaultEnv: "" },
  { name: "azure-foundry", defaultEnv: "AZURE_FOUNDRY_API_KEY" },
  { name: "cohere", defaultEnv: "COHERE_API_KEY" },
  { name: "copilot", defaultEnv: "GITHUB_TOKEN" },
  { name: "custom", defaultEnv: "" },
  { name: "gemini", defaultEnv: "GEMINI_API_KEY" },
  { name: "google", defaultEnv: "GOOGLE_API_KEY" },
  { name: "groq", defaultEnv: "GROQ_API_KEY", keyPrefix: "gsk_" },
  { name: "huggingface", defaultEnv: "HF_API_KEY" },
  { name: "kilocode", defaultEnv: "KILOCODE_API_KEY" },
  { name: "kimi-coding", defaultEnv: "KIMI_API_KEY" },
  { name: "llamacpp", defaultEnv: "" },
  { name: "lmstudio", defaultEnv: "" },
  { name: "minimax", defaultEnv: "MINIMAX_API_KEY" },
  { name: "minimax-cn", defaultEnv: "MINIMAX_API_KEY" },
  { name: "mistral", defaultEnv: "MISTRAL_API_KEY" },
  { name: "nous", defaultEnv: "NOUS_API_KEY" },
  { name: "nous-api", defaultEnv: "NOUS_API_KEY" },
  { name: "nvidia", defaultEnv: "NVIDIA_API_KEY" },
  { name: "ollama", defaultEnv: "" },
  { name: "ollama-cloud", defaultEnv: "OLLAMA_CLOUD_API_KEY" },
  { name: "openai", defaultEnv: "OPENAI_API_KEY", keyPrefix: "sk-" },
  { name: "openai-codex", defaultEnv: "OPENAI_API_KEY" },
  { name: "openrouter", defaultEnv: "OPENROUTER_API_KEY" },
  { name: "vllm", defaultEnv: "" },
  { name: "xiaomi", defaultEnv: "XIAOMI_API_KEY" },
  { name: "zai", defaultEnv: "ZAI_API_KEY" },
];

const BUILT_IN_PROVIDER_NAMES = new Set(KNOWN_PROVIDERS.map((p) => p.name));

function providersSection(
  parsed: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!parsed) return null;
  return asRecord(parsed.providers);
}

/**
 * Read nested model config: model.default, model.provider
 * Hermes v24 uses `model:` as a top-level mapping with `default` and `provider` keys.
 * Falls back to legacy flat `default_model` and providers section `default_model`.
 */
function readModelConfig(
  parsed: Record<string, unknown> | null,
  providersSection: Record<string, unknown> | null,
): { defaultModel: string | null; activeProviderBackend: string | null } {
  if (!parsed) return { defaultModel: null, activeProviderBackend: null };

  const modelSection = asRecord(parsed.model);
  const defaultModel =
    asString(modelSection?.default) ??
    asString(modelSection?.model) ??
    asString(pick(parsed, "default_model")) ??
    asString(pick(providersSection, "default_model", "defaultModel", "model"));

  const activeProviderBackend = asString(modelSection?.provider) ?? null;

  return { defaultModel, activeProviderBackend };
}

/**
 * Read custom_providers from top-level array (Hermes v24).
 * Each entry has name, base_url, api_key, models (map of model name → config).
 */
function readCustomProvidersArray(
  parsed: Record<string, unknown> | null,
): Array<{ name: string; baseUrl: string | null; models: string[] }> {
  if (!parsed) return [];
  const raw = asArray(parsed.custom_providers);
  if (!raw) return [];

  const result: Array<{ name: string; baseUrl: string | null; models: string[] }> = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    if (!record) continue;
    const name = asString(record.name);
    if (!name) continue;
    const baseUrl = asString(pick(record, "base_url", "baseUrl", "url")) ?? null;
    const modelMap = asRecord(record.models);
    const models = modelMap ? Object.keys(modelMap) : [];
    result.push({ name, baseUrl, models });
  }
  return result;
}

/**
 * Read model_aliases from top-level map (Hermes v24).
 * Map of alias → "provider_name/model_name"
 */
function readModelAliases(
  parsed: Record<string, unknown> | null,
): Record<string, string> | null {
  if (!parsed) return null;
  const raw = parsed.model_aliases;
  const record = asRecord(raw);
  if (!record) return null;
  const aliases: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    const v = asString(value);
    if (v) aliases[key] = v;
  }
  return Object.keys(aliases).length > 0 ? aliases : null;
}

export async function collectProviders(
  ctx: CollectorContext,
): Promise<CollectorResult<ProviderData>> {
  return runArea("providers", EMPTY, ctx.redaction, async () => {
    const acc = newAccumulator();
    const config = await loadHermesConfig(ctx.paths.config);
    const section = providersSection(config.parsed);

    if (!section && !config.parsed && !config.exists) {
      acc.warnings.push("no provider configuration found");
      return finalize("providers", "skipped", EMPTY, acc, ctx.redaction);
    }

    const env = await mergedEnv(ctx);

    // -----------------------------------------------------------------------
    // 1. Read model config (v24 nested or legacy flat)
    // -----------------------------------------------------------------------
    const { defaultModel, activeProviderBackend } = readModelConfig(config.parsed, section);
    if (defaultModel) {
      addEvidence(acc, "Default model", defaultModel, "config");
    }
    if (activeProviderBackend) {
      addEvidence(acc, "Active provider backend", activeProviderBackend, "config");
    }

    // -----------------------------------------------------------------------
    // 2. Read custom_providers from top-level array (Hermes v24)
    // -----------------------------------------------------------------------
    const customProvidersFromArray = readCustomProvidersArray(config.parsed);
    for (const cp of customProvidersFromArray) {
      addEvidence(
        acc,
        `Custom Provider: ${cp.name}`,
        cp.baseUrl ? `base_url: ${cp.baseUrl} (${cp.models.length} models)` : "no base_url set",
        "config.yaml",
      );
    }

    // -----------------------------------------------------------------------
    // 3. Read model_aliases (Hermes v24)
    // -----------------------------------------------------------------------
    const modelAliases = readModelAliases(config.parsed);
    if (modelAliases) {
      addEvidence(acc, "Model aliases", `${Object.keys(modelAliases).length} aliases`, "config");
    }

    // -----------------------------------------------------------------------
    // 4. Enumerate configured providers
    //    - KNOWN_PROVIDERS: check providers section for overrides
    //    - custom_providers array entries
    //    - non-built-in keys in providers section (legacy format)
    // -----------------------------------------------------------------------
    const providers: NonNullable<ProviderData["providers"]> = [];
    const keyChecks: NonNullable<ProviderData["keyChecks"]> = [];
    const localEndpoints: NonNullable<ProviderData["localEndpoints"]> = [];
    const customProviders: NonNullable<ProviderData["customProviders"]> = [];

    // Track all provider names for model→provider mapping
    const allProviderNames = new Set<string>();
    for (const name of BUILT_IN_PROVIDER_NAMES) allProviderNames.add(name);

    // Add custom_providers array names to all provider names
    const customArrayNames = new Set(customProvidersFromArray.map((cp) => cp.name));
    for (const name of customArrayNames) {
      allProviderNames.add(name);
    }

    // Read known providers from providers section (timeout overrides, key configs)
    for (const known of KNOWN_PROVIDERS) {
      const entry = asRecord(pick(section, known.name));
      const configured = entry !== null;
      if (!configured && !env[known.defaultEnv]) continue;

      const requiredEnvVar =
        asString(pick(entry, "api_key_env", "apiKeyEnv", "key_env")) ??
        known.defaultEnv;
      const requiredEnv = requiredEnvVar ? [requiredEnvVar] : [];
      const envSet = requiredEnv.length === 0 || Boolean(env[requiredEnvVar]);

      providers.push({ name: known.name, requiredEnv, envSet });
      addEvidence(
        acc,
        `Provider: ${known.name}`,
        envSet ? "API key present" : "API key missing",
        "config.yaml",
      );

      if (requiredEnvVar && env[requiredEnvVar]) {
        const value = env[requiredEnvVar] ?? "";
        const formatOk = known.keyPrefix
          ? value.startsWith(known.keyPrefix)
          : value.length > 0;
        keyChecks.push({ provider: known.name, formatOk });
      }

      const baseUrl = asString(pick(entry, "base_url", "baseUrl", "url", "host"));
      if (baseUrl && isLocalhostUrl(baseUrl)) {
        const probe = await probeHttp(baseUrl, ctx.dashboardTimeoutMs);
        localEndpoints.push({
          url: baseUrl,
          reachable: probe.reachable,
          latencyMs: probe.latencyMs,
        });
      }
    }

    // Enumerate custom providers from providers section (legacy format: non-built-in keys)
    if (section) {
      for (const [key, value] of Object.entries(section)) {
        if (["default_model", "defaultModel", "model", "modelsConfigured", "models"].includes(key)) continue;
        if (BUILT_IN_PROVIDER_NAMES.has(key)) continue;
        if (customArrayNames.has(key)) continue; // already captured from custom_providers array
        if (typeof value !== "object" || value === null) continue;

        const entry = asRecord(value);
        if (!entry) continue;

        const baseUrl = asString(pick(entry, "base_url", "baseUrl", "url", "host"));
        customProviders.push({
          name: key,
          baseUrl: baseUrl ?? null,
          isBuiltIn: false,
        });
        allProviderNames.add(key);
        addEvidence(
          acc,
          `Custom Provider: ${key}`,
          baseUrl ? `base_url: ${baseUrl}` : "no base_url set",
          "config.yaml",
        );
      }
    }

    // Also emit custom_providers array entries as custom providers
    for (const cp of customProvidersFromArray) {
      // Skip if already added from providers section
      if (customProviders.some((p) => p.name === cp.name)) continue;
      customProviders.push({
        name: cp.name,
        baseUrl: cp.baseUrl,
        isBuiltIn: false,
      });
    }

    // -----------------------------------------------------------------------
    // 5. Parse model→provider references
    //    Sources: custom_providers[].models keys, models top-level array (legacy)
    // -----------------------------------------------------------------------
    const modelReferences: NonNullable<ProviderData["modelReferences"]> = [];

    // From custom_providers array: each model is implicitly provided by its parent custom provider
    for (const cp of customProvidersFromArray) {
      for (const modelName of cp.models) {
        modelReferences.push({
          modelName,
          providerRef: cp.name,
          providerExists: true,
          isDefault: defaultModel === modelName || undefined,
        });
      }
    }

    // From model_aliases: each alias has a provider
    if (modelAliases) {
      for (const [aliasName, aliasValue] of Object.entries(modelAliases)) {
        // Format: "provider_name/model_name" or "provider:model"
        const slashIdx = aliasValue.indexOf("/");
        const colonIdx = aliasValue.indexOf(":");
        const sepIdx = slashIdx >= 0 ? (colonIdx >= 0 ? Math.min(slashIdx, colonIdx) : slashIdx) : colonIdx;
        const aliasProvider = sepIdx >= 0 ? aliasValue.slice(0, sepIdx) : null;
        const aliasModel = sepIdx >= 0 ? aliasValue.slice(sepIdx + 1) : aliasValue;
        const providerExists = aliasProvider ? allProviderNames.has(aliasProvider) : undefined;

        // Only add if model_aliases aren't already covered by custom_providers models
        if (!modelReferences.some((r) => r.modelName === aliasModel || r.modelName === aliasName)) {
          modelReferences.push({
            modelName: aliasName,
            providerRef: aliasProvider,
            providerExists: providerExists ?? undefined,
            isDefault: defaultModel === aliasName || defaultModel === aliasModel || undefined,
          });
        }
      }
    }

    // From legacy `models` top-level array
    const modelsList = asArray(pick(config.parsed, "models"));
    if (modelsList) {
      for (const model of modelsList) {
        if (typeof model !== "object" || model === null) continue;
        const modelEntry = asRecord(model);
        if (!modelEntry) continue;
        const modelName = asString(pick(modelEntry, "name", "model")) ?? asString(modelEntry["name"]);
        if (!modelName) continue;

        // Skip if already captured from custom_providers or model_aliases
        if (modelReferences.some((r) => r.modelName === modelName)) continue;

        const providerRef = asString(pick(modelEntry, "provider", "model_provider"));
        const providerExists = providerRef ? allProviderNames.has(providerRef) : undefined;

        modelReferences.push({
          modelName,
          providerRef: providerRef ?? null,
          providerExists,
          isDefault: defaultModel === modelName || undefined,
        });
      }
    }

    // -----------------------------------------------------------------------
    // 6. Parse auth.json (web UI authentication, separate from model providers)
    // -----------------------------------------------------------------------
    let authInfo: ProviderData["authInfo"] = null;
    const authExists = await pathExists(ctx.paths.authFile);
    if (authExists) {
      const authRead = await readTextFile(ctx.paths.authFile);
      if (authRead.ok && authRead.content) {
        try {
          const authParsed = JSON.parse(authRead.content) as Record<string, unknown>;
          const activeProvider = asString(authParsed.active_provider) ?? null;
          const hasSecrets = Object.keys(authParsed).some(
            (k) => k !== "active_provider" && k !== "version",
          );
          authInfo = {
            activeProvider,
            hasSecrets: hasSecrets || undefined,
          };
          if (activeProvider) {
            addEvidence(acc, "auth.json active_provider", activeProvider, "auth.json");
          }
        } catch {
          acc.warnings.push("auth.json is malformed JSON");
        }
      }
    }

    // -----------------------------------------------------------------------
    // 7. Count models
    // -----------------------------------------------------------------------
    const modelsConfigured = countModels(config.parsed, section, customProvidersFromArray, providers.length);

    // -----------------------------------------------------------------------
    // 8. Build data
    // -----------------------------------------------------------------------
    const data: ProviderData = {
      defaultModel: defaultModel ?? null,
      activeProviderBackend,
      modelAliases: modelAliases ?? undefined,
      modelsConfigured,
      providers,
      localEndpoints,
      keyChecks,
      customProviders,
      modelReferences,
      authInfo,
    };

    const hasAnyProviders = providers.length > 0 || customProviders.length > 0;
    const status = hasAnyProviders ? "collected" : "partial";
    if (!hasAnyProviders) {
      acc.warnings.push("no providers detected");
    }

    return finalize("providers", status, data, acc, ctx.redaction);
  });
}

function countModels(
  parsed: Record<string, unknown> | null,
  section: Record<string, unknown> | null,
  customProvidersFromArray: Array<{ name: string; models: string[] }>,
  providerCount: number,
): number {
  // Count models from custom_providers array
  const arrayModelCount = customProvidersFromArray.reduce((sum, cp) => sum + cp.models.length, 0);
  if (arrayModelCount > 0) return arrayModelCount;

  // Fall back to legacy models list
  const modelsList =
    asArray(pick(parsed, "models"));
  if (modelsList) return modelsList.length;

  // Fall back to models in providers section
  const sectionModels = asArray(pick(section, "models"));
  if (sectionModels) return sectionModels.length;

  return providerCount;
}

async function mergedEnv(
  ctx: CollectorContext,
): Promise<NodeJS.ProcessEnv> {
  const merged: NodeJS.ProcessEnv = { ...ctx.env };
  const envRead = await readTextFile(ctx.paths.envFile);
  if (envRead.ok && envRead.content) {
    const fromFile = parseEnvFile(envRead.content);
    for (const [key, value] of Object.entries(fromFile)) {
      if (merged[key] === undefined) merged[key] = value;
    }
  }
  return merged;
}
