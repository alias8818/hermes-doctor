import type { HermesSnapshot } from "../schemas/snapshot.js";
import { exportEnvCommand, safeIdentifier } from "../utils/shell-safe.js";
import { evidence, finding, fix, type Check } from "./types.js";

/**
 * Check: Default model configured.
 * VAL-PROV-001: Default model configured
 */
export const defaultModelCheck: Check = {
  id: "providers-default-model",
  area: "providers",
  title: "Default Model",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const prov = snapshot.providers;
    const ev: Array<ReturnType<typeof evidence>> = [];

    const modelsConfigured = prov.modelsConfigured ?? 0;
    ev.push(evidence("models_configured", String(modelsConfigured), "config"));

    if (prov.defaultModel) {
      ev.push(evidence("default_model", prov.defaultModel, "config"));
      return [
        finding(
          "providers-default-model",
          "providers",
          "ok",
          0,
          "Default Model Configured",
          `Default model: ${prov.defaultModel}`,
          ev,
        ),
      ];
    }

    if (modelsConfigured > 0) {
      return [
        finding(
          "providers-default-model",
          "providers",
          "warning",
          1,
          "No Default Model Selected",
          `${modelsConfigured} model(s) configured but none is set as default`,
          ev,
          [
            fix("Set a default model in config.yaml", {
              command: "providers:\n  default_model: claude-sonnet",
              risk: "low",
            }),
          ],
        ),
      ];
    }

    return [
      finding(
        "providers-default-model",
        "providers",
        "warning",
          2,
        "No Models Configured",
        "No models are configured in the providers section",
        ev,
        [
          fix("Add a provider", {
            command: "See documentation for configuring providers in config.yaml",
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Provider environment variables set.
 * VAL-PROV-002: Provider environment variables set
 */
export const providerEnvVarsCheck: Check = {
  id: "providers-env-vars",
  area: "providers",
  title: "Provider Environment Variables",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const prov = snapshot.providers;
    const providerEntries = prov.providers ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("providers", JSON.stringify(
        providerEntries.map((p) => ({
          name: p.name,
          required_env: p.requiredEnv ?? [],
          env_set: p.envSet ?? false,
        })),
      ), "config"),
    ];

    if (providerEntries.length === 0) {
      return [
        finding(
          "providers-env-vars",
          "providers",
          "info",
          0,
          "No Providers Configured",
          "No providers are configured",
          ev,
        ),
      ];
    }

    const missingKeys = providerEntries.filter((p) => !p.envSet);

    if (missingKeys.length === 0) {
      return [
        finding(
          "providers-env-vars",
          "providers",
          "ok",
          0,
          "Provider Environment Variables Set",
          `All ${providerEntries.length} provider(s) have required environment variables`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "providers-env-vars",
        "providers",
        "broken",
        3,
        "Missing Provider Environment Variables",
        `${missingKeys.length} provider(s) missing required environment variables: ${missingKeys.map((p) => p.name).join(", ")}`,
        ev,
        missingKeys.map((p) => {
          const envVars = p.requiredEnv?.length
            ? p.requiredEnv
            : [`${safeIdentifier(p.name)}_API_KEY`];
          const exportCmd = envVars.map((v) => exportEnvCommand(v)).join("\n");
          return fix(`Set ${safeIdentifier(p.name)} environment variables`, {
            command: exportCmd,
            description: `Add ${envVars.join(", ")} to your shell profile or .env file`,
            risk: "low",
          });
        }),
      ),
    ];
  },
};

/**
 * Check: Local endpoint health.
 * VAL-PROV-003: Local endpoint health
 */
export const localEndpointCheck: Check = {
  id: "providers-local-endpoints",
  area: "providers",
  title: "Local Provider Endpoints",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const prov = snapshot.providers;
    const endpoints = prov.localEndpoints ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("local_endpoints", JSON.stringify(endpoints), "dashboard-api"),
    ];

    if (endpoints.length === 0) {
      return [
        finding(
          "providers-local-endpoints",
          "providers",
          "info",
          0,
          "No Local Provider Endpoints",
          "No local provider endpoints are configured",
          ev,
        ),
      ];
    }

    const unreachableEndpoints = endpoints.filter((e) => !e.reachable);

    if (unreachableEndpoints.length === 0) {
      return [
        finding(
          "providers-local-endpoints",
          "providers",
          "ok",
          0,
          "Local Endpoints Reachable",
          `All ${endpoints.length} local endpoint(s) are reachable`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "providers-local-endpoints",
        "providers",
        "broken",
        3,
        "Local Endpoints Unreachable",
        `${unreachableEndpoints.length} local endpoint(s) are not reachable: ${unreachableEndpoints.map((e) => e.url).join(", ")}`,
        ev,
        [
          fix("Start local provider service", {
            command: "systemctl start ollama || ollama serve",
            description: "Check provider documentation for local setup",
            risk: "medium",
            requiresConfirmation: true,
            manualSteps: [
              "Run: systemctl start ollama || ollama serve",
              "Verify the service is running with: systemctl status ollama",
            ],
            rollback: "systemctl stop ollama || pkill ollama",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: API key format validated.
 * VAL-PROV-004: API key format validated
 */
export const apiKeyFormatCheck: Check = {
  id: "providers-key-format",
  area: "providers",
  title: "API Key Format Validation",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const prov = snapshot.providers;
    const keyChecks = prov.keyChecks ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("key_checks", JSON.stringify(
        keyChecks.map((k) => ({
          provider: k.provider,
          format_ok: k.formatOk,
        })),
      ), "config"),
    ];

    if (keyChecks.length === 0) {
      return [
        finding(
          "providers-key-format",
          "providers",
          "info",
          0,
          "No API Key Format Checks",
          "No API keys to validate format for",
          ev,
        ),
      ];
    }

    const malformed = keyChecks.filter((k) => !k.formatOk);

    if (malformed.length === 0) {
      return [
        finding(
          "providers-key-format",
          "providers",
          "ok",
          0,
          "API Key Formats Valid",
          `All ${keyChecks.length} API key(s) have valid format`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "providers-key-format",
        "providers",
        "warning",
          1,
        "Malformed API Keys Detected",
        `${malformed.length} API key(s) have unexpected format: ${malformed.map((k) => k.provider).join(", ")}`,
        ev,
        malformed.map((k) =>
          fix(`Verify ${k.provider} API key`, {
            command: `echo ${JSON.stringify(`Check if your ${safeIdentifier(k.provider)} API key has the correct format and prefix`)}`,
            risk: "low",
          }),
        ),
      ),
    ];
  },
};

/**
 * Check: Custom provider base_url must be set.
 * VAL-PROV-HARD-001: Custom provider missing base_url
 */
export const customBaseUrlCheck: Check = {
  id: "providers-custom-base-url",
  area: "providers",
  title: "Custom Provider Base URL",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const prov = snapshot.providers;
    const customProviders = prov.customProviders ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("custom_providers", JSON.stringify(
        customProviders.map((p) => ({
          name: p.name,
          base_url: p.baseUrl,
          is_built_in: p.isBuiltIn,
        })),
      ), "config"),
    ];

    if (customProviders.length === 0) {
      return [
        finding(
          "providers-custom-base-url",
          "providers",
          "info",
          0,
          "No Custom Providers",
          "No custom (non-built-in) providers are configured",
          ev,
        ),
      ];
    }

    const missingBaseUrl = customProviders.filter(
      (p) => !p.baseUrl || p.baseUrl.trim() === "",
    );

    if (missingBaseUrl.length === 0) {
      return [
        finding(
          "providers-custom-base-url",
          "providers",
          "ok",
          0,
          "Custom Providers Configured Correctly",
          `All ${customProviders.length} custom provider(s) have base_url configured`,
          ev,
        ),
      ];
    }

    const providerNames = missingBaseUrl.map((p) => p.name).join(", ");
    return [
      finding(
        "providers-custom-base-url",
        "providers",
        "broken",
        3,
        "Custom Provider Missing Base URL",
        `${missingBaseUrl.length} custom provider(s) missing base_url: ${providerNames}. Custom providers require a base_url to specify the API endpoint.`,
        ev,
        missingBaseUrl.map((p) =>
          fix(`Add base_url for ${p.name}`, {
            command: `# Add to config.yaml:\nproviders:\n  ${safeIdentifier(p.name)}:\n    base_url: https://api.example.com/v1`,
            description: `Set the base_url for ${p.name} in your config.yaml to point to the provider's API endpoint`,
            risk: "low",
          }),
        ),
      ),
    ];
  },
};

/**
 * Check: auth.json active_provider status.
 *
 * NOTE: auth.json active_provider is for dashboard web UI authentication — NOT for model providers.
 * These are separate subsystems in Hermes. We report the auth.json state without cross-referencing
 * with config.yaml model providers.
 */
export const authConflictCheck: Check = {
  id: "providers-auth-conflict",
  area: "providers",
  title: "Auth Provider Configuration",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const prov = snapshot.providers;
    const ev: Array<ReturnType<typeof evidence>> = [];

    if (!prov.authInfo || !prov.authInfo.activeProvider) {
      return [
        finding(
          "providers-auth-conflict",
          "providers",
          "info",
          0,
          "No Auth Provider Configuration",
          "No auth.json active_provider is configured",
          ev,
        ),
      ];
    }

    const activeProvider = prov.authInfo.activeProvider;
    ev.push(evidence("auth_active_provider", activeProvider, "config"));

    // auth.json active_provider is for dashboard web UI authentication,
    // not for model providers. Just report the configured state.
    return [
      finding(
        "providers-auth-conflict",
        "providers",
        "info",
        0,
        "Auth Provider Configured",
        `auth.json active_provider is set to "${activeProvider}" (used for dashboard web UI authentication)`,
        ev,
      ),
    ];
  },
};

/**
 * Check: Orphaned model references.
 * VAL-PROV-HARD-003: Model references pointing to non-existent providers
 */
export const orphanedModelsCheck: Check = {
  id: "providers-orphaned-models",
  area: "providers",
  title: "Orphaned Model References",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const prov = snapshot.providers;
    const modelRefs = prov.modelReferences ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("model_references", JSON.stringify(
        modelRefs.map((r) => ({
          model_name: r.modelName,
          provider_ref: r.providerRef,
          provider_exists: r.providerExists,
          is_default: r.isDefault,
        })),
      ), "config"),
    ];

    // Filter models that have an explicit provider ref but the provider doesn't exist
    const orphaned = modelRefs.filter(
      (r) => r.providerRef !== null && r.providerRef !== undefined && r.providerExists === false,
    );

    if (orphaned.length === 0) {
      // If there are model references at all, report ok
      if (modelRefs.length > 0) {
        return [
          finding(
            "providers-orphaned-models",
            "providers",
            "ok",
            0,
            "Model References Valid",
            `All ${modelRefs.length} model reference(s) point to valid providers`,
            ev,
          ),
        ];
      }
      return [
        finding(
          "providers-orphaned-models",
          "providers",
          "info",
          0,
          "No Model References",
          "No model-to-provider references to validate",
          ev,
        ),
      ];
    }

    const orphanedDetails = orphaned
      .map((r) => `${r.modelName} → ${r.providerRef}`)
      .join("; ");

    return [
      finding(
        "providers-orphaned-models",
        "providers",
        "broken",
        3,
        "Orphaned Model References",
        `${orphaned.length} model reference(s) point to non-existent provider(s): ${orphanedDetails}. Add the missing provider section(s) or correct the model's provider field.`,
        ev,
        orphaned.map((r) =>
          fix(`Add provider "${r.providerRef}" for model "${r.modelName}"`, {
            command: `# Add to config.yaml:\nproviders:\n  ${safeIdentifier(r.providerRef ?? "provider")}:\n    api_key_env: ${safeIdentifier(r.providerRef ?? "provider").toUpperCase()}_API_KEY\n    base_url: https://api.example.com/v1`,
            description: `Either add a provider section "${r.providerRef}" to config.yaml, or change the model "${r.modelName}" to reference an existing provider`,
            risk: "low",
          }),
        ),
      ),
    ];
  },
};

/** All providers checks */
export const providersChecks: Check[] = [
  defaultModelCheck,
  providerEnvVarsCheck,
  localEndpointCheck,
  apiKeyFormatCheck,
  customBaseUrlCheck,
  authConflictCheck,
  orphanedModelsCheck,
];
