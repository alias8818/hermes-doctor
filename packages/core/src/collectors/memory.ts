import * as path from "node:path";

import { REDACTION_PATTERNS } from "../redaction/index.js";
import type { CollectorResult } from "../schemas/collector.js";
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  loadHermesConfig,
  pick,
  resolveSubpath,
} from "../utils/config.js";
import { listDir, readTextFile, statSafe } from "../utils/fs.js";
import type { CollectorContext } from "./context.js";
import type { MemoryData } from "./data.js";
import { addEvidence, finalize, newAccumulator, runArea } from "./result.js";

const EMPTY: MemoryData = {};
const MEMORY_PROVIDER_NAMES = ["memory-provider", "memory_provider", "memoryprovider", "pinecone", "chroma", "weaviate", "qdrant", "milvus"];

type MemorySecret = NonNullable<MemoryData["secrets"]>[number];

function findMemorySecrets(content: string, file: string): MemorySecret[] {
  const secrets: MemorySecret[] = [];
  for (const { type, regex } of REDACTION_PATTERNS) {
    const matcher = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(content)) !== null) {
      secrets.push({ file, secretType: type });
      if (match.index === matcher.lastIndex) matcher.lastIndex += 1;
    }
  }
  return secrets;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export async function collectMemory(ctx: CollectorContext): Promise<CollectorResult<MemoryData>> {
  return runArea("memory", EMPTY, ctx.redaction, async () => {
    const acc = newAccumulator();
    const config = await loadHermesConfig(ctx.paths.config);
    if (config.parsed === null && config.exists) {
      acc.warnings.push(
        `memory configuration cannot be read due to YAML parse error: ${config.error ?? "unknown error"}`,
      );
    }
    const section = asRecord(pick(config.parsed, "memory"));

    const configuredDir = asString(pick(section, "dir", "path", "directory"));
    let memoryDir: string;
    if (configuredDir) {
      const resolved = resolveSubpath(ctx.paths.home, configuredDir);
      if (resolved !== null) {
        memoryDir = resolved;
      } else {
        memoryDir = ctx.paths.memoryDir;
        acc.warnings.push(
          `configured memory.dir "${configuredDir}" is outside hermes home; falling back to default: ${ctx.paths.memoryDir}`,
        );
      }
    } else {
      memoryDir = ctx.paths.memoryDir;
    }

    const limitMb = asNumber(pick(section, "limit_mb", "limitMb", "max_mb"));
    const limitBytesDirect = asNumber(pick(section, "limit_bytes", "limitBytes"));
    const limitBytes = limitBytesDirect ?? (limitMb !== null ? limitMb * 1024 * 1024 : null);
    const memoryProvider = asString(pick(section, "provider"));
    const external = asRecord(pick(section, "external"));
    const externalProvider = asString(pick(external, "provider")) ?? asString(pick(section, "external_provider")) ?? memoryProvider;

    const extProviderField = asString(pick(external, "provider"));
    const extProviderFlat = asString(pick(section, "external_provider"));
    let hasDuplicateProviders: boolean | null = null;
    let duplicateProviderNames: string[] | null = null;
    if (extProviderField !== null && extProviderFlat !== null && extProviderField !== extProviderFlat) {
      hasDuplicateProviders = true;
      duplicateProviderNames = [extProviderField, extProviderFlat];
      acc.warnings.push(`duplicate memory provider config: "${extProviderField}" (memory.external.provider) and "${extProviderFlat}" (memory.external_provider)`);
    }

    let misplacedConfig: boolean | null = null;
    let misplacedConfigDetails: string | null = null;
    const pluginsSection = asArray(pick(config.parsed, "plugins"));
    if (pluginsSection) {
      const memoryPluginsInPlugins: string[] = [];
      for (const plugin of pluginsSection) {
        if (plugin && typeof plugin === "object") {
          const pluginName = asString(pick(plugin as Record<string, unknown>, "name"));
          if (pluginName && MEMORY_PROVIDER_NAMES.includes(pluginName.toLowerCase())) {
            memoryPluginsInPlugins.push(pluginName);
          }
        }
      }
      if (memoryPluginsInPlugins.length > 0) {
        misplacedConfig = true;
        misplacedConfigDetails = `Memory provider(s) "${memoryPluginsInPlugins.join(", ")}" found under 'plugins:' section — should be under 'memory:' section`;
        acc.warnings.push(misplacedConfigDetails);
      }
    }

    addEvidence(acc, "Memory dir", memoryDir, "config.yaml");

    const dirStat = await statSafe(memoryDir);
    const dirExists = dirStat !== null && dirStat.isDirectory();

    let readable = true;
    const entries = await listDir(memoryDir);
    if (entries === null) {
      readable = false;
      if (dirExists) {
        acc.warnings.push(`memory directory not readable (permission denied): ${memoryDir}`);
      } else {
        acc.warnings.push(`memory directory does not exist: ${memoryDir}`);
      }
      const data: MemoryData = {
        memoryDir, fileCount: 0, readable, dirExists, files: [], totalSizeBytes: 0, limitBytes, usagePercent: null,
        externalProvider: externalProvider ?? null, externalOk: null, misplacedConfig, misplacedConfigDetails,
        hasDuplicateProviders, duplicateProviderNames,
      };
      return finalize("memory", "partial", data, acc, ctx.redaction);
    }

    const files: NonNullable<MemoryData["files"]> = [];
    const allSecrets: MemorySecret[] = [];
    let totalSizeBytes = 0;
    for (const entry of entries) {
      if (!entry.isFile) continue;
      const filePath = path.join(memoryDir, entry.name);
      const stat = await statSafe(filePath);
      const sizeBytes = stat?.size ?? 0;
      totalSizeBytes += sizeBytes;
      files.push({ name: entry.name, sizeBytes, large: sizeBytes > ctx.thresholds.largeFileBytes });
      if (sizeBytes <= ctx.thresholds.largeFileBytes * 4) {
        const read = await readTextFile(filePath);
        if (read.ok && read.content) {
          const fileSecrets = findMemorySecrets(read.content, entry.name);
          allSecrets.push(...fileSecrets);
        }
      }
    }

    if (allSecrets.length > 0) {
      acc.warnings.push(`${allSecrets.length} potential secret(s) detected in memory files`);
    }

    const sessionLogFiles = files.filter((f) => { const l = f.name.toLowerCase(); return l.includes("session") || l.includes("context") || f.name.endsWith(".log") || l.includes("history") || f.name.endsWith(".txt"); });
    const hugeFiles = sessionLogFiles.filter((f) => f.sizeBytes > ctx.thresholds.hugeFileBytes);
    if (hugeFiles.length > 0) {
      addEvidence(acc, "Huge files", hugeFiles.map((f) => `${f.name} (${formatSize(f.sizeBytes)})`).join(", "));
    }

    const usagePercent = limitBytes && limitBytes > 0 ? Math.round((totalSizeBytes / limitBytes) * 1000) / 10 : null;
    addEvidence(acc, "Files", `${files.length} file(s), ${totalSizeBytes} bytes total`);

    const data: MemoryData = {
      memoryDir, fileCount: files.length, readable, dirExists, files, totalSizeBytes, limitBytes, usagePercent,
      externalProvider: externalProvider ?? null, externalOk: null,
      secrets: allSecrets.length > 0 ? allSecrets : undefined,
      misplacedConfig, misplacedConfigDetails, hasDuplicateProviders, duplicateProviderNames,
    };

    return finalize("memory", "collected", data, acc, ctx.redaction);
  });
}
