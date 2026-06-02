import picocolors from "picocolors";

// picocolors evaluates FORCE_COLOR/NO_COLOR at import time, so setting these
// env vars after the module is loaded has no effect. We use a Proxy to
// re-evaluate color support at each property access (render time), ensuring
// that runtime changes to FORCE_COLOR / NO_COLOR are respected.
const pc = new Proxy(picocolors, {
  get(target, prop: string | symbol) {
    if (prop === "createColors") return target.createColors;
    const env = process.env || {};
    const argv = process.argv || [];
    const noColor = !!env.NO_COLOR || argv.includes("--no-color");
    const forceColor = !!env.FORCE_COLOR || argv.includes("--color");
    const isTTY = !!((process.stdout || {}) as { isTTY?: boolean }).isTTY;
    const enabled = forceColor || (!noColor && (isTTY || !!env.CI || process.platform === "win32"));
    return (target.createColors(enabled) as unknown as Record<string, string | ((s: string) => string)>)[prop as string] as (s: string) => string;
  },
}) as typeof picocolors;

import type {
  DoctorFinding,
  DoctorReport,
} from "@hermes-doctor/core";
import { redactDeep } from "@hermes-doctor/core";

export interface ConsoleRenderOptions {
  verbose?: boolean;
}

// ---------------------------------------------------------------------------
// Severity → color helper
// ---------------------------------------------------------------------------
function colorForSeverity(
  status: DoctorFinding["status"],
): (s: string) => string {
  switch (status) {
    case "ok":
    case "info":
      return pc.green;
    case "warning":
      return pc.yellow;
    case "broken":
    case "risk":
      return pc.red;
    case "unknown":
      return pc.dim;
  }
}

function badge(status: DoctorFinding["status"]): string {
  const colored = colorForSeverity(status);
  switch (status) {
    case "ok":
      return colored("  OK");
    case "info":
      return colored(" INFO");
    case "warning":
      return colored("WARN");
    case "broken":
      return colored("  BROKEN");
    case "risk":
      return colored(" RISK");
    case "unknown":
      return colored("  ?");
  }
}

