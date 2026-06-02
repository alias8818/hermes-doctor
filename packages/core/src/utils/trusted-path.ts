import * as os from "node:os";

/**
 * Standard system directories for resolving probe binaries (docker, git, hermes).
 * Avoids executing attacker-controlled executables from a hostile PATH (e.g. CI checkout).
 */
export function trustedPathDirectories(platform: string = os.platform()): string[] {
  if (platform === "win32") {
    const root = process.env.SystemRoot ?? "C:\\Windows";
    return [`${root}\\System32`, `${root}\\SysWOW64`];
  }
  const dirs = ["/usr/local/bin", "/usr/bin", "/bin"];
  if (platform === "darwin") {
    dirs.unshift("/opt/homebrew/bin");
  }
  return dirs;
}

/**
 * Environment with PATH that prefers trusted system directories but preserves
 * existing PATH entries.  Trusted directories are prepended so that system
 * commands (`docker`, `git`, …) are resolved first (preventing attacker-controlled
 * overrides), while user-installed tools (`hermes`, …) are still discoverable
 * from the original PATH.
 */
export function envForTrustedProbes(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const delim = os.platform() === "win32" ? ";" : ":";
  const existing = env.PATH ?? "";
  const existingEntries = existing.length > 0 ? existing.split(delim) : [];
  const allDirs = [...trustedPathDirectories(os.platform()), ...existingEntries];
  return {
    ...env,
    PATH: [...new Set(allDirs)].join(delim),
  };
}
