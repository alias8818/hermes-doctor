import type { DoctorFinding, DoctorReport } from "@hermes-doctor/core";
import { redactDeep } from "@hermes-doctor/core";

// ---------------------------------------------------------------------------
// Severity → label / helper
// ---------------------------------------------------------------------------
function statusLabel(status: DoctorFinding["status"]): string {
  switch (status) {
    case "ok":
      return "✅ OK";
    case "info":
      return "ℹ️ Info";
    case "warning":
      return "⚠️ Warning";
    case "broken":
      return "❌ Broken";
    case "risk":
      return "🔴 Risk";
    case "unknown":
      return "❓ Unknown";
  }
}

// ---------------------------------------------------------------------------
// Group findings by severity
// ---------------------------------------------------------------------------
interface FindingGroup {
  label: string;
  status: DoctorFinding["status"];
  items: DoctorFinding[];
}

function groupFindings(findings: DoctorFinding[]): FindingGroup[] {
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

  const result: FindingGroup[] = [];
  for (const { label, status } of order) {
    const items = groups[status];
    if (items && items.length > 0) {
      result.push({
        label,
        status: status as DoctorFinding["status"],
        items,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Escaping markdown special chars in evidence values
// ---------------------------------------------------------------------------
function escapeMd(text: string): string {
  // Neutralize markdown syntax in untrusted evidence / Flue text (including links/images).
  return text.replace(/([\\|*_`#[\]<>~\-+!)])/g, "\\$1");
}

/** Strip terminal control sequences from Flue output. */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001B\[[0-9;]*[A-Za-z]/g, "");
}

function code(text: string): string {
  return "`" + text.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`";
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render a DoctorReport to GitHub/Discord-friendly Markdown.
 *
 * Applies a final redaction pass as defense-in-depth.
 */
export function renderMarkdown(report: DoctorReport): string {
  // Apply final redaction pass
  const redactedReport = redactDeep(report, {
    homeDir: report.hermesHome ?? undefined,
  }).value as DoctorReport;
  const s = redactedReport.summary;
  const lines: string[] = [];

  // ── Title ──
  lines.push("# Hermes Doctor — Health Report");
  lines.push("");
  lines.push(
    `_Generated: ${redactedReport.generatedAt}  |  Profile: ${redactedReport.profile}_`,
  );
  if (redactedReport.hermesHome) {
    lines.push(`_Hermes Home: ${redactedReport.hermesHome}_`);
  }
  lines.push("");

  // ── Environment ──
  lines.push("## Environment");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");
  lines.push(`| OS | ${redactedReport.platform.os} |`);
  lines.push(`| Architecture | ${redactedReport.platform.arch} |`);
  lines.push(`| Node Version | ${redactedReport.platform.nodeVersion} |`);
  if (redactedReport.profile) {
    lines.push(`| Profile | ${redactedReport.profile} |`);
  }
  lines.push("");

  // ── Summary Table ──
  lines.push("## Summary");
  lines.push("");
  lines.push("| Status | Count |");
  lines.push("|--------|-------|");
  if (s.ok > 0) lines.push(`| ✅ OK | ${s.ok} |`);
  if (s.info > 0) lines.push(`| ℹ️ Info | ${s.info} |`);
  if (s.warnings > 0) lines.push(`| ⚠️ Warnings | ${s.warnings} |`);
  if (s.broken > 0) lines.push(`| ❌ Broken | ${s.broken} |`);
  if (s.risks > 0) lines.push(`| 🔴 Risks | ${s.risks} |`);
  if (s.unknown > 0) lines.push(`| ❓ Unknown | ${s.unknown} |`);
  lines.push(`| **Total** | **${s.total}** |`);
  lines.push("");

  // ── Findings ──
  const groups = groupFindings(redactedReport.findings);

  for (const group of groups) {
    lines.push(`## ${statusLabel(group.status)} (${group.items.length})`);
    lines.push("");

    for (const finding of group.items) {
      lines.push(`### ${escapeMd(finding.title)}`);
      lines.push("");
      lines.push(`**Status:** ${statusLabel(finding.status)}`);
      lines.push("");
      lines.push(escapeMd(finding.message));
      lines.push("");

      if (finding.details) {
        lines.push(`> ${finding.details}`);
        lines.push("");
      }

      // Evidence
      const evidenceData = finding.evidence;
      const isArray = Array.isArray(evidenceData);

      if (isArray) {
        if (evidenceData.length > 0) {
          lines.push("**Evidence:**");
          lines.push("");
          for (const item of evidenceData as Array<Record<string, unknown>>) {
            const label = String(item.label ?? "").replace(/\r/g, "");
            const detail = String(item.detail ?? "").replace(/\r/g, "");
            const parts = [escapeMd(detail)];
            if (item.source) parts.push(`[source: ${String(item.source).replace(/\r/g, "")}]`);
            if (item.confidence) parts.push(`[confidence: ${String(item.confidence).replace(/\r/g, "")}]`);
            if (item.redacted !== undefined) parts.push(`[redacted: ${String(item.redacted).replace(/\r/g, "")}]`);
            lines.push(`- ${code(label)}: ${parts.join(" ")}`);
          }
          lines.push("");
        }
      } else {
        const evidenceEntries = Object.entries(evidenceData as Record<string, unknown>);
        if (evidenceEntries.length > 0) {
          lines.push("**Evidence:**");
          lines.push("");
          for (const [key, value] of evidenceEntries) {
            const display = typeof value === "string" ? value.replace(/\r/g, "") : JSON.stringify(value);
            lines.push(`- ${code(key)}: ${escapeMd(display)}`);
          }
          lines.push("");
        }
      }

      // Fixes
      if (finding.fixes && finding.fixes.length > 0) {
        lines.push("**Fix:**");
        lines.push("");
        for (const fix of finding.fixes) {
          lines.push(`- **${fix.title}**`);
          if (fix.risk) {
            lines.push(`  - Risk: \`${fix.risk.toUpperCase()}\``);
          }
          if (fix.requiresConfirmation) {
            lines.push("  - ⚠️ Requires confirmation before applying");
          }
          if (fix.command) {
            lines.push("  ```bash");
            lines.push(`  ${fix.command}`);
            lines.push("  ```");
          }
          if (fix.description) {
            lines.push(`  _${fix.description}_`);
          }
          if (fix.manualSteps && fix.manualSteps.length > 0) {
            lines.push("  - Manual steps:");
            for (const step of fix.manualSteps) {
              lines.push(`    - ${step}`);
            }
          }
          if (fix.rollback) {
            lines.push(`  - Rollback: _${fix.rollback}_`);
          }
          if (fix.url) {
            lines.push(`  [Learn more](${fix.url})`);
          }
        }
        lines.push("");
      }
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
    lines.push("## Flue Insights (experimental)");
    lines.push("");

    if (flueInsights.warnings.length > 0) {
      lines.push("**Warnings:**");
      lines.push("");
      for (const w of flueInsights.warnings) {
        lines.push(`- ⚠️ ${escapeMd(w)}`);
      }
      lines.push("");
    }

    if (flueInsights.insights.length === 0) {
      lines.push("_No Flue insights generated._");
      lines.push("");
    } else {
      for (const insight of flueInsights.insights) {
        lines.push(`### ${escapeMd(insight.findingId)}`);
        lines.push("");
        lines.push(escapeMd(stripAnsi(insight.insight)));
        lines.push("");
      }
    }

    if (flueInsights.generatedAt) {
      lines.push(`_Flue generated at: ${flueInsights.generatedAt}_`);
      lines.push("");
    }
  }

  // ── Redaction notice ──
  if (
    redactedReport.redaction.totalRedactions > 0 ||
    redactedReport.redaction.homePathRedactions > 0
  ) {
    lines.push("## Redaction");
    lines.push("");
    lines.push(
      `> ⚠️ This report has been redacted. ${redactedReport.redaction.totalRedactions} secret(s) and ${redactedReport.redaction.homePathRedactions} home path(s) were automatically redacted.`,
    );
    if (redactedReport.redaction.patterns.length > 0) {
      lines.push(">");
      lines.push(
        `> Redacted pattern types: ${redactedReport.redaction.patterns.join(", ")}`,
      );
    }
    lines.push("");
  }

  // ── Redacted for sharing ──
  lines.push("## Privacy");
  lines.push("");
  lines.push(
    "> ✅ This report has been redacted for sharing. All detected secrets have been redacted. No raw API keys, tokens, or passwords appear in this report.",
  );
  lines.push("");

  return lines.join("\n");
}
