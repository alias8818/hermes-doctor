import * as v from "valibot";

import type { CollectorResults } from "../collectors/index.js";
import type { CollectorResult } from "../schemas/collector.js";
import type { CollectorStatus } from "../schemas/common.js";
import { HermesSnapshotSchema } from "../schemas/snapshot.js";
import type {
  ConfigSnapshot,
  DashboardSnapshot,
  HermesSnapshot,
  InstallSnapshot,
  LogsSnapshot,
  McpSnapshot,
  MemorySnapshot,
  PluginsSnapshot,
  ProviderSnapshot,
  RedactionSummary,
  SecuritySnapshot,
  SkillsSnapshot,
  SystemSnapshot,
} from "../schemas/snapshot.js";
import { createRedactionSummary } from "../redaction/redact.js";

export interface BuildSnapshotOptions {
  /** Hermes profile name (default: "default") */
  profile?: string;
  /** Path to Hermes home, redacted before storage */
  hermesHome?: string | null;
  /** Timestamp override (default: new Date().toISOString()) */
  collectedAt?: string;
}

/**
 * Build a typed, validated, redacted HermesSnapshot from CollectorResults.
 *
 * Merges each area's collector data with its status/warnings/errors,
 * aggregates all collection warnings, and scans the snapshot for redaction
 * markers to produce an accurate RedactionSummary.
 *
 * Validates the final snapshot against HermesSnapshotSchema.
 */
export function buildSnapshot(
  results: CollectorResults,
  options: BuildSnapshotOptions = {},
): HermesSnapshot {
  const profile = options.profile ?? "default";
  const collectedAt = options.collectedAt ?? new Date().toISOString();

  const system = mergeResult<SystemSnapshot>(results.system);
  const install = mergeResult<InstallSnapshot>(results.install);
  const config = mergeResult<ConfigSnapshot>(results.config);
  const dashboard = mergeResult<DashboardSnapshot>(results.dashboard);
  const providers = mergeResult<ProviderSnapshot>(results.providers);
  const mcp = mergeResult<McpSnapshot>(results.mcp);
  const memory = mergeResult<MemorySnapshot>(results.memory);
  const skills = mergeResult<SkillsSnapshot>(results.skills);
  const plugins = mergeResult<PluginsSnapshot>(results.plugins);
  const logs = mergeResult<LogsSnapshot>(results.logs);
  const security = mergeResult<SecuritySnapshot>(results.security);

  // Aggregate all collection warnings
  const collectionWarnings = collectWarnings(results);

  // Scan the snapshot for redaction markers to build the summary
  const snapshotDraft: Omit<HermesSnapshot, "schemaVersion"> = {
    collectedAt,
    profile,
    hermesHome: options.hermesHome ?? null,
    system,
    install,
    config,
    dashboard,
    providers,
    mcp,
    memory,
    skills,
    plugins,
    logs,
    security,
    collectionWarnings,
    redaction: createRedactionSummary(),
  };

  // Re-run redaction deep scan to build an accurate summary
  // from already-redacted data (idempotent on the strings themselves)
  const redaction = scanRedactionMarkers(snapshotDraft);

  const snapshot: HermesSnapshot = {
    schemaVersion: "1.0" as const,
    ...snapshotDraft,
    redaction,
  };

  // Validate against the schema
  return v.parse(HermesSnapshotSchema, snapshot);
}

/**
 * Merge a CollectorResult's data with its status/warnings/errors
 * to form the complete area snapshot.
 */
function mergeResult<T extends { status: CollectorStatus; warnings?: string[]; errors?: string[] }>(
  result: CollectorResult<unknown>,
): T {
  return {
    ...(result.data as object),
    status: result.status,
    warnings: result.warnings,
    errors: result.errors,
  } as T;
}

/**
 * Aggregate all warnings from every collector.
 */
function collectWarnings(results: CollectorResults): string[] {
  const warnings: string[] = [];
  for (const result of Object.values(results)) {
    for (const warning of result.warnings) {
      warnings.push(warning);
    }
  }
  return warnings;
}

/**
 * Walk all string values in the snapshot to detect [REDACTED:TYPE] markers
 * and <HOME> placeholders, building an accurate RedactionSummary from the
 * already-redacted data.
 */
function scanRedactionMarkers(value: unknown): RedactionSummary {
  const summary = createRedactionSummary();
  const patterns = new Set<string>();

  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      // Count [REDACTED:TYPE] markers
      const redactedMatches = node.match(/\[REDACTED:(\w+)\]/g);
      if (redactedMatches) {
        summary.totalRedactions += redactedMatches.length;
        for (const match of redactedMatches) {
          const type = match.slice(10, -1); // Extract "TYPE" from "[REDACTED:TYPE]"
          patterns.add(type.toLowerCase());
        }
      }

      // Count <HOME> placeholders
      const homeMatches = node.match(/<HOME>/g);
      if (homeMatches) {
        summary.homePathRedactions += homeMatches.length;
      }
    } else if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
    } else if (node !== null && typeof node === "object") {
      for (const child of Object.values(node)) {
        walk(child);
      }
    }
  };

  walk(value);

  summary.count = summary.totalRedactions;
  summary.patterns = [...patterns].sort();
  summary.redacted =
    summary.totalRedactions > 0 || summary.homePathRedactions > 0;

  return summary;
}
