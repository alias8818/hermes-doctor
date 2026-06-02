import * as os from "node:os";
import * as path from "node:path";

import { pathExists } from "./fs.js";
import { getPlatformInfo } from "./platform.js";

export async function findExecutable(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  if (name.includes("/") || name.includes("\\")) {
    return (await pathExists(name)) ? path.resolve(name) : null;
  }

  const dirs = getPlatformInfo(env).path;
  const extensions =
    os.platform() === "win32"
      ? [".cmd", ".exe", ".bat", ".com", ""]
      : [""];

  for (const dir of dirs) {
    for (const ext of extensions) {
      const candidate = path.join(dir, name + ext);
      if (await pathExists(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

export function executableFromCommand(command: string): string | null {
  const trimmed = command.trim();
  if (trimmed.length === 0) return null;
  const match = trimmed.match(/^("[^"]+"|'[^']+'|\S+)/);
  if (!match) return null;
  const token = match[1];
  if (token === undefined) return null;
  return token.replace(/^["']|["']$/g, "");
}
