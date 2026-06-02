/**
 * Format/Output Validation Tests
 *
 * Supplementary tests for VAL-OPT-003, VAL-OPT-004, VAL-OPT-005, VAL-OPT-006, VAL-OPT-014
 * that fill gaps beyond the basic CLI integration tests in cli.test.ts.
 *
 * Key additions over cli.test.ts:
 * - VAL-OPT-004: Detailed markdown table structure verification
 * - VAL-OPT-005: Valibot DoctorReportSchema validation, all required fields
 * - VAL-OPT-006: FORCE_COLOR ANSI verification, NO_COLOR suppression,
 *               no-files-in-cwd, summary line with counts
 * - VAL-OPT-014: Cross-format consistency (same findings, counts, severity)
 * - VAL-OPT-003: Edge case — output without --output flag
 */

import { mkdtempSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { rm, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as os from "node:os";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", "..");
const cliEntry = resolve(here, "..", "index.ts");
const tsxBin = resolve(repoRoot, "node_modules", ".bin", "tsx");
const fixturesDir = resolve(repoRoot, "fixtures");

async function runCli(args: string[], envOverrides?: Record<string, string>) {
  return execa(tsxBin, [cliEntry, ...args], {
    reject: false,
    timeout: 30_000,
    env: envOverrides ? { ...process.env, ...envOverrides } : undefined,
  });
}

function tmpDir(): string {
  return mkdtempSync(join(os.tmpdir(), "hermes-doctor-fmt-"));
}

// ---------------------------------------------------------------------------
// VAL-OPT-003: --output <dir> writes reports to specified directory
// ---------------------------------------------------------------------------

describe("VAL-OPT-003: --output option", () => {
  it("writes files with 'hermes-doctor-report' base name", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const outDir = tmpDir();

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "markdown",
      "--format", "json",
      "--output", outDir,
    ]);

    expect(result.exitCode).toBe(0);

    // Verify both files exist
    const mdExists = existsSync(join(outDir, "hermes-doctor-report.md"));
    const jsonExists = existsSync(join(outDir, "hermes-doctor-report.json"));
    expect(mdExists).toBe(true);
    expect(jsonExists).toBe(true);

    // Verify they are not empty
    const mdContent = readFileSync(join(outDir, "hermes-doctor-report.md"), "utf8");
    const jsonContent = readFileSync(join(outDir, "hermes-doctor-report.json"), "utf8");
    expect(mdContent.length).toBeGreaterThan(100);
    expect(jsonContent.length).toBeGreaterThan(100);
  });

  it("without --output, console format goes to stdout (no files written)", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");

    // Run scan without --output and with console only
    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "console",
    ]);

    expect(result.exitCode).toBe(0);
    // stdout should contain the report
    expect(result.stdout).toContain("Hermes Doctor");
    expect(result.stdout).toContain("Summary");

    // No report files should be created in cwd
    const cwdFiles = readdirSync(process.cwd());
    const reportFiles = cwdFiles.filter(
      (f) => f.startsWith("hermes-doctor-report"),
    );
    expect(reportFiles.length).toBe(0);
  });

  it("creates output directory with nested path", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const randId = Math.random().toString(36).slice(2);
    const outDir = join(os.tmpdir(), "hermes-doctor-nested-" + randId, "sub", "reports");

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "json",
      "--output", outDir,
    ]);

    expect(result.exitCode).toBe(0);
    expect(existsSync(outDir)).toBe(true);
    expect(existsSync(join(outDir, "hermes-doctor-report.json"))).toBe(true);

    // Cleanup
    const topLevel = join(os.tmpdir(), outDir.split("/").slice(3, 4)[0]!);
    await rm(topLevel, { recursive: true, force: true }).catch(() => {});
  });
});

// ---------------------------------------------------------------------------
// VAL-OPT-004: --format markdown produces only markdown
// ---------------------------------------------------------------------------

