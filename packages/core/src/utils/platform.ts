import * as os from "node:os";

export interface PlatformInfo {
  os: string;
  arch: string;
  nodeVersion: string;
  shell: string | null;
  path: string[];
}

export function getPlatformInfo(
  env: NodeJS.ProcessEnv = process.env,
): PlatformInfo {
  const pathVar = env.PATH ?? env.Path ?? "";
  const entries = pathVar.length > 0 ? pathVar.split(pathDelimiter()) : [];
  return {
    os: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    shell: env.SHELL ?? env.ComSpec ?? null,
    path: entries.filter((entry) => entry.length > 0),
  };
}

function pathDelimiter(): string {
  return os.platform() === "win32" ? ";" : ":";
}
