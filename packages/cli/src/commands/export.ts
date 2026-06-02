import * as fs from "node:fs";
import * as path from "node:path";

import type { Command } from "commander";

/**
 * Find the most recent scan report in the output directory.
 * Reports are named hermes-doctor-report.json or hermes-doctor-report.md.
 */
function findLastReport(outputDir: string): string | null {
  if (!fs.existsSync(outputDir)) {
    return null;
  }

  const entries = fs.readdirSync(outputDir);
  const reportFiles = entries.filter(
    (f) => f.startsWith("hermes-doctor-report") && (f.endsWith(".json") || f.endsWith(".md")),
  );

  if (reportFiles.length === 0) {
    return null;
  }

  // Sort by mtime, newest first
  reportFiles.sort((a, b) => {
    const aTime = fs.statSync(path.join(outputDir, a)).mtimeMs;
    const bTime = fs.statSync(path.join(outputDir, b)).mtimeMs;
    return bTime - aTime;
  });

  return path.join(outputDir, reportFiles[0]!);
}

/**
 * Default output directory for scan reports.
 */
function defaultOutputDir(): string {
  return path.join(process.cwd(), "hermes-doctor-report");
}

interface ExportOptions {
  last?: boolean;
  format?: string;
  output?: string;
}

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description("Export the most recent scan report")
    .option("--last", "Export the most recent scan report")
    .option("--format <format>", "Output format (markdown, json)")
    .option("--output <dir>", "Directory where the last report was stored")
    .action(async (options: ExportOptions) => {
      try {
        await executeExport(options);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        process.stderr.write(`Error: ${message}\n`);
        process.exitCode = 1;
      }
    });
}

async function executeExport(options: ExportOptions): Promise<void> {
  if (!options.last) {
    process.stderr.write(
      "Usage: hermes-doctor export --last [--format markdown|json] [--output <dir>]\n",
    );
    process.exitCode = 1;
    return;
  }

  const outputDir = options.output ?? defaultOutputDir();
  const format = options.format ?? "markdown";

  const lastReport = findLastReport(outputDir);
  if (!lastReport) {
    process.stderr.write(
      `Error: No previous scan report found in ${outputDir}. Run 'hermes-doctor scan' first.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const ext = format === "json" ? ".json" : ".md";
  const sourcePath = lastReport;
  const sourceExt = path.extname(sourcePath);

  // If the source format matches the requested format, just output it
  if (sourceExt === ext) {
    const content = fs.readFileSync(sourcePath, "utf-8");
    process.stdout.write(content);
    return;
  }

  // If format mismatch, try to find a file with the right extension
  const dir = path.dirname(sourcePath);
  const matchingFile = path.join(dir, `hermes-doctor-report${ext}`);
  if (fs.existsSync(matchingFile)) {
    const content = fs.readFileSync(matchingFile, "utf-8");
    process.stdout.write(content);
    return;
  }

  // No matching format found, read the JSON source and re-render if possible
  if (sourceExt === ".json") {
    const jsonContent = fs.readFileSync(sourcePath, "utf-8");
    const report = JSON.parse(jsonContent);

    if (format === "markdown") {
      // Basic markdown conversion from JSON report
      const lines: string[] = [];
      lines.push("# Hermes Doctor — Health Report");
      lines.push("");
      lines.push(`_Generated: ${report.generatedAt}  |  Profile: ${report.profile}_`);
      if (report.hermesHome) {
        lines.push(`_Hermes Home: ${report.hermesHome}_`);
      }
      lines.push("");
      lines.push("## Summary");
      lines.push("");
      lines.push("| Status | Count |");
      lines.push("|--------|-------|");
      const s = report.summary;
      if (s.ok > 0) lines.push(`| ✅ OK | ${s.ok} |`);
      if (s.info > 0) lines.push(`| ℹ️ Info | ${s.info} |`);
      if (s.warnings > 0) lines.push(`| ⚠️ Warnings | ${s.warnings} |`);
      if (s.broken > 0) lines.push(`| ❌ Broken | ${s.broken} |`);
      if (s.risks > 0) lines.push(`| 🔴 Risks | ${s.risks} |`);
      if (s.unknown > 0) lines.push(`| ❓ Unknown | ${s.unknown} |`);
      lines.push(`| **Total** | **${s.total}** |`);
      lines.push("");

      for (const finding of report.findings) {
        lines.push(`### ${finding.title}`);
        lines.push("");
        lines.push(`**Status:** ${finding.status}`);
        lines.push("");
        lines.push(finding.message);
        lines.push("");

        const evidenceEntries = Object.entries(finding.evidence || {});
        if (evidenceEntries.length > 0) {
          lines.push("**Evidence:**");
          lines.push("");
          for (const [key, value] of evidenceEntries) {
            const display = typeof value === "string" ? value : JSON.stringify(value);
            lines.push(`- \`${key}\`: ${display}`);
          }
          lines.push("");
        }

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
          }
          lines.push("");
        }
      }

      lines.push("## Privacy");
      lines.push("");
      lines.push("> ✅ This report has been redacted for sharing.");
      lines.push("");

      process.stdout.write(lines.join("\n"));
      return;
    }

    process.stderr.write(
      `Error: No ${format} report available in ${outputDir}. Run a scan with --format ${format} first.\n`,
    );
    process.exitCode = 1;
    return;
  }

  // Read and output the source file
  const content = fs.readFileSync(sourcePath, "utf-8");
  process.stdout.write(content);
}
