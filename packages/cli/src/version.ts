import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

export const VERSION = (
  JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string }
).version;
