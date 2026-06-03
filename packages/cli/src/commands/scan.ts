import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import type { Command } from "commander";

import {
  collectAll,
  buildSnapshot,
  DeterministicWorkflowRunner,
  type WorkflowRunner,
} from "@hermes-doctor/core";

import { renderConsole } from "../output/console-renderer.js";
import { renderMarkdown } from "../output/markdown-renderer.js";
import { renderJson } from "../output/json-renderer.js";

interface ScanOptions {
  hermesHome?: string;
  profile?: string;
  format?: string | string[];
  output?: string;
  verbose?: boolean;
  flue?: boolean;
  /** Commander stores --no-flue as flue=false */
  noFlue?: boolean;
  includeLogSnippets?: boolean;
  maxLogLines?: string;
  strictRedaction?: boolean;
}

export interface ResolvedHermesHome {
  path: string;
  exists: boolean;
  readable: boolean;
}

function resolveHermesHome(cliPath?: string): ResolvedHermesHome {
  const target = cliPath ?? process.env.HERMES_HOME ?? path.join(os.homedir(), ".hermes");
  const resolved = path.resolve(target);
  let exists = false;
  let readable = false;
  try {
    fs.accessSync(resolved, fs.constants.F_OK);
    exists = true;
    try {
      fs.accessSync(resolved, fs.constants.R_OK);
      readable = true;
    } catch {
      readable = false;
    }
  } catch {
    exists = false;
    readable = false;
  }
  return { path: resolved, exists, readable };
}

/**
 * Determine if Flue mode should be enabled.
 *
 * Priority (highest to lowest):
 * 1. --no-flue flag → false
 * 2. --flue flag → true
 * 3. HERMES_DOCTOR_USE_FLUE=1 env var → true
 * 4. Default → false
 */
function shouldEnableFlue(options: ScanOptions): boolean {
  // --no-flue was explicitly passed (Commander sets flue=false when --no-flue is used)
  if (options.flue === false) {
    return false;
  }
  // --flue was explicitly passed
  if (options.flue === true) {
    return true;
  }
  // Check env var
  if (process.env.HERMES_DOCTOR_USE_FLUE === "1") {
    return true;
  }
  // Default
  return false;
}

/**
 * Create the appropriate WorkflowRunner.
 *
 * If Flue mode is enabled, dynamically import FlueWorkflowRunner.
 * If the dynamic import fails (e.g., @flue/runtime not installed),
 * fall back to DeterministicWorkflowRunner with a warning.
 */
async function createRunner(flueEnabled: boolean): Promise<WorkflowRunner> {
  if (flueEnabled) {
    try {
      const { FlueWorkflowRunner } = await import(
        "@hermes-doctor/flue-workflows"
      );
      return new FlueWorkflowRunner();
    } catch {
      process.stderr.write(
        "Warning: --flue requested but @hermes-doctor/flue-workflows " +
        "could not be loaded. Falling back to deterministic mode.\n",
      );
    }
  }
  return new DeterministicWorkflowRunner();
}

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Scan a Hermes installation and report on its health")
    .option(
      "--hermes-home <path>",
      "Path to the Hermes home directory (defaults to $HERMES_HOME or ~/.hermes)",
    )
    .option(
      "--profile <name>",
      "Hermes profile to scan (default: default)",
    )
    .option(
      "--format <format>",
      "Output format (console, markdown, json). Can be specified multiple times.",
      collectFormats,
      [],
    )
    .option(
      "--output <dir>",
      "Directory to write report files to",
    )
    .option(
      "--verbose",
      "Include extra diagnostic detail in output",
      false,
    )
    .option(
      "--flue",
      "Enable Flue AI enhancement (optional)",
    )
    .option(
      "--no-flue",
      "Disable Flue AI enhancement (default)",
    )
    .option(
      "--include-log-snippets",
      "Include redacted log excerpts in the report",
      false,
    )
    .option(
      "--max-log-lines <number>",
      "Maximum number of lines to read from each log file (default: 500)",
    )
    .option(
      "--strict-redaction",
      "Enable extra-aggressive redaction patterns (base64, env values, etc.)",
      false,
    )
    .action(async (options: ScanOptions) => {
      try {
        await executeScan(options);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        process.stderr.write(`Error: ${message}\n`);
        process.exitCode = 1;
      }
    });
}

