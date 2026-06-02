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

/** Environment with PATH restricted to {@link trustedPathDirectories}. */
export function envForTrustedProbes(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const delim = os.platform() === "win32" ? ";" : ":";
  return {
    ...env,
    PATH: trustedPathDirectories(os.platform()).join(delim),
  };
}
