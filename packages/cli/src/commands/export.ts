import * as fs from "node:fs";
import * as path from "node:path";

import type { Command } from "commander";

import { renderMarkdown } from "../output/markdown-renderer.js";
import { renderJson } from "../output/json-renderer.js";

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

  if (format !== "markdown" && format !== "json") {
    process.stderr.write(
      `Error: Unsupported format '${format}'. Use 'markdown' or 'json'.\n`,
    );
    process.exitCode = 1;
    return;
  }

  // Always find the JSON report — we re-render from JSON using the proper
  // renderer functions, which apply redaction and escaping defense-in-depth.
  const jsonReport = findLastReportOfType(outputDir, ".json");
  if (!jsonReport) {
    process.stderr.write(
      `Error: No previous scan report found in ${outputDir}. Run 'hermes-doctor scan' first.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const jsonContent = fs.readFileSync(jsonReport, "utf-8");
  const report = JSON.parse(jsonContent);

  if (format === "json") {
    // Re-render from JSON to apply redaction defense-in-depth
    process.stdout.write(renderJson(report));
    return;
  }

  // Re-render markdown from JSON using the proper renderer — this applies
  // redactDeep, escapeMd, and consistent formatting
  process.stdout.write(renderMarkdown(report));
}

function findLastReportOfType(dir: string, ext: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir);
  const matches = entries.filter(
    (f) => f.startsWith("hermes-doctor-report") && path.extname(f) === ext,
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const aTime = fs.statSync(path.join(dir, a)).mtimeMs;
    const bTime = fs.statSync(path.join(dir, b)).mtimeMs;
    return bTime - aTime;
  });
  return path.join(dir, matches[0]!);
}
