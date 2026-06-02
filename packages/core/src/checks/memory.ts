import type { HermesSnapshot } from "../schemas/snapshot.js";
import { safeIdentifier, safePath } from "../utils/shell-safe.js";
import { evidence, finding, fix, type Check } from "./types.js";

function memoryDir(mem: { memoryDir?: string | null }): string {
  return mem.memoryDir ?? "~/.hermes/memory";
}

/**
 * Check: Memory files exist and are readable.
 */
export const memoryFilesCheck: Check = {
  id: "memory-files-exist",
  area: "memory",
  title: "Memory Files",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mem = snapshot.memory;
    const fileCount = mem.fileCount ?? 0;
    const readable = mem.readable ?? false;
    const dirExists = mem.dirExists ?? false;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("memory_dir", mem.memoryDir ?? "(not configured)", "file"),
      evidence("file_count", String(fileCount), "file"),
      evidence("readable", String(readable), "file"),
      evidence("dir_exists", String(dirExists), "file"),
    ];

    // Unreadable directory that exists AND has files configured = broken
    if (!readable && dirExists) {
      return [
        finding(
          "memory-files-exist",
          "memory",
          "broken",
          3,
          "Memory Directory Not Readable",
          `Memory directory ${mem.memoryDir ?? "~/.hermes/memory"} exists but cannot be read — check permissions`,
          ev,
          [
            fix("Fix memory directory permissions", {
              command: `chmod 755 ${safePath(memoryDir(mem))}`,
              description: "Ensure the directory is readable",
              risk: "medium",
              requiresConfirmation: true,
              manualSteps: [
                `Run: chmod 755 ${mem.memoryDir ?? "~/.hermes/memory"}`,
              ],
              rollback: "chmod 700 <directory> to restore restricted permissions",
            }),
            fix("Fix memory file permissions", {
              command: `chmod 644 ${safePath(memoryDir(mem))}/*`,
              description: "Ensure memory files are readable by the current user",
              risk: "medium",
              requiresConfirmation: true,
              manualSteps: [
                `Run: chmod 644 ${mem.memoryDir ?? "~/.hermes/memory"}/*`,
              ],
              rollback: "chmod 600 <files> to restore restricted permissions",
            }),
          ],
        ),
      ];
    }

    // Unreadable & directory doesn't exist = fresh install / nothing there
    if (!readable && !dirExists) {
      return [
        finding(
          "memory-files-exist",
          "memory",
          "info",
          0,
          "No Memory Directory",
          "Memory directory does not exist yet. Memory files will be created as you use Hermes.",
          ev,
        ),
      ];
    }

    if (fileCount > 0) {
      return [
        finding(
          "memory-files-exist",
          "memory",
          "ok",
          0,
          "Memory Files Exist",
          `${fileCount} memory file(s) found (total: ${formatSize(mem.totalSizeBytes ?? 0)})`,
          ev,
        ),
      ];
    }

    // Readable but empty directory
    return [
      finding(
        "memory-files-exist",
        "memory",
        "info",
        0,
        "No Memory Files",
        "Memory directory exists but no memory files found. Memory will be created as you use Hermes.",
        ev,
      ),
    ];
  },
};

/**
 * Check: Memory file sizes reported.
 */
export const memoryFileSizesCheck: Check = {
  id: "memory-file-sizes",
  area: "memory",
  title: "Memory File Sizes",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mem = snapshot.memory;
    const files = mem.files ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("files", JSON.stringify(
        files.map((f) => ({
          name: f.name,
          size_bytes: f.sizeBytes,
          large: f.large,
        })),
      ), "file"),
    ];

    if (files.length === 0) {
      return [
        finding(
          "memory-file-sizes",
          "memory",
          "info",
          0,
          "No Memory Files to Size",
          "No memory files found",
          ev,
        ),
      ];
    }

    const largeFiles = files.filter((f) => f.large);

    if (largeFiles.length > 0) {
      return [
        finding(
          "memory-file-sizes",
          "memory",
          "warning",
          1,
          "Large Memory Files Detected",
          `${largeFiles.length} memory file(s) exceed size threshold: ${largeFiles.map((f) => `${f.name} (${formatSize(f.sizeBytes)})`).join(", ")}`,
          ev,
          [
            fix("Review large memory files", {
              command: `ls -lh ${safePath(memoryDir(mem))}`,
              description: "Consider archiving or trimming large memory files",
              risk: "low",
            }),
          ],
        ),
      ];
    }

    return [
      finding(
        "memory-file-sizes",
        "memory",
        "ok",
        0,
        "Memory File Sizes Normal",
        `All ${files.length} memory file(s) are within normal size range`,
        ev,
      ),
    ];
  },
};

