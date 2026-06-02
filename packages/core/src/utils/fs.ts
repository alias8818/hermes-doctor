import * as fs from "node:fs/promises";
import type { Stats } from "node:fs";

export interface ReadResult {
  ok: boolean;
  content: string | null;
  error: string | null;
  sizeBytes: number;
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function statSafe(target: string): Promise<Stats | null> {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}

export async function readTextFile(target: string): Promise<ReadResult> {
  try {
    const content = await fs.readFile(target, "utf8");
    return {
      ok: true,
      content,
      error: null,
      sizeBytes: Buffer.byteLength(content, "utf8"),
    };
  } catch (error) {
    return {
      ok: false,
      content: null,
      error: errorMessage(error),
      sizeBytes: 0,
    };
  }
}

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export async function listDir(target: string): Promise<DirEntry[] | null> {
  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch {
    return null;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