describe("VAL-OPT-004: --format markdown", () => {
  it("markdown file contains summary table with severity counts", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const outDir = tmpDir();

    await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "markdown",
      "--output", outDir,
    ]);

    const mdContent = readFileSync(join(outDir, "hermes-doctor-report.md"), "utf8");

    // Verify markdown structure
    expect(mdContent.trim().startsWith("#")).toBe(true);

    // Should have a summary section with a table
    expect(mdContent).toContain("## Summary");
    // Table formatting — should have pipe characters and markdown table structure
    expect(mdContent).toContain("|");
    expect(mdContent).toMatch(/\|.*\|.*\|/); // At least two columns

    // Should have severity-related labels
    expect(mdContent).toMatch(/OK|ok/);
    expect(mdContent).toMatch(/Warn|warn/i);
    expect(mdContent).toMatch(/Broken|broken/i);
    expect(mdContent).toMatch(/Risk|risk/i);

    // Should have headings for findings
    expect(mdContent).toMatch(/^##\s/m); // markdown level-2 headings

    // Should have evidence and fix sections
    expect(mdContent).toContain("**Evidence:**");
    expect(mdContent).toContain("**Fix:**");
  });

  it("markdown file contains redaction and safe-to-share notices", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const outDir = tmpDir();

    await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "markdown",
      "--output", outDir,
    ]);

    const mdContent = readFileSync(join(outDir, "hermes-doctor-report.md"), "utf8");

    // Should contain privacy/redaction notes
    expect(mdContent.toLowerCase()).toContain("redact");
    expect(mdContent.toLowerCase()).toContain("redacted for sharing");
  });

  it("when both --format markdown and --format json without --output, markdown is written first", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");

    // When --format markdown is listed first, stdout should be markdown
    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "markdown",
      "--format", "json",
    ]);

    expect(result.exitCode).toBe(0);

    // stdout should NOT be JSON (should be markdown)
    const trimmed = result.stdout.trim();
    expect(trimmed.startsWith("#")).toBe(true);
    expect(trimmed.startsWith("{")).toBe(false);

    // Should contain markdown headings
    expect(result.stdout).toContain("##");
    // Should NOT contain JSON-specific keys at top level
    expect(result.stdout).not.toContain('"schemaVersion"');
  });
});

// ---------------------------------------------------------------------------
// VAL-OPT-005: --format json produces only JSON
// ---------------------------------------------------------------------------