/**
 * Collect repeated --format flags into an array.
 */
function collectFormats(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

async function executeScan(options: ScanOptions): Promise<void> {
  const hermesHome = resolveHermesHome(options.hermesHome);
  const profile = options.profile ?? "default";

  // If --hermes-home was explicitly provided, validate the path exists and is readable.
  // When auto-detecting (~/.hermes), a non-existent path is handled gracefully by collectors.
  if (options.hermesHome !== undefined) {
    if (!hermesHome.exists) {
      process.stderr.write(
        `Error: Hermes home path does not exist: ${hermesHome.path}\n`,
      );
      process.exitCode = 1;
      return;
    }
    if (!hermesHome.readable) {
      process.stderr.write(
        `Error: Hermes home path is not readable: ${hermesHome.path}\n`,
      );
      process.exitCode = 1;
      return;
    }
  }
  const rawFormats = Array.isArray(options.format) ? options.format : [options.format ?? "console"];
  // Use explicit formats if any provided, otherwise default to console
  const formats = rawFormats.length > 0 ? rawFormats : ["console"];

  // Determine Flue mode
  const flueEnabled = shouldEnableFlue(options);

  // Parse --max-log-lines with validation
  let maxLogLines = 500;
  if (options.maxLogLines) {
    const parsed = parseInt(options.maxLogLines, 10);
    if (isNaN(parsed)) {
      process.stderr.write(
        `Error: --max-log-lines must be a number, got '${options.maxLogLines}'\n`,
      );
      process.exitCode = 1;
      return;
    }
    if (parsed < 1) {
      process.stderr.write(
        `Error: --max-log-lines must be a positive number, got ${parsed}\n`,
      );
      process.exitCode = 1;
      return;
    }
    maxLogLines = parsed;
  }

  // Step 1: Run all collectors with all options
  const collectorResults = await collectAll({
    hermesHome: hermesHome.path,
    profile,
    includeLogSnippets: options.includeLogSnippets ?? false,
    maxLogLines,
    strictRedaction: options.strictRedaction ?? false,
  });

  // Step 2: Build snapshot
  const snapshot = buildSnapshot(collectorResults, {
    profile,
    hermesHome: hermesHome.path,
  });

  // Step 3: Create the appropriate runner and execute
  const runner = await createRunner(flueEnabled);
  const report = await runner.runDoctor(snapshot);

  // Step 4: Render output
  const outputDir = options.output;

  // Track whether we wrote to stdout already
  let wroteConsole = false;

  for (const format of formats) {
    switch (format) {
      case "console": {
        const output = renderConsole(report, {
          verbose: options.verbose ?? false,
        });
        process.stdout.write(output);
        wroteConsole = true;
        break;
      }
      case "markdown": {
        const output = renderMarkdown(report);
        if (outputDir) {
          const fs = await import("node:fs");
          const mk = await import("node:fs/promises");
          await mk.mkdir(outputDir, { recursive: true });
          const filePath = path.join(outputDir, "hermes-doctor-report.md");
          fs.writeFileSync(filePath, output, "utf-8");
          process.stdout.write(`Markdown report written to ${filePath}\n`);
        } else if (!wroteConsole) {
          process.stdout.write(output);
          wroteConsole = true;
        }
        break;
      }
      case "json": {
        const output = renderJson(report, {
          verbose: options.verbose ?? false,
        });
        if (outputDir) {
          const fs = await import("node:fs");
          const mk = await import("node:fs/promises");
          await mk.mkdir(outputDir, { recursive: true });
          const filePath = path.join(outputDir, "hermes-doctor-report.json");
          fs.writeFileSync(filePath, output, "utf-8");
          process.stdout.write(`JSON report written to ${filePath}\n`);
        } else if (!wroteConsole) {
          process.stdout.write(output);
          wroteConsole = true;
        }
        break;
      }
      default:
        process.stderr.write(`Unknown format: ${format}. Valid formats: console, markdown, json\n`);
        process.exitCode = 1;
        return;
    }
  }
}
