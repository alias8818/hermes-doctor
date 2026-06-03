import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import type { Command } from "commander";

import {
  collectAll,
  buildSnapshot,
  DeterministicWorkflowRunner,
  type WorkflowRunner,
  type Thresholds,
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
  // Threshold and timeout options (stored as strings by Commander)
  memoryWarnPercent?: string;
  memoryCriticalPercent?: string;
  hugeFileThreshold?: string;
  largeFileThreshold?: string;
  crashLoopErrorThreshold?: string;
  crashLoopRecentErrors?: string;
  skillsLargeFileThreshold?: string;
  dashboardTimeout?: string;
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
 * Parse a numeric CLI option with validation.
 *
 * Returns the parsed number, or writes an error to stderr and returns null.
 * When `allowNegative` is false (default), non-negative values are required.
 */
function parseNumericOption(
  value: string | undefined,
  optionName: string,
  allowNegative = false,
): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    process.stderr.write(
      `Error: --${optionName} must be a number, got '${value}'\n`,
    );
    process.exitCode = 1;
    return null;
  }
  if (!allowNegative && parsed < 0) {
    process.stderr.write(
      `Error: --${optionName} must be a non-negative number, got ${parsed}\n`,
    );
    process.exitCode = 1;
    return null;
  }
  return parsed;
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
    // Threshold and timeout options
    .option(
      "--huge-file-threshold <mb>",
      "Threshold in MB above which a memory file is considered huge (default: 100)",
    )
    .option(
      "--large-file-threshold <kb>",
      "Threshold in KB above which a memory file is marked large (default: 256)",
    )
    .option(
      "--memory-warn-threshold <percent>",
      "Memory usage warning threshold in percent (default: 80)",
    )
    .option(
      "--memory-critical-threshold <percent>",
      "Memory usage critical threshold in percent (default: 100)",
    )
    .option(
      "--crash-loop-error-threshold <count>",
      "Total error count threshold for crash loop detection (default: 50)",
    )
    .option(
      "--crash-loop-recent-errors <count>",
      "Recent error count threshold for crash loop detection (default: 20)",
    )
    .option(
      "--skills-large-file-threshold <kb>",
      "File size threshold in KB for flagging large SKILL.md files (default: 512)",
    )
    .option(
      "--dashboard-timeout <ms>",
      "Dashboard connectivity probe timeout in milliseconds (default: 1500)",
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

  // Validate --profile name (issue #49)
  if (profile.length > 128) {
    process.stderr.write(
      `Error: --profile name must be at most 128 characters, got ${profile.length}\n`,
    );
    process.exitCode = 1;
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(profile)) {
    process.stderr.write(
      `Error: --profile name must contain only alphanumeric characters, hyphens, and underscores, got '${profile}'\n`,
    );
    process.exitCode = 1;
    return;
  }
  const rawFormats = Array.isArray(options.format) ? options.format : [options.format ?? "console"];
  // Use explicit formats if any provided, otherwise default to console
  const formats = rawFormats.length > 0 ? rawFormats : ["console"];

  // Validate all format flags before any processing (issue #55)
  const validFormats = new Set(["console", "markdown", "json"]);
  for (const format of formats) {
    if (!validFormats.has(format)) {
      process.stderr.write(
        `Error: Unknown format: '${format}'. Valid formats: console, markdown, json\n`,
      );
      process.exitCode = 1;
      return;
    }
  }

  // Check that --output path does not point to an existing file (issue #45)
  const outputDir = options.output;
  if (outputDir) {
    try {
      const stat = fs.statSync(outputDir);
      if (stat.isFile()) {
        process.stderr.write(
          `Error: --output path '${outputDir}' is an existing file, not a directory.\n`,
        );
        process.exitCode = 1;
        return;
      }
    } catch {
      // Path does not exist — will be created by mkdir
    }
  }

  // Warn if multiple formats without --output (issue #29)
  if (!outputDir && formats.length > 1) {
    process.stderr.write(
      `Warning: Multiple --format flags specified without --output. ` +
      `Only the first format ("${formats[0]}") will be written to stdout. ` +
      `Use --output <dir> to write all formats to files.\n`,
    );
  }

  // Warn if --output is used without explicit --format (issue #63)
  const userExplicitlySetFormat = Array.isArray(options.format) && options.format.length > 0;
  if (outputDir && !userExplicitlySetFormat) {
    process.stderr.write(
      `Warning: --output specified without --format. ` +
      `Defaulting to console output on stdout. ` +
      `Use --format markdown or --format json to write files to the output directory.\n`,
    );
  }

  // Without --output, only one format can go to stdout
  const formatsToRender = (!outputDir && formats.length > 1) ? [formats[0]] : formats;

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

  // Parse threshold options with validation
  const hugeFileThreshold = parseNumericOption(options.hugeFileThreshold, "huge-file-threshold");
  if (process.exitCode === 1) return;

  const largeFileThreshold = parseNumericOption(options.largeFileThreshold, "large-file-threshold");
  if (process.exitCode === 1) return;

  const memoryWarnPercent = parseNumericOption(options.memoryWarnPercent, "memory-warn-threshold");
  if (process.exitCode === 1) return;

  const memoryCriticalPercent = parseNumericOption(options.memoryCriticalPercent, "memory-critical-threshold");
  if (process.exitCode === 1) return;

  const crashLoopErrorThreshold = parseNumericOption(
    options.crashLoopErrorThreshold,
    "crash-loop-error-threshold",
  );
  if (process.exitCode === 1) return;

  const crashLoopRecentErrors = parseNumericOption(
    options.crashLoopRecentErrors,
    "crash-loop-recent-errors",
  );
  if (process.exitCode === 1) return;

  const skillsLargeFileThreshold = parseNumericOption(
    options.skillsLargeFileThreshold,
    "skills-large-file-threshold",
  );
  if (process.exitCode === 1) return;

  const dashboardTimeout = parseNumericOption(options.dashboardTimeout, "dashboard-timeout");
  if (process.exitCode === 1) return;

  // Build threshold overrides from parsed CLI options
  const thresholds: Partial<Thresholds> = {};
  if (memoryWarnPercent !== null) thresholds.memoryWarnPercent = memoryWarnPercent;
  if (memoryCriticalPercent !== null) thresholds.memoryCriticalPercent = memoryCriticalPercent;
  if (hugeFileThreshold !== null) thresholds.hugeFileBytes = hugeFileThreshold * 1024 * 1024;
  if (largeFileThreshold !== null) thresholds.largeFileBytes = largeFileThreshold * 1024;
  if (crashLoopErrorThreshold !== null) thresholds.crashLoopErrorCount = crashLoopErrorThreshold;
  if (crashLoopRecentErrors !== null) thresholds.crashLoopRecentErrors = crashLoopRecentErrors;
  if (skillsLargeFileThreshold !== null) thresholds.skillsLargeFileBytes = skillsLargeFileThreshold * 1024;

  // Step 1: Run all collectors with all options
  const collectorResults = await collectAll({
    hermesHome: hermesHome.path,
    profile,
    includeLogSnippets: options.includeLogSnippets ?? false,
    maxLogLines,
    strictRedaction: options.strictRedaction ?? false,
    thresholds: Object.keys(thresholds).length > 0 ? thresholds : undefined,
    dashboardTimeoutMs: dashboardTimeout ?? undefined,
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

  for (const format of formatsToRender) {
    switch (format) {
      case "console": {
        const output = renderConsole(report, {
          verbose: options.verbose ?? false,
        });
        process.stdout.write(output);
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
        } else {
          process.stdout.write(output);
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
        } else {
          process.stdout.write(output);
        }
        break;
      }
    }
  }
}