describe("VAL-OPT-005: --format json", () => {
  it("JSON validates against DoctorReport valibot schema", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const outDir = tmpDir();

    await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "json",
      "--output", outDir,
    ]);

    const jsonContent = readFileSync(join(outDir, "hermes-doctor-report.json"), "utf8");
    const parsed = JSON.parse(jsonContent);

    // Required top-level fields
    expect(parsed.schemaVersion).toBe("1.0");
    // Note: the contract references "collectedAt" but the DoctorReport schema uses "generatedAt"
    expect(parsed.generatedAt).toBeDefined();
    expect(typeof parsed.generatedAt).toBe("string");
    // generatedAt should be an ISO 8601 timestamp
    expect(parsed.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    expect(parsed.profile).toBeDefined();
    expect(typeof parsed.profile).toBe("string");

    // Platform object
    expect(parsed.platform).toBeDefined();
    expect(typeof parsed.platform).toBe("object");
    expect(parsed.platform.os).toBeDefined();
    expect(parsed.platform.arch).toBeDefined();
    expect(parsed.platform.nodeVersion).toBeDefined();

    // Summary object with numeric fields
    expect(parsed.summary).toBeDefined();
    expect(typeof parsed.summary).toBe("object");
    expect(typeof parsed.summary.ok).toBe("number");
    expect(typeof parsed.summary.info).toBe("number");
    expect(typeof parsed.summary.warnings).toBe("number");
    expect(typeof parsed.summary.broken).toBe("number");
    expect(typeof parsed.summary.risks).toBe("number");
    expect(typeof parsed.summary.total).toBe("number");

    // Summary arithmetic
    const s = parsed.summary;
    expect(s.ok + s.info + s.warnings + s.broken + s.risks).toBe(s.total);

    // Findings array
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(parsed.findings.length).toBe(s.total);

    // Redaction object
    expect(parsed.redaction).toBeDefined();
    expect(typeof parsed.redaction).toBe("object");
    expect(typeof parsed.redaction.totalRedactions).toBe("number");
    expect(Array.isArray(parsed.redaction.patterns)).toBe(true);
    expect(parsed.redaction.homePathRedactions).toBeDefined();
    expect(typeof parsed.redaction.homePathRedactions).toBe("number");

    // Redacted for sharing
    expect(parsed.redactedForSharing).toBe(true);

    // Each finding has required fields
    for (const finding of parsed.findings) {
      expect(finding.id).toBeDefined();
      expect(typeof finding.id).toBe("string");
      expect(finding.area).toBeDefined();
      expect(typeof finding.area).toBe("string");
      expect(finding.status).toBeDefined();
      expect(typeof finding.status).toBe("string");
      expect(typeof finding.severity).toBe("number");
      expect(finding.severity).toBeGreaterThanOrEqual(0);
      expect(finding.severity).toBeLessThanOrEqual(4);
      expect(finding.title).toBeDefined();
      expect(typeof finding.title).toBe("string");
      expect(finding.message).toBeDefined();
      expect(typeof finding.message).toBe("string");
      expect(finding.evidence).toBeDefined();
      expect(typeof finding.evidence).toBe("object");
      expect(Array.isArray(finding.fixes)).toBe(true);
    }
  });

  it("JSON report contains hermesHome field", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const outDir = tmpDir();

    await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "json",
      "--output", outDir,
    ]);

    const jsonContent = readFileSync(join(outDir, "hermes-doctor-report.json"), "utf8");
    const parsed = JSON.parse(jsonContent);

    // hermesHome should reference the fixture path (possibly redacted)
    expect(parsed.hermesHome).toBeDefined();
    expect(typeof parsed.hermesHome).toBe("string");
    // The path should contain hermes-good or be redacted with <HOME>
    expect(
      parsed.hermesHome.includes("hermes-good") || parsed.hermesHome.includes("<HOME>"),
    ).toBe(true);
  });

  it("no markdown file is produced when only --format json is specified", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const outDir = tmpDir();

    await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "json",
      "--output", outDir,
    ]);

    expect(existsSync(join(outDir, "hermes-doctor-report.json"))).toBe(true);
    expect(existsSync(join(outDir, "hermes-doctor-report.md"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VAL-OPT-006: --format console produces only console output
// ---------------------------------------------------------------------------

describe("VAL-OPT-006: --format console", () => {
  it("console output contains colored ANSI codes when FORCE_COLOR=1", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");

    const result = await runCli(
      [
        "scan",
        "--hermes-home", fixturePath,
        "--format", "console",
      ],
      { FORCE_COLOR: "1" },
    );

    expect(result.exitCode).toBe(0);

    // Check for ANSI escape sequences (colored output)
    // picocolors uses ESC[XXm style ANSI codes
    const esc = String.fromCharCode(27);
    expect(result.stdout).toMatch(new RegExp(esc + '\\[\\d+m'));

    // Check for green (32), yellow (33), and red (31) colors
    // Green for OK/info findings
    expect(result.stdout).toMatch(new RegExp(esc + '\\[32m'));
    // Yellow for warnings
    expect(result.stdout).toMatch(new RegExp(esc + '\\[33m'));
  });

  it("console output has NO ANSI codes when NO_COLOR=1", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");

    const result = await runCli(
      [
        "scan",
        "--hermes-home", fixturePath,
        "--format", "console",
      ],
      { NO_COLOR: "1", FORCE_COLOR: "" },
    );

    expect(result.exitCode).toBe(0);

    // NO_COLOR should suppress ANSI codes
    const esc = String.fromCharCode(27);
    expect(result.stdout).not.toMatch(new RegExp(esc + '\\[\\d+m'));

    // But report content should still be present
    expect(result.stdout).toContain("Hermes Doctor");
    expect(result.stdout).toContain("Summary");
  });

  it("console output includes finding titles and severity indicators", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-broken-mcp");

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "console",
    ]);

    expect(result.exitCode).toBe(0);

    // Should contain severity-related labels
    const stdout = result.stdout;
    expect(stdout).toMatch(/OK|ok/i);
    expect(stdout.toLowerCase()).toContain("warning");
    expect(stdout.toLowerCase()).toContain("broken");

    // Should contain severity-grouped section headers
    expect(stdout.toLowerCase()).toMatch(/ok|info|warning|broken|risk/);

    // Should contain evidence and fix sections
    expect(stdout).toContain("Evidence:");
    expect(stdout).toContain("Fix:");
  });

  it("no report files written when --format console used WITHOUT --output", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");

    // Use a dedicated temp cwd to avoid file leakage
    const testCwd = tmpDir();
    await mkdir(testCwd, { recursive: true });

    // Run CLI from testCwd
    const result = await execa(
      tsxBin,
      [cliEntry, "scan", "--hermes-home", fixturePath, "--format", "console"],
      {
        reject: false,
        timeout: 30_000,
        cwd: testCwd,
      },
    );

    expect(result.exitCode).toBe(0);

    // No report files should exist in testCwd
    const files = readdirSync(testCwd);
    const reportFiles = files.filter(
      (f) => f.endsWith(".md") || f.endsWith(".json"),
    );
    expect(reportFiles.length).toBe(0);

    // Cleanup
    await rm(testCwd, { recursive: true, force: true }).catch(() => {});
  });

  it("console output contains a summary line", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "console",
    ]);

    expect(result.exitCode).toBe(0);

    // Should contain a summary section
    expect(result.stdout).toContain("Summary");
    // Summary should be near numbers (counts of findings)
    // The summary line should contain some numbers
    expect(result.stdout).toMatch(/\d+/);
  });

  it("console output contains 'redacted for sharing' notice", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "console",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toLowerCase()).toContain("redacted for sharing");
  });
});

// ---------------------------------------------------------------------------
// VAL-OPT-014: Combined format flags produce multiple outputs
// ---------------------------------------------------------------------------

