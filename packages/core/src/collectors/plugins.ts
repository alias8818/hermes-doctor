import * as path from "node:path";

import type { CollectorResult } from "../schemas/collector.js";
import {
  asArray,
  asBoolean,
  asRecord,
  asString,
  loadHermesConfig,
  pick,
} from "../utils/config.js";
import { listDir, readTextFile, statSafe } from "../utils/fs.js";
import type { CollectorContext } from "./context.js";
import type { PluginsData } from "./data.js";
import { addEvidence, finalize, newAccumulator, runArea } from "./result.js";

const EMPTY: PluginsData = {};
const MANIFEST_NAMES = ["plugin.json", "manifest.json", "package.json"];

type PluginEntry = NonNullable<PluginsData["plugins"]>[number];

/** Known hook lifecycle phase keys in Hermes config */
const HOOK_PHASES = [
  "pre_tool_call",
  "post_tool_call",
  "on_session_start",
  "on_session_end",
  "pre_command",
  "post_command",
  "on_system_prompt",
];

function configPlugins(
  parsed: Record<string, unknown> | null,
): Map<string, { enabled: boolean | null; path: string | null }> {
  const map = new Map<string, { enabled: boolean | null; path: string | null }>();
  const list = asArray(pick(parsed, "plugins"));
  if (list) {
    for (const item of list) {
      const name = asString(item);
      if (name) {
        map.set(name, { enabled: true, path: null });
        continue;
      }
      const record = asRecord(item);
      const recordName = asString(pick(record, "name", "id"));
      if (recordName) {
        map.set(recordName, {
          enabled: asBoolean(pick(record, "enabled")) ?? true,
          path: asString(pick(record, "path")),
        });
      }
    }
    return map;
  }
  const recordMap = asRecord(pick(parsed, "plugins"));
  if (recordMap) {
    // Hermes v24 format: plugins is an object with "enabled" and "disabled" arrays
    // e.g. plugins: { enabled: ["disk-cleanup"], disabled: ["browser/browser_use"] }
    const enabledList = asArray(pick(recordMap, "enabled"));
    const disabledList = asArray(pick(recordMap, "disabled"));
    if (enabledList || disabledList) {
      for (const name of enabledList ?? []) {
        const strName = asString(name);
        if (strName) map.set(strName, { enabled: true, path: null });
      }
      for (const name of disabledList ?? []) {
        const strName = asString(name);
        if (strName) map.set(strName, { enabled: false, path: null });
      }
      return map;
    }
    // Fallback: treat as record-of-records (legacy format)
    for (const [name, value] of Object.entries(recordMap)) {
      const record = asRecord(value);
      map.set(name, {
        enabled: asBoolean(pick(record, "enabled")) ?? true,
        path: asString(pick(record, "path")),
      });
    }
  }
  return map;
}

/**
 * Detect hooks defined in the hooks: section of Hermes config.
 * In Hermes v24, shell hooks are configured under `hooks:` (not `plugins:`).
 */
function detectHooks(
  parsed: Record<string, unknown> | null,
): { hasHooks: boolean; hookCount: number; phases: string[]; unknownPhases: string[] } {
  const hooksSection = asRecord(pick(parsed, "hooks"));
  if (!hooksSection) return { hasHooks: false, hookCount: 0, phases: [], unknownPhases: [] };

  const phases: string[] = [];
  const unknownPhases: string[] = [];
  let hookCount = 0;

  // Track which known phases we've seen
  for (const phase of HOOK_PHASES) {
    const hooks = asArray(pick(hooksSection, phase));
    if (hooks && hooks.length > 0) {
      phases.push(phase);
      hookCount += hooks.length;
    }
  }

  // Detect any unknown phase names in the hooks section
  for (const key of Object.keys(hooksSection)) {
    if (!HOOK_PHASES.includes(key)) {
      unknownPhases.push(key);
    }
  }

  return { hasHooks: hookCount > 0, hookCount, phases, unknownPhases };
}