/**
 * Check: Near-limit warnings raised.
 */
export const memoryLimitCheck: Check = {
  id: "memory-limit",
  area: "memory",
  title: "Memory Usage Limit",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mem = snapshot.memory;
    const totalSize = mem.totalSizeBytes ?? 0;
    const limit = mem.limitBytes;
    const usagePercent = mem.usagePercent;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("total_size_bytes", String(totalSize), "file"),
      evidence("limit_bytes", limit !== null && limit !== undefined ? String(limit) : "(not set)", "config"),
      evidence("usage_percent", usagePercent !== null && usagePercent !== undefined ? `${usagePercent.toFixed(1)}%` : "(unknown)", "derived"),
    ];

    if (limit === null || limit === undefined) {
      return [
        finding(
          "memory-limit",
          "memory",
          "info",
          0,
          "No Memory Limit Configured",
          `Current memory usage: ${formatSize(totalSize)} (no limit set)`,
          ev,
          [
            fix("Set a memory limit", {
              command: "Add 'memory:\n  limit_mb: 100' to config.yaml",
              description: "This helps prevent unbounded memory growth",
              risk: "low",
            }),
          ],
        ),
      ];
    }

    if (usagePercent !== null && usagePercent !== undefined && usagePercent >= 100) {
      return [
        finding(
          "memory-limit",
          "memory",
          "warning",
          2,
          "Memory Limit Exceeded",
          `Memory usage (${formatSize(totalSize)}) exceeds limit (${formatSize(limit)}) — ${usagePercent.toFixed(1)}%`,
          ev,
          [
            fix("Free up memory or increase limit", {
              command: `Truncate or remove large files in ${safePath(memoryDir(mem))}`,
              description: "Clean up old memory files or increase limit_mb in config.yaml",
              risk: "medium",
              requiresConfirmation: true,
              manualSteps: [
                `List files: ls -lh ${mem.memoryDir ?? "~/.hermes/memory/"}`,
                "Remove or truncate old/unneeded memory files",
                "Or increase limit_mb in config.yaml memory section",
              ],
              rollback: "Restore files from backup if removed",
            }),
          ],
        ),
      ];
    }

    if (usagePercent !== null && usagePercent !== undefined && usagePercent >= 80) {
      return [
        finding(
          "memory-limit",
          "memory",
          "warning",
          2,
          "Memory Near Limit",
          `Memory usage at ${usagePercent.toFixed(1)}% of limit (${formatSize(totalSize)} / ${formatSize(limit)})`,
          ev,
          [
            fix("Free up memory", {
              command: "Consider archiving or trimming old memory files",
              risk: "low",
            }),
          ],
        ),
      ];
    }

    return [
      finding(
        "memory-limit",
        "memory",
        "ok",
        0,
        "Memory Usage OK",
        `Memory usage at ${usagePercent?.toFixed(1) ?? "?"}% of limit (${formatSize(totalSize)} / ${formatSize(limit)})`,
        ev,
      ),
    ];
  },
};

/**
 * Check: Memory provider config detected.
 * Hermes v24 uses memory.provider field (Honcho-based provider concept).
 */
