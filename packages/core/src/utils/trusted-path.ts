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
 * Environment with PATH restricted to trusted directories only.
 *
 * Prevents execution of attacker-controlled binaries from a hostile PATH
 * (e.g. CI checkout directories, untrusted workspaces). The caller can
 * provide additional trusted directories (such as the Hermes home bin/)
 * which are prepended before the standard system directories.
 */
export function envForTrustedProbes(
  env: NodeJS.ProcessEnv = process.env,
  extraTrustedDirs: string[] = [],
): NodeJS.ProcessEnv {
  const delim = os.platform() === "win32" ? ";" : ":";
  const dirs = [...extraTrustedDirs, ...trustedPathDirectories(os.platform())];
  return {
    ...env,
    PATH: dirs.join(delim),
  };
}
