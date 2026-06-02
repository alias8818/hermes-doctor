/**
 * Helpers for building copy-paste shell snippets from untrusted Hermes home data.
 * All user-controlled fragments must pass through these before embedding in fix.command,
 * rollback, or manualSteps.
 */

const IDENTIFIER_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
const ENV_VAR_RE = /^[A-Z_][A-Z0-9_]*$/;

/** POSIX single-quote escaping for safe shell arguments. */
export function shellQuote(arg: string): string {
  if (arg === "") return "''";
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/** Provider / plugin / MCP server names from config. */
export function safeIdentifier(name: string, fallback = "invalid-name"): string {
  const trimmed = name.trim();
  if (IDENTIFIER_RE.test(trimmed)) return trimmed;
  return fallback;
}

/** Environment variable names referenced in fixes. */
export function safeEnvVar(name: string, fallback = "API_KEY"): string {
  const trimmed = name.trim().toUpperCase();
  if (ENV_VAR_RE.test(trimmed)) return trimmed;
  return fallback;
}

/** File or directory paths from the scanned home. */
export function safePath(path: string): string {
  return shellQuote(path);
}

/** Join env var names for export hints (each validated). */
export function safeEnvVarList(names: string[]): string {
  const safe = names.map((n) => safeEnvVar(n));
  return safe.length > 0 ? safe.join(" ") : "API_KEY";
}

/** Build `export VAR=value` with quoted identifiers. */
export function exportEnvCommand(envVar: string, placeholder = "your-key-here"): string {
  return `export ${safeEnvVar(envVar)}=${shellQuote(placeholder)}`;
}

/** npm install package spec (name or name@version). */
export function safeNpmSpec(name: string, version?: string | null): string {
  const spec = version ? `${name}@${version}` : name;
  return shellQuote(spec);
}

/** chmod mode (e.g. 755, 644). */
export function safeFileMode(mode: string, fallback = "644"): string {
  const trimmed = mode.trim();
  return /^[0-7]{3,4}$/.test(trimmed) ? trimmed : fallback;
}
