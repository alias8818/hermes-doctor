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
    const buf = await fs.readFile(target);
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      content = new TextDecoder("latin1").decode(buf);
    }
    return {
      ok: true,
      content,
      error: null,
      sizeBytes: buf.length,
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

export async function isBinaryFile(filePath: string, sampleSize: number = 4096): Promise<boolean> {
  try {
    const buf = Buffer.alloc(sampleSize);
    const fd = await fs.open(filePath, "r");
    try {
      const { bytesRead } = await fd.read(buf, 0, sampleSize, 0);
      const sample = buf.subarray(0, bytesRead);
      if (sample.includes(0)) return true;
      let nonPrintable = 0;
      for (let i = 0; i < sample.length; i++) {
        const byte = sample[i];
        if (byte !== null && byte !== undefined && (byte < 0x09 || (byte > 0x0D && byte < 0x20))) {
          nonPrintable++;
        }
      }
      return sample.length > 0 && nonPrintable / sample.length > 0.3;
    } finally {
      await fd.close();
    }
  } catch {
    return false;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