export const externalProviderCheck: Check = {
  id: "memory-external-provider",
  area: "memory",
  title: "Memory Provider",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mem = snapshot.memory;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("external_provider", mem.externalProvider ?? "(not configured)", "config"),
      evidence("external_ok", String(mem.externalOk ?? "unknown"), "config"),
    ];

    if (!mem.externalProvider) {
      return [
        finding(
          "memory-external-provider",
          "memory",
          "info",
          0,
          "No Memory Provider",
          "No memory provider (memory.provider) is configured — using default local storage",
          ev,
        ),
      ];
    }

    // externalOk is false or null = credentials or config issue
    if (mem.externalOk === false || mem.externalOk === null) {
      return [
        finding(
          "memory-external-provider",
          "memory",
          "broken",
          3,
          "Memory Provider Not Connected",
          `Memory provider "${mem.externalProvider}" is configured but not connected — missing credentials or configuration`,
          ev,
          [
            fix(`Configure ${mem.externalProvider} credentials`, {
              command: `Set ${safeIdentifier(mem.externalProvider ?? "provider").toUpperCase()}_API_KEY in your environment or ~/.hermes/.env`,
              description: `Check ${mem.externalProvider} documentation for required environment variables, or configure via memory.provider in config.yaml`,
              risk: "low",
            }),
          ],
        ),
      ];
    }

    return [
      finding(
        "memory-external-provider",
        "memory",
        "ok",
        0,
        "Memory Provider Connected",
        `Memory provider ${mem.externalProvider} is connected and operational`,
        ev,
      ),
    ];
  },
};

/**
 * Check: Secrets in memory files detected.
 */