async function findManifest(
  dir: string,
): Promise<{ path: string; raw: string } | null> {
  for (const name of MANIFEST_NAMES) {
    const candidate = path.join(dir, name);
    const read = await readTextFile(candidate);
    if (read.ok && read.content !== null) {
      return { path: candidate, raw: read.content };
    }
  }
  return null;
}

function parseManifest(raw: string): {
  parsed: Record<string, unknown> | null;
  error: string | null;
} {
  try {
    return { parsed: asRecord(JSON.parse(raw)), error: null };
  } catch (error) {
    return {
      parsed: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readDependencies(
  manifest: Record<string, unknown>,
): PluginEntry["dependencies"] {
  const deps = asRecord(pick(manifest, "dependencies"));
  if (!deps) return [];
  return Object.entries(deps).map(([name, version]) => ({
    name,
    version: asString(version),
    resolved: false,
  }));
}

function requiresHermes(
  manifest: Record<string, unknown>,
): string | null {
  const engines = asRecord(pick(manifest, "engines"));
  return (
    asString(pick(engines, "hermes")) ??
    asString(pick(manifest, "requiresHermes", "hermes", "hermesVersion"))
  );
}

export async function collectPlugins(
  ctx: CollectorContext,
): Promise<CollectorResult<PluginsData>> {
  return runArea("plugins", EMPTY, ctx.redaction, async () => {
    const acc = newAccumulator();
    const config = await loadHermesConfig(ctx.paths.config);
    const fromConfig = configPlugins(config.parsed);

    // Detect hooks from the hooks: section (Hermes v24)
    const hooks = detectHooks(config.parsed);
    if (hooks.hasHooks) {
      addEvidence(
        acc,
        "Hooks (Hermes v24)",
        `${hooks.hookCount} hook(s) configured in phases: ${hooks.phases.join(", ")}`,
        "config",
      );
      acc.warnings.push(
        `Hermes v24 uses 'hooks:' section for shell hooks (${hooks.hookCount} hook(s) detected in 'hooks:' config)`,
      );
    }

    const dirEntries = await listDir(ctx.paths.pluginsDir);
    const dirNames = (dirEntries ?? [])
      .filter((entry) => entry.isDirectory)
      .map((entry) => entry.name);

    const names = new Set<string>([...fromConfig.keys(), ...dirNames]);

    if (names.size === 0) {
      acc.warnings.push("no plugins configured or installed");
      return finalize("plugins", "skipped", { plugins: [], hooks }, acc, ctx.redaction);
    }

    const plugins: PluginEntry[] = [];
    for (const name of names) {
      const configEntry = fromConfig.get(name);
      const pluginDir =
        configEntry?.path && path.isAbsolute(configEntry.path)
          ? configEntry.path
          : configEntry?.path
            ? path.join(ctx.paths.home, configEntry.path)
            : path.join(ctx.paths.pluginsDir, name);

      const exists = (await statSafe(pluginDir)) !== null;
      const manifest = await findManifest(pluginDir);

      const entry: PluginEntry = {
        name,
        path: pluginDir,
        exists,
        enabled: configEntry?.enabled ?? undefined,
        manifestFound: manifest !== null,
        manifestValid: false,
        parseError: null,
        dependencies: [],
        requiresHermes: null,
        compatible: null,
      };

      if (manifest) {
        const { parsed, error } = parseManifest(manifest.raw);
        entry.manifestValid = parsed !== null;
        entry.parseError = error;
        if (parsed) {
          entry.dependencies = readDependencies(parsed);
          entry.requiresHermes = requiresHermes(parsed);
        }
      } else if (exists) {
        acc.warnings.push(`plugin ${name} has no manifest`);
      } else {
        acc.warnings.push(`plugin ${name} directory missing`);
      }

      plugins.push(entry);
      addEvidence(
        acc,
        `Plugin: ${name}`,
        exists ? pluginDir : "configured but not installed",
      );
    }

    return finalize("plugins", "collected", { plugins, hooks }, acc, ctx.redaction);
  });
}
