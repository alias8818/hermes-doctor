import { parse as parseYaml } from "yaml";

import { readTextFile } from "./fs.js";

export interface LoadedConfig {
  path: string;
  exists: boolean;
  raw: string | null;
  parsed: Record<string, unknown> | null;
  valid: boolean;
  error: string | null;
}

export async function loadHermesConfig(
  configPath: string,
): Promise<LoadedConfig> {
  const read = await readTextFile(configPath);
  if (!read.ok || read.content === null) {
    return {
      path: configPath,
      exists: false,
      raw: null,
      parsed: null,
      valid: false,
      error: read.error,
    };
  }

  try {
    const parsed = parseYaml(read.content) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        path: configPath,
        exists: true,
        raw: read.content,
        parsed: parsed as Record<string, unknown>,
        valid: true,
        error: null,
      };
    }
    return {
      path: configPath,
      exists: true,
      raw: read.content,
      parsed: null,
      valid: false,
      error: "config root is not a mapping",
    };
  } catch (error) {
    return {
      path: configPath,
      exists: true,
      raw: read.content,
      parsed: null,
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ")
      ? line.slice("export ".length)
      : line;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) continue;
    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key.length > 0) result[key] = value;
  }
  return result;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function pick(
  record: Record<string, unknown> | null,
  ...keys: string[]
): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (key in record && record[key] !== undefined) {
      return record[key];
    }
  }
  return undefined;
}