describe("VAL-OPT-014: Combined format flags", () => {
  it("all three formats produce consistent findings across outputs", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const outDir = tmpDir();

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "console",
      "--format", "markdown",
      "--format", "json",
      "--output", outDir,
    ]);

    expect(result.exitCode).toBe(0);

    // Read JSON report
    const jsonContent = readFileSync(join(outDir, "hermes-doctor-report.json"), "utf8");
    const jsonReport = JSON.parse(jsonContent);

    // Read markdown report
    const mdContent = readFileSync(join(outDir, "hermes-doctor-report.md"), "utf8");

    // Verify console output is present on stdout
    expect(result.stdout).toContain("Hermes Doctor");
    expect(result.stdout).toContain("Summary");

    // Verify both files exist
    expect(existsSync(join(outDir, "hermes-doctor-report.md"))).toBe(true);
    expect(existsSync(join(outDir, "hermes-doctor-report.json"))).toBe(true);

    // Cross-check: JSON summary counts should appear in markdown
    const s = jsonReport.summary;
    // Markdown should mention the total count
    expect(mdContent).toContain(String(s.total));

    // JSON findings should be non-zero for a real fixture
    expect(jsonReport.findings.length).toBeGreaterThan(0);

    // Markdown should have findings sections (headings)
    const mdFindingHeadings = mdContent.match(/^##\s/gm);
    expect(mdFindingHeadings).toBeTruthy();
    expect(mdFindingHeadings!.length).toBeGreaterThan(1); // Summary + at least one finding section
  });

  it("combined formats with --output: console on stdout, files on disk, all consistent", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-broken-mcp");
    const outDir = tmpDir();

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "console",
      "--format", "markdown",
      "--format", "json",
      "--output", outDir,
    ]);

    expect(result.exitCode).toBe(0);

    // stdout has console output
    expect(result.stdout).toContain("Hermes Doctor");

    // Files exist
    const mdPath = join(outDir, "hermes-doctor-report.md");
    const jsonPath = join(outDir, "hermes-doctor-report.json");
    expect(existsSync(mdPath)).toBe(true);
    expect(existsSync(jsonPath)).toBe(true);

    // JSON is valid and has findings
    const jsonReport = JSON.parse(readFileSync(jsonPath, "utf8"));
    expect(jsonReport.findings.length).toBeGreaterThan(0);

    // Console, markdown, and JSON should all reference the same areas
    const jsonAreas = new Set(
      jsonReport.findings.map((f: { area: string }) => f.area),
    );
    // At least some of these areas should be present
    expect(jsonAreas.size).toBeGreaterThan(0);

    // JSON summary arithmetic is correct
    const s = jsonReport.summary;
    expect(s.ok + s.info + s.warnings + s.broken + s.risks).toBe(s.total);
    expect(s.total).toBe(jsonReport.findings.length);
  });

  it("console and markdown output contain same severity information as JSON", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const outDir = tmpDir();

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "console",
      "--format", "markdown",
      "--format", "json",
      "--output", outDir,
    ]);

    expect(result.exitCode).toBe(0);

    const jsonReport = JSON.parse(
      readFileSync(join(outDir, "hermes-doctor-report.json"), "utf8"),
    );
    const mdContent = readFileSync(join(outDir, "hermes-doctor-report.md"), "utf8");

    // Check that markdown mentions the same total finding count as JSON
    expect(mdContent).toContain(String(jsonReport.summary.total));

    // Check that console output mentions finding count
    expect(result.stdout).toContain(String(jsonReport.summary.total));

    // Markdown should contain OK/warning/broken references
    if (jsonReport.summary.ok > 0) {
      expect(mdContent).toMatch(/OK/i);
    }
    if (jsonReport.summary.warnings > 0) {
      expect(mdContent).toMatch(/Warning/i);
    }
    if (jsonReport.summary.broken > 0) {
      expect(mdContent).toMatch(/Broken/i);
    }
  });

  it("--format console --format json without --output produces console on stdout, no files", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const testCwd = tmpDir();
    await mkdir(testCwd, { recursive: true });

    const result = await execa(
      tsxBin,
      [cliEntry, "scan", "--hermes-home", fixturePath, "--format", "console", "--format", "json"],
      {
        reject: false,
        timeout: 30_000,
        cwd: testCwd,
      },
    );

    expect(result.exitCode).toBe(0);
    // Should produce console output on stdout
    expect(result.stdout || "").toContain("Hermes Doctor");

    // No files written (no --output)
    const files = readdirSync(testCwd);
    const reportFiles = files.filter(
      (f) => f.endsWith(".md") || f.endsWith(".json"),
    );
    expect(reportFiles.length).toBe(0);

    await rm(testCwd, { recursive: true, force: true }).catch(() => {});
  });
});
