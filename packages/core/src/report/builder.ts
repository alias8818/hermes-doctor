import * as v from "valibot";

import { DoctorReportSchema } from "../schemas/report.js";
import type { DoctorFinding, DoctorReport } from "../schemas/report.js";
import type { FlueInsightsSection } from "../schemas/flue.js";
import type { RedactionSummary } from "../schemas/snapshot.js";
import { getPlatformInfo } from "../utils/platform.js";
import { createRedactionSummary, mergeRedactionSummaries } from "../redaction/redact.js";

export interface BuildReportOptions {
  profile?: string;
  hermesHome?: string | null;
  collectedAt?: string;
  flueEnabled?: boolean;
  flueInsights?: FlueInsightsSection;
  redaction?: RedactionSummary;
}

/**
 * Build a DoctorReport from an array of DoctorFindings.
 *
 * Computes summary counts (ok, info, warnings, broken, risks, unknown, total),
 * populates platform metadata, and validates the final report against
 * DoctorReportSchema.
 */
export function buildReport(
  findings: DoctorFinding[],
  options: BuildReportOptions = {},
): DoctorReport {
  const platform = getPlatformInfo();
  const collectedAt = options.collectedAt ?? new Date().toISOString();
  const redaction = options.redaction ?? createRedactionSummary();

  // Compute summary counts from findings
  let ok = 0;
  let info = 0;
  let warnings = 0;
  let broken = 0;
  let risks = 0;
  let unknown = 0;

  for (const finding of findings) {
    switch (finding.status) {
      case "ok":
        ok++;
        break;
      case "info":
        info++;
        break;
      case "warning":
        warnings++;
        break;
      case "broken":
        broken++;
        break;
      case "risk":
        risks++;
        break;
      case "unknown":
        unknown++;
        break;
    }
  }

  const total = findings.length;

  const report: DoctorReport = {
    schemaVersion: "1.0",
    generatedAt: collectedAt,
    profile: options.profile ?? "default",
    hermesHome: options.hermesHome ?? null,
    platform: {
      os: platform.os,
      arch: platform.arch,
      nodeVersion: platform.nodeVersion,
    },
    summary: {
      ok,
      info,
      warnings,
      broken,
      risks,
      unknown,
      total,
    },
    findings,
    redaction,
    flueEnabled: options.flueEnabled ?? false,
    redactedForSharing: true,
  };

  // If flueInsights was provided, attach it to the report
  if (options.flueInsights) {
    (report as Record<string, unknown>).flueInsights = options.flueInsights;
  }

  // Validate against the schema
  return v.parse(DoctorReportSchema, report);
}

/**
 * Update a report's redaction summary in-place, merging additional
 * redaction counts (e.g., from a renderer's final redaction pass).
 */
export function updateReportRedaction(
  report: DoctorReport,
  additionalRedaction: RedactionSummary,
): DoctorReport {
  return {
    ...report,
    redaction: mergeRedactionSummaries(report.redaction, additionalRedaction),
  };
}