export const memorySecretsCheck: Check = {
  id: "memory-secrets",
  area: "memory",
  title: "Memory File Secrets",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mem = snapshot.memory;
    const secrets = mem.secrets ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("memory_dir", mem.memoryDir ?? "(unknown)", "file"),
      evidence("secrets_count", String(secrets.length), "file"),
      evidence("secrets", JSON.stringify(
        secrets.map((s) => ({
          file: s.file,
          secret_type: s.secretType,
          masked: `[REDACTED:${s.secretType.toUpperCase()}]`,
        })),
      ), "file", "medium", true),
    ];

    if (secrets.length === 0) {
      return [
        finding(
          "memory-secrets",
          "memory",
          "ok",
          0,
          "No Secrets in Memory Files",
          "No API keys, tokens, or secrets detected in memory files",
          ev,
        ),
      ];
    }

    return [
      finding(
        "memory-secrets",
        "memory",
        "risk",
          4,
        "Secrets Detected in Memory Files",
        `${secrets.length} potential secret(s) found in ${[...new Set(secrets.map((s) => s.file))].length} memory file(s)`,
        ev,
        [
          fix("Remove secrets from memory files", {
            command: `grep -rn 'sk-\\|ghp_\\|xoxb-' ${safePath(memoryDir(mem))}`,
            description: "Memory files should not contain API keys or tokens",
            risk: "medium",
            requiresConfirmation: true,
            manualSteps: [
              `Run: grep -rn 'sk-\\|ghp_\\|xoxb-' ${mem.memoryDir ?? "~/.hermes/memory/"}`,
              "Review any matches and remove sensitive data from the files",
            ],
            rollback: "Restore files from backup if modified",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Huge session/context/log files detected.
 */
export const memoryHugeFilesCheck: Check = {
  id: "memory-huge-files",
  area: "memory",
  title: "Huge Memory Files",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mem = snapshot.memory;
    const files = mem.files ?? [];
    const hugeThreshold = 100 * 1024 * 1024; // 100 MB

    const hugeFiles = files.filter((f) => f.sizeBytes > hugeThreshold);
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("huge_files", JSON.stringify(
        hugeFiles.map((f) => ({
          name: f.name,
          size_bytes: f.sizeBytes,
        })),
      ), "file"),
    ];

    if (hugeFiles.length === 0) {
      return [
        finding(
          "memory-huge-files",
          "memory",
          "ok",
          0,
          "No Huge Memory Files",
          "No memory files exceed 100 MB",
          ev,
        ),
      ];
    }

    return [
      finding(
        "memory-huge-files",
        "memory",
        "warning",
          2,
        "Huge Memory Files Detected",
        `${hugeFiles.length} memory file(s) exceed 100 MB: ${hugeFiles.map((f) => `${f.name} (${formatSize(f.sizeBytes)})`).join(", ")}`,
        ev,
        hugeFiles.slice(0, 3).map((f) =>
          fix(`Truncate ${f.name}`, {
            command: `truncate -s 0 ${safePath(`${memoryDir(mem)}/${safeIdentifier(f.name, "file")}`)}`,
            description: `File is ${formatSize(f.sizeBytes)} — consider archiving important content first`,
            risk: "high",
            requiresConfirmation: true,
            manualSteps: [
              `Backup the file: cp ${mem.memoryDir ?? "~/.hermes/memory/"}/${f.name} ${mem.memoryDir ?? "~/.hermes/memory/"}/${f.name}.bak`,
              `Run: truncate -s 0 ${mem.memoryDir ?? "~/.hermes/memory/"}/${f.name}`,
            ],
            rollback: `Restore from backup: cp ${safePath(`${memoryDir(mem)}/${safeIdentifier(f.name, "file")}.bak`)} ${safePath(`${memoryDir(mem)}/${safeIdentifier(f.name, "file")}`)}`,
          }),
        ),
      ),
    ];
  },
};

/**
 * Check: Duplicate/conflicting memory provider config.
 */
export const memoryDuplicateProviderCheck: Check = {
  id: "memory-duplicate-provider",
  area: "memory",
  title: "Memory Provider Config",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mem = snapshot.memory;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("external_provider", mem.externalProvider ?? "(not configured)", "config"),
      evidence("has_duplicate_providers", String(mem.hasDuplicateProviders ?? "unknown"), "config"),
      evidence("duplicate_provider_names", mem.duplicateProviderNames ? JSON.stringify(mem.duplicateProviderNames) : "none", "config"),
    ];

    // Check snapshot-level field for duplicate detection
    if (mem.hasDuplicateProviders && mem.duplicateProviderNames && mem.duplicateProviderNames.length >= 2) {
      return [
        finding(
          "memory-duplicate-provider",
          "memory",
          "warning",
          2,
          "Duplicate Memory Provider Configuration",
          `Multiple conflicting memory provider configurations detected: "${mem.duplicateProviderNames[0]}" and "${mem.duplicateProviderNames[1]}". Only one external provider is allowed.`,
          ev,
          [
            fix("Consolidate memory providers", {
              command: `Remove one of the duplicate provider entries from the 'memory' section in config.yaml, keeping only the desired provider`,
              description: `Found conflicting providers: ${(mem.duplicateProviderNames ?? []).join(", ")} — choose one and remove the other`,
              risk: "low",
            }),
          ],
        ),
      ];
    }

    return [
      finding(
        "memory-duplicate-provider",
        "memory",
        "ok",
        0,
        "Memory Provider Config OK",
        "No duplicate or conflicting memory provider configurations detected",
        ev,
      ),
    ];
  },
};

/**
 * Check: Memory provider configured under wrong config section.
 * VAL-MEM-010: Memory provider plugin configured under wrong config section
 */
export const memoryWrongSectionCheck: Check = {
  id: "memory-wrong-section",
  area: "memory",
  title: "Memory Config Section",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mem = snapshot.memory;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("misplaced_config", String(mem.misplacedConfig ?? "none"), "config"),
      evidence("misplaced_config_details", mem.misplacedConfigDetails ?? "(none)", "config"),
    ];

    if (mem.misplacedConfig && mem.misplacedConfigDetails) {
      return [
        finding(
          "memory-wrong-section",
          "memory",
          "warning",
          2,
          "Memory Provider in Wrong Config Section",
          mem.misplacedConfigDetails,
          ev,
          [
            fix("Move memory provider to memory section", {
              command: "Move the memory-provider plugin configuration from 'plugins:' to the 'memory:' section in config.yaml",
              description: `Found memory provider plugin listed under 'plugins:' — move it to the 'memory:' section to ensure correct configuration`,
              risk: "low",
            }),
          ],
        ),
      ];
    }

    return [
      finding(
        "memory-wrong-section",
        "memory",
        "ok",
        0,
        "Memory Config Section OK",
        "No memory providers found in non-standard config sections",
        ev,
      ),
    ];
  },
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** All memory checks */
export const memoryChecks: Check[] = [
  memoryFilesCheck,
  memoryFileSizesCheck,
  memoryLimitCheck,
  externalProviderCheck,
  memorySecretsCheck,
  memoryHugeFilesCheck,
  memoryDuplicateProviderCheck,
  memoryWrongSectionCheck,
];
