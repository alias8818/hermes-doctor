import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export async function makeHermesHome(
  files: Record<string, string> = {},
): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hermes-doctor-test-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf8");
  }
  return dir;
}

export async function chmod(target: string, mode: number): Promise<void> {
  await fs.chmod(target, mode);
}

export async function cleanup(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}