// ---------------------------------------------------------------------------
// Group findings by severity (ok/info first, then warnings, broken, risks)
// ---------------------------------------------------------------------------
function groupFindings(
  findings: DoctorFinding[],
): Array<{ label: string; color: (s: string) => string; items: DoctorFinding[] }> {
  const groups: Record<string, DoctorFinding[]> = {
    ok: [],
    info: [],
    warning: [],
    broken: [],
    risk: [],
    unknown: [],
  };

  for (const f of findings) {
    groups[f.status] ??= [];
    groups[f.status]!.push(f);
  }

  const order: Array<{ label: string; status: string }> = [
    { label: "OK", status: "ok" },
    { label: "Info", status: "info" },
    { label: "Warnings", status: "warning" },
    { label: "Broken", status: "broken" },
    { label: "Risks", status: "risk" },
    { label: "Unknown", status: "unknown" },
  ];

  const result: Array<{
    label: string;
    color: (s: string) => string;
    items: DoctorFinding[];
  }> = [];

  for (const { label, status } of order) {
    const items = groups[status];
    if (items && items.length > 0) {
      result.push({
        label,
        color: colorForSeverity(status as DoctorFinding["status"]),
        items,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render a DoctorReport to console (stdout-friendly string).
 *
 * Applies a final redaction pass as defense-in-depth.
 */
export function renderConsole(report: DoctorReport, options: ConsoleRenderOptions = {}): string {
  const lines: string[] = [];

  // Apply final redaction pass to the entire report
  const redactedReport = redactDeep(report, {
    homeDir: report.hermesHome ?? undefined,
  }).value as DoctorReport;

  // ── Header ──
  lines.push(pc.bold("Hermes Doctor — Health Report"));
  lines.push(
    pc.dim(
      `Generated: ${redactedReport.generatedAt}  |  Profile: ${redactedReport.profile}`,
    ),
  );
  if (redactedReport.hermesHome) {
    lines.push(pc.dim(`Hermes Home: ${redactedReport.hermesHome}`));
  }
  lines.push("");

  // ── Verbose collector status ──
  if (options.verbose) {
    lines.push(pc.bold(pc.underline("Collector Status")));
    const collectionWarnings = (redactedReport as Record<string, unknown>).collectionWarnings as string[] | undefined;
    if (collectionWarnings && collectionWarnings.length > 0) {
      lines.push(pc.dim("  Collection warnings:"));
      for (const w of collectionWarnings) {
        lines.push(`    ${pc.yellow(w)}`);
      }
    }
    lines.push("");

    // Per-area collector status from findings
    const collectorStatuses = new Map<string, string>();
    for (const f of redactedReport.findings) {
      if (!collectorStatuses.has(f.area)) {
        collectorStatuses.set(f.area, "collected");
      }
    }
    const statusKeys = [...collectorStatuses.keys()].sort();
    lines.push(pc.dim(`  Areas collected: ${statusKeys.join(", ")}`));
    lines.push(pc.dim(`  Total findings: ${redactedReport.summary.total}`));
    lines.push(pc.dim(`  Generated at: ${redactedReport.generatedAt}`));
    lines.push("");
  }

  // ── Summary ──
  lines.push(pc.bold("Summary"));
  const s = redactedReport.summary;
  const summaryParts: string[] = [];
  if (s.ok > 0) summaryParts.push(pc.green(`${s.ok} OK`));
  if (s.info > 0) summaryParts.push(pc.green(`${s.info} Info`));
  if (s.warnings > 0) summaryParts.push(pc.yellow(`${s.warnings} Warnings`));
  if (s.broken > 0) summaryParts.push(pc.red(`${s.broken} Broken`));
  if (s.risks > 0) summaryParts.push(pc.red(`${s.risks} Risks`));
  if (s.unknown > 0) summaryParts.push(pc.dim(`${s.unknown} Unknown`));
  summaryParts.push(`Total: ${s.total}`);
  lines.push(`  ${summaryParts.join("  |  ")}`);
  lines.push("");

  // ── Findings ──
  const groups = groupFindings(redactedReport.findings);

  for (const group of groups) {
    lines.push(pc.bold(group.color(`${group.label} (${group.items.length})`)));
    lines.push("");

    for (const finding of group.items) {
      lines.push(
        `  ${badge(finding.status)}  ${pc.bold(finding.title)}`,
      );
      lines.push(`       ${finding.message}`);

      if (finding.details) {
        lines.push(`       ${pc.dim(finding.details)}`);
      }

      // Evidence
      const evidenceData = finding.evidence;
      const evidenceEntries = Array.isArray(evidenceData)
        ? evidenceData
        : Object.entries(evidenceData as Record<string, unknown>);

      if (evidenceEntries.length > 0) {
        lines.push(`       ${pc.underline("Evidence:")}`);
        if (Array.isArray(evidenceData)) {
          for (const item of evidenceData as Array<Record<string, unknown>>) {
            const label = String(item.label ?? "");
            const detail = String(item.detail ?? "");
            const parts = [detail];
            if (item.source) parts.push(`[source: ${String(item.source)}]`);
            if (item.confidence) parts.push(`[confidence: ${String(item.confidence)}]`);
            if (item.redacted !== undefined) parts.push(`[redacted: ${String(item.redacted)}]`);
            lines.push(`         ${label}: ${parts.join(" ")}`);
          }
        } else {
          for (const [key, value] of evidenceEntries as Array<[string, unknown]>) {
            const display = typeof value === "string" ? value : JSON.stringify(value);
            lines.push(`         ${key}: ${display}`);
          }
        }
      }

      // Fixes
      if (finding.fixes && finding.fixes.length > 0) {
        lines.push(`       ${pc.underline("Fix:")}`);
        for (const fix of finding.fixes) {
          lines.push(`         ${fix.title}`);
          if (fix.risk) {
            const riskColor = fix.risk === "high" ? pc.red : fix.risk === "medium" ? pc.yellow : pc.green;
            lines.push(`           ${riskColor(`[${fix.risk.toUpperCase()}]`)}`);
          }
          if (fix.requiresConfirmation) {
            lines.push(`           ${pc.yellow("[Requires confirmation]")}`);
          }
          if (fix.command) {
            lines.push(`           $ ${fix.command}`);
          }
          if (fix.description) {
            lines.push(`           ${fix.description}`);
          }
          if (fix.manualSteps && fix.manualSteps.length > 0) {
            lines.push(`           ${pc.dim("Manual steps:")}`);
            for (const step of fix.manualSteps) {
              lines.push(`             ${step}`);
            }
          }
          if (fix.rollback) {
            lines.push(`           ${pc.dim(`Rollback: ${fix.rollback}`)}`);
          }
          if (fix.url) {
            lines.push(`           ${fix.url}`);
          }
        }
      }

      lines.push("");
    }
  }

  // ── Flue Insights (experimental) ──
  const flueInsights = (redactedReport as Record<string, unknown>).flueInsights as {
    enabled: boolean;
    experimental: boolean;
    generatedAt?: string;
    insights: Array<{ findingId: string; insight: string }>;
    warnings: string[];
  } | undefined;

  if (flueInsights && flueInsights.enabled) {
    lines.push(pc.bold(pc.underline("Flue Insights (experimental)")));
    lines.push("");

    if (flueInsights.warnings.length > 0) {
      for (const w of flueInsights.warnings) {
        lines.push(`  ${pc.yellow(w)}`);
      }
      lines.push("");
    }

    if (flueInsights.insights.length === 0) {
      lines.push(pc.dim("  No Flue insights generated."));
      lines.push("");
    } else {
      for (const insight of flueInsights.insights) {
        lines.push(`  ${pc.bold(insight.findingId)}`);
        // eslint-disable-next-line no-control-regex
        lines.push(`    ${insight.insight.replace(/\u001B\[[0-9;]*[A-Za-z]/g, "")}`);
        lines.push("");
      }
    }

    if (flueInsights.generatedAt) {
      lines.push(pc.dim(`  Generated: ${flueInsights.generatedAt}`));
    }
    lines.push("");
  }

  // ── Redaction summary ──
  if (redactedReport.redaction.totalRedactions > 0 || redactedReport.redaction.homePathRedactions > 0) {
    lines.push(pc.dim("─".repeat(50)));
    lines.push(
      pc.dim(
        `Redacted: ${redactedReport.redaction.totalRedactions} secret(s), ` +
        `${redactedReport.redaction.homePathRedactions} home path(s)`,
      ),
    );
  }

  // ── Redacted for sharing ──
  lines.push(pc.dim("─".repeat(50)));
  lines.push(pc.bold(pc.green("✅ This report has been redacted for sharing.")));
  lines.push(
    pc.dim(
      "All detected secrets have been redacted. No raw API keys, tokens, or",
    ),
  );
  lines.push(pc.dim("passwords appear in this output."));
  lines.push("");

  return lines.join("\n");
}
