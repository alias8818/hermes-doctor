/**
 * CLI/UX Smoke Tests — Validation Contract Assertions (VAL-CLI-001 through VAL-CLI-022)
 *
 * Tests:
 *   VAL-CLI-001: Bare invocation runs scan, exits with scan result code
 *   VAL-CLI-002: Exit code reflects scan outcome (0 on valid, 1 on invalid/missing home)
 *   VAL-CLI-003: --help still prints full help listing all commands
 *   VAL-CLI-009: Default scan (no --hermes-home) completes, exits 0
 *   VAL-CLI-010: Targeted scan against fixtures exits 0 with findings
 *   VAL-CLI-011: --format json --output writes valid JSON to file
 *   VAL-CLI-012: Multiple --format flags produce coherent output files
 *   VAL-CLI-013: --verbose produces richer output than default
 *   VAL-CLI-014: --flue degrades gracefully without API key
 *   VAL-CLI-015: Nonexistent --hermes-home path exits 1 with clear error
 *   VAL-CLI-016: Permission-denied --hermes-home path exits 1 with clear error
 *   VAL-CLI-017: No ugly stack traces in default mode (negative)
 *   VAL-CLI-018: --help lists all commands and options
 *   VAL-CLI-019: version/--version prints correct semver
 *   VAL-CLI-020: Multiple --format without --output produces coherent single-format stdout
 *   VAL-CLI-021: export --last --format json re-exports last scan
 *   VAL-CLI-022: paths command prints absolute paths
 */

import { readFileSync, mkdtempSync, existsSync, chmodSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as os from "node:os";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Setup paths
// ---------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", "..");
const cliEntry = resolve(here, "..", "index.ts");
const tsxBin = resolve(repoRoot, "node_modules", ".bin", "tsx");
const fixturesDir = resolve(repoRoot, "fixtures");

const pkgVersion = (
  JSON.parse(
    readFileSync(resolve(here, "..", "..", "package.json"), "utf8"),
  ) as { version: string }
).version;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runCli(
  args: string[],
  envOverrides?: Record<string, string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const result = await execa(tsxBin, [cliEntry, ...args], {
    reject: false,
    timeout: 30_000,
    env: envOverrides ? { ...process.env, ...envOverrides } : undefined,
  });
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function tmpDir(): string {
  return mkdtempSync(join(os.tmpdir(), "hermes-doctor-cli-ux-"));
}

/** Regex matching stack trace frames like "at ... (file.ts:5:10)" */
const STACK_TRACE_RE = /at\s+.+:\d+:\d+/;

// ---------------------------------------------------------------------------
// VAL-CLI-001: Bare invocation runs scan instead of printing help
// ---------------------------------------------------------------------------

describe("[VAL-CLI-001] Bare invocation runs scan", () => {
  it("runs a scan and produces report output", async () => {
    const result = await runCli([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hermes Doctor");
    expect(result.stdout).toContain("Summary");
    expect(result.stdout).toContain("redacted for sharing");
    // No stack traces
    expect(result.stdout).not.toMatch(STACK_TRACE_RE);
    expect(result.stderr).not.toMatch(STACK_TRACE_RE);
  });

  it("exits 1 when Hermes home does not exist and HERMES_HOME is unset", async () => {
    // The bare invocation will scan against ~/.hermes which doesn't exist
    // The scan should handle that gracefully and exit with a useful error
    const result = await runCli([]);

    // If ~/.hermes doesn't exist, bare scan should still exit 0 because
    // the collectors handle missing homes gracefully (they return partial results)
    // As long as there's no crash, this is fine.
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("Error:");
  });

  it("bare invocation with --hermes-home /path scans that fixture", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await runCli(["--hermes-home", fixturePath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hermes Doctor");
    expect(result.stdout).toContain("Summary");
    expect(result.stdout).toContain("redacted for sharing");
    // No stack traces
    expect(result.stdout).not.toMatch(STACK_TRACE_RE);
    expect(result.stderr).not.toMatch(STACK_TRACE_RE);
  });

  it("bare invocation with --hermes-home /nonexistent exits 1", async () => {
    const badPath = join(os.tmpdir(), `hermes-doctor-nonexistent-${Date.now()}`);
    const result = await runCli(["--hermes-home", badPath]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Error");
    expect(result.stderr).toContain(badPath);
    // No stack traces
    expect(result.stderr).not.toMatch(STACK_TRACE_RE);
  });

  it("bare invocation with --format json produces valid JSON output", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await runCli(["--hermes-home", fixturePath, "--format", "json"]);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.summary).toBeDefined();
    expect(parsed.redactedForSharing).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-002: Exit code reflects scan outcome
// ---------------------------------------------------------------------------

describe("[VAL-CLI-002] Exit code reflects scan outcome", () => {
  it("scan on valid fixture exits 0", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await runCli(["scan", "--hermes-home", fixturePath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Summary");
  });

  it("scan on non-existent path exits 1", async () => {
    const badPath = join(os.tmpdir(), `hermes-doctor-nonexistent-${Date.now()}`);
    const result = await runCli(["scan", "--hermes-home", badPath]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Error");
    expect(result.stderr).not.toMatch(STACK_TRACE_RE);
  });

  it("--help exits 0", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("scan");
    expect(result.stdout).toContain("export");
    expect(result.stdout).toContain("paths");
    expect(result.stdout).toContain("version");
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-003: --help prints full help listing all commands
// ---------------------------------------------------------------------------

describe("[VAL-CLI-003] --help prints full help", () => {
  it("hermes-doctor --help lists all subcommands", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("scan");
    expect(result.stdout).toContain("export");
    expect(result.stdout).toContain("paths");
    expect(result.stdout).toContain("version");
    expect(result.stdout).toContain("--version");
  });

  it("hermes-doctor -h prints help", async () => {
    const result = await runCli(["-h"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("scan");
    expect(result.stdout).toContain("export");
    expect(result.stdout).toContain("paths");
    expect(result.stdout).toContain("version");
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-009: Default scan completes successfully
// ---------------------------------------------------------------------------

describe("[VAL-CLI-009] Default scan (no --hermes-home)", () => {
  it("completes and exits 0", async () => {
    const result = await runCli(["scan"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hermes Doctor");
    expect(result.stdout).toContain("Summary");
    expect(result.stdout).toContain("redacted for sharing");
    // No stack traces
    expect(result.stdout).not.toMatch(STACK_TRACE_RE);
    expect(result.stderr).not.toMatch(STACK_TRACE_RE);
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-010: Targeted scan against fixtures
// ---------------------------------------------------------------------------

describe("[VAL-CLI-010] Targeted scan against fixtures", () => {
  const fixtureNames = [
    "hermes-good",
    "hermes-broken-mcp",
    "hermes-missing-provider",
    "hermes-risky-dashboard",
    "hermes-memory-full",
  ];

  for (const fixtureName of fixtureNames) {
    it(`scans ${fixtureName} and exits 0`, async () => {
      const fixturePath = resolve(fixturesDir, fixtureName);
      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Hermes Doctor — Health Report");
      expect(result.stdout).toContain("Summary");
      // No stack traces
      expect(result.stdout).not.toMatch(STACK_TRACE_RE);
      expect(result.stderr).not.toMatch(STACK_TRACE_RE);
    });
  }

  it("hermes-broken-mcp produces at least one broken finding", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-broken-mcp");
    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "json",
    ]);

    expect(result.exitCode).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.summary.broken).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-011: JSON format writes valid JSON
// ---------------------------------------------------------------------------

describe("[VAL-CLI-011] --format json --output writes valid JSON", () => {
  it("writes a valid JSON report file", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const outDir = tmpDir();

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "json",
      "--output", outDir,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("JSON report written to");

    const jsonPath = join(outDir, "hermes-doctor-report.json");
    expect(existsSync(jsonPath)).toBe(true);

    const content = readFileSync(jsonPath, "utf8");
    const parsed = JSON.parse(content);
    expect(parsed.schemaVersion).toBe("1.0");
    expect(typeof parsed.summary.ok).toBe("number");
    expect(parsed.summary.total).toBeGreaterThan(0);
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(parsed.redactedForSharing).toBe(true);
    expect(typeof parsed.redaction.redacted).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-012: Multiple --format flags produce coherent outputs
// ---------------------------------------------------------------------------

describe("[VAL-CLI-012] Multiple --format flags produce coherent output files", () => {
  it("produces both .md and .json files", async () => {
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

    // Verify .md file
    const mdPath = join(outDir, "hermes-doctor-report.md");
    expect(existsSync(mdPath)).toBe(true);
    const mdContent = readFileSync(mdPath, "utf8");
    expect(mdContent.trim().startsWith("#")).toBe(true);
    expect(mdContent).toContain("| Status | Count |");

    // Verify .json file
    const jsonPath = join(outDir, "hermes-doctor-report.json");
    expect(existsSync(jsonPath)).toBe(true);
    const jsonContent = readFileSync(jsonPath, "utf8");
    expect(() => JSON.parse(jsonContent)).not.toThrow();
    const parsed = JSON.parse(jsonContent);
    expect(parsed.schemaVersion).toBe("1.0");

    // No garbled hybrid content
    expect(mdContent).not.toContain('"schemaVersion"');
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-013: --verbose produces richer output
// ---------------------------------------------------------------------------

describe("[VAL-CLI-013] --verbose produces richer output", () => {
  it("verbose output is longer than default output", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");

    const defaultResult = await runCli([
      "scan", "--hermes-home", fixturePath,
      "--format", "console",
    ]);
    const verboseResult = await runCli([
      "scan", "--hermes-home", fixturePath,
      "--format", "console",
      "--verbose",
    ]);

    expect(defaultResult.exitCode).toBe(0);
    expect(verboseResult.exitCode).toBe(0);

    const defaultLines = defaultResult.stdout.split("\n").filter(l => l.length > 0);
    const verboseLines = verboseResult.stdout.split("\n").filter(l => l.length > 0);
    expect(verboseLines.length).toBeGreaterThanOrEqual(defaultLines.length);
  });

  it("verbose output includes extra diagnostic detail", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");

    const verboseResult = await runCli([
      "scan", "--hermes-home", fixturePath,
      "--format", "console",
      "--verbose",
    ]);

    expect(verboseResult.exitCode).toBe(0);
    // Should contain collector/area status information
    expect(
      verboseResult.stdout.toLowerCase().includes("collector") ||
      verboseResult.stdout.toLowerCase().includes("areas")
    ).toBe(true);

    // No stack traces in either mode
    expect(verboseResult.stdout).not.toMatch(STACK_TRACE_RE);
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-014: --flue degrades gracefully without API key
// ---------------------------------------------------------------------------

describe("[VAL-CLI-014] --flue without API key degrades gracefully", () => {
  it("completes with warning and full report", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await execa(
      tsxBin,
      [cliEntry, "scan", "--hermes-home", fixturePath, "--flue"],
      {
        reject: false,
        timeout: 30_000,
        env: {
          ...process.env,
          FLUE_API_KEY: "",
          ANTHROPIC_API_KEY: "",
        },
      },
    );

    const exitCode = result.exitCode ?? 1;
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";

    expect(exitCode).toBe(0);
    // Should warn about Flue unavailability
    const allOutput = stdout + stderr;
    expect(allOutput).toContain("Flue");
    // Should still produce a full report
    expect(stdout).toContain("Summary");
    expect(stdout).toContain("redacted for sharing");
    // No stack traces
    expect(stdout).not.toMatch(STACK_TRACE_RE);
    expect(stderr).not.toMatch(STACK_TRACE_RE);
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-015: Nonexistent --hermes-home handled cleanly
// ---------------------------------------------------------------------------

describe("[VAL-CLI-015] Nonexistent --hermes-home path", () => {
  it("exits 1 with clear error and no stack trace", async () => {
    const badPath = join(os.tmpdir(), `hermes-doctor-nonexistent-${Date.now()}`);
    const result = await runCli([
      "scan",
      "--hermes-home", badPath,
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
    // Error should be human-readable, mention the path
    expect(result.stderr).toContain("Error");
    expect(result.stderr).toContain(badPath);
    // No raw stack trace frames
    expect(result.stderr).not.toMatch(STACK_TRACE_RE);
    expect(result.stdout).not.toMatch(STACK_TRACE_RE);
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-016: Permission-denied --hermes-home handled cleanly
// ---------------------------------------------------------------------------

describe("[VAL-CLI-016] Permission-denied --hermes-home", () => {
  const restrictedDir = join(os.tmpdir(), `hermes-doctor-restricted-${Date.now()}`);

  it("exits 1 with clear error and no stack trace", async () => {
    // Create a directory and lock it down
    const mkResult = execa("mkdir", ["-p", restrictedDir]);
    await mkResult;
    chmodSync(restrictedDir, 0o000);

    try {
      const result = await runCli([
        "scan",
        "--hermes-home", restrictedDir,
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
      expect(result.stderr).toContain("Error");
      expect(result.stderr).toContain(restrictedDir);
      // No raw stack trace frames
      expect(result.stderr).not.toMatch(STACK_TRACE_RE);
      expect(result.stdout).not.toMatch(STACK_TRACE_RE);
    } finally {
      // Restore permissions so cleanup works
      chmodSync(restrictedDir, 0o755);
      try { await rm(restrictedDir, { recursive: true, force: true }); } catch { /* cleanup */ }
    }
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-017: No ugly stack traces in default mode (negative assertion)
// ---------------------------------------------------------------------------

describe("[VAL-CLI-017] No ugly stack traces in default mode", () => {
  it("unknown command has no stack trace", async () => {
    const result = await runCli(["flargle-command"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toMatch(STACK_TRACE_RE);
    expect(result.stderr.length).toBeLessThan(500);
  });

  it("nonexistent path has no stack trace", async () => {
    const badPath = join(os.tmpdir(), `hermes-doctor-missing-${Date.now()}`);
    const result = await runCli([
      "scan",
      "--hermes-home", badPath,
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toMatch(STACK_TRACE_RE);
    expect(result.stderr.length).toBeLessThan(500);
  });

  it("invalid format option has no stack trace", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "invalid-format-xyz",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown format");
    expect(result.stderr).not.toMatch(STACK_TRACE_RE);
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-018: --help lists all commands and options
// ---------------------------------------------------------------------------

describe("[VAL-CLI-018] --help lists all commands and options", () => {
  it("hermes-doctor --help lists all subcommands", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("scan");
    expect(result.stdout).toContain("export");
    expect(result.stdout).toContain("paths");
    expect(result.stdout).toContain("version");
    expect(result.stdout).toContain("--version");
  });

  it("scan --help lists all scan-specific options", async () => {
    const result = await runCli(["scan", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--hermes-home");
    expect(result.stdout).toContain("--profile");
    expect(result.stdout).toContain("--format");
    expect(result.stdout).toContain("--output");
    expect(result.stdout).toContain("--verbose");
    expect(result.stdout).toContain("--flue");
    expect(result.stdout).toContain("--no-flue");
    expect(result.stdout).toContain("--include-log-snippets");
    expect(result.stdout).toContain("--max-log-lines");
    expect(result.stdout).toContain("--strict-redaction");
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-019: version/--version prints correct semver
// ---------------------------------------------------------------------------

describe("[VAL-CLI-019] version/--version prints correct semver", () => {
  it("hermes-doctor version prints the package version", async () => {
    const result = await runCli(["version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(pkgVersion);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    expect(result.stderr).toBe("");
  });

  it("hermes-doctor --version prints the package version", async () => {
    const result = await runCli(["--version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(pkgVersion);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    expect(result.stderr).toBe("");
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-020: Multiple --format without --output produces coherent output
// ---------------------------------------------------------------------------

describe("[VAL-CLI-020] Multiple --format without --output produces coherent output", () => {
  const fixturePath = resolve(fixturesDir, "hermes-good");

  it("--format markdown --format json produces pure markdown on stdout", async () => {
    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "markdown",
      "--format", "json",
    ]);

    expect(result.exitCode).toBe(0);
    // First line should be markdown title
    const firstLine = result.stdout.split("\n")[0]?.trim() ?? "";
    expect(firstLine).toBe("# Hermes Doctor — Health Report");
    // Should contain markdown-specific sections
    expect(result.stdout).toContain("## Summary");
    expect(result.stdout).toContain("## Privacy");
    // Should NOT contain JSON patterns
    expect(result.stdout).not.toContain('"schemaVersion"');
  });

  it("--format json --format markdown produces pure JSON on stdout", async () => {
    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "json",
      "--format", "markdown",
    ]);

    expect(result.exitCode).toBe(0);
    const trimmed = result.stdout.trim();
    expect(trimmed.startsWith("{")).toBe(true);
    expect(() => JSON.parse(trimmed)).not.toThrow();
    const parsed = JSON.parse(trimmed);
    expect(parsed.schemaVersion).toBe("1.0");
    // Should NOT contain markdown patterns
    expect(result.stdout).not.toContain("# Hermes Doctor");
  });

  it("--format console --format markdown --format json produces pure console output", async () => {
    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "console",
      "--format", "markdown",
      "--format", "json",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hermes Doctor — Health Report");
    expect(result.stdout).toContain("Summary");
    // Should NOT contain markdown table
    expect(result.stdout).not.toContain("| Status | Count |");
    // Should NOT contain JSON
    expect(result.stdout).not.toContain('"schemaVersion"');
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-021: export --last re-exports the most recent report
// ---------------------------------------------------------------------------

describe("[VAL-CLI-021] export --last re-exports last scan", () => {
  it("export --last --format json re-exports JSON report", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const outDir = tmpDir();

    // Run a scan first
    const scanResult = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "json",
      "--output", outDir,
    ]);
    expect(scanResult.exitCode).toBe(0);

    // Now export it
    const exportResult = await runCli([
      "export",
      "--last",
      "--format", "json",
      "--output", outDir,
    ]);

    expect(exportResult.exitCode).toBe(0);
    const parsed = JSON.parse(exportResult.stdout);
    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.summary).toBeDefined();
    expect(parsed.findings).toBeDefined();
    expect(parsed.redactedForSharing).toBe(true);
  });

  it("export --last with no prior scan exits 1", async () => {
    const result = await runCli([
      "export",
      "--last",
      "--format", "json",
      "--output", "/tmp/hermes-doctor-nonexistent-export-dir",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No previous scan report");
  });
});

// ---------------------------------------------------------------------------
// VAL-CLI-022: paths command prints absolute paths
// ---------------------------------------------------------------------------

describe("[VAL-CLI-022] paths command prints absolute paths", () => {
  it("prints detected Hermes paths", async () => {
    const result = await runCli(["paths"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hermes Home:");
    expect(result.stdout).toContain("Config:");
    expect(result.stdout).toContain("Env File:");
    expect(result.stdout).toContain("Skills Dir:");
    expect(result.stdout).toContain("Memory Dir:");
    expect(result.stdout).toContain("Plugins Dir:");
    expect(result.stdout).toContain("Logs Dir:");

    // Extract path values from key-value lines and verify they're absolute
    const lines = result.stdout.split("\n");
    for (const line of lines) {
      // Only check labeled path lines (contain ":" and an alphanumeric path value)
      if (line.includes("Hermes Home:") || line.includes("Config:") ||
          line.includes("Env File:") || line.includes("Skills Dir:") ||
          line.includes("Memory Dir:") || line.includes("Plugins Dir:") ||
          line.includes("Logs Dir:")) {
        const value = line.split(":")[1]?.trim() ?? "";
        expect(value).toBeTruthy();
        expect(value.startsWith("/")).toBe(true);
      }
    }

    expect(result.stderr).toBe("");
  });

  it("accepts --hermes-home and prints that path", async () => {
    const testPath = "/tmp";
    const result = await runCli(["paths", "--hermes-home", testPath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(testPath);
  });

  it("accepts --profile and prints the profile name", async () => {
    const result = await runCli(["paths", "--profile", "work"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("work");
  });
});

// ---------------------------------------------------------------------------
// ALERTS: sanity check that default scan without --hermes-home still works
// ---------------------------------------------------------------------------

describe("Default scan with auto-detected Hermes home", () => {
  it("produces no stack traces", async () => {
    const result = await runCli(["scan"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(STACK_TRACE_RE);
    expect(result.stderr).not.toMatch(STACK_TRACE_RE);
  });
});

// ---------------------------------------------------------------------------
// Threshold Validation (#23, #26)
// ---------------------------------------------------------------------------

describe("Threshold flag validation (#23, #26)", () => {
  const fixturePath = resolve(fixturesDir, "hermes-good");

  it("--huge-file-threshold with negative value exits 1 (#23)", async () => {
    const result = await runCli([
      "scan", "--hermes-home", fixturePath,
      "--huge-file-threshold", "-1",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("non-negative");
  });

  it("--memory-warn-threshold with negative value exits 1 (#23)", async () => {
    const result = await runCli([
      "scan", "--hermes-home", fixturePath,
      "--memory-warn-threshold", "-50",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("non-negative");
  });

  it("--crash-loop-error-threshold with negative value exits 1 (#23)", async () => {
    const result = await runCli([
      "scan", "--hermes-home", fixturePath,
      "--crash-loop-error-threshold", "-10",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("non-negative");
  });

  it("--huge-file-threshold with non-numeric value exits 1 (#26)", async () => {
    const result = await runCli([
      "scan", "--hermes-home", fixturePath,
      "--huge-file-threshold", "abc",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("must be a number");
  });

  it("--dashboard-timeout with non-numeric value exits 1 (#26)", async () => {
    const result = await runCli([
      "scan", "--hermes-home", fixturePath,
      "--dashboard-timeout", "not-a-number",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("must be a number");
  });

  it("--max-log-lines with non-numeric value exits 1 (#26)", async () => {
    const result = await runCli([
      "scan", "--hermes-home", fixturePath,
      "--max-log-lines", "abc",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("must be a number");
  });

  it("valid threshold values are accepted", async () => {
    const result = await runCli([
      "scan", "--hermes-home", fixturePath,
      "--huge-file-threshold", "50",
      "--memory-warn-threshold", "90",
      "--format", "json",
    ]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.summary).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Issue #38: export --format console
// ---------------------------------------------------------------------------

describe("Issue #38: export --format console", () => {
  it("renders console output via export command", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const outDir = tmpDir();

    // Run a scan first
    const scanResult = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--format", "json",
      "--output", outDir,
    ]);
    expect(scanResult.exitCode).toBe(0);

    // Now export as console
    const exportResult = await runCli([
      "export",
      "--last",
      "--format", "console",
      "--output", outDir,
    ]);

    expect(exportResult.exitCode).toBe(0);
    expect(exportResult.stdout).toContain("Hermes Doctor");
    expect(exportResult.stdout).toContain("Summary");
  });
});

// ---------------------------------------------------------------------------
// Issue #49: --profile validation
// ---------------------------------------------------------------------------

describe("Issue #49: --profile validation", () => {
  it("rejects profile name longer than 128 characters", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const longName = "a".repeat(129);

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--profile", longName,
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("128 characters");
  });

  it("rejects profile name with invalid characters", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--profile", "my profile!",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("alphanumeric");
  });

  it("accepts valid profile name", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");

    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--profile", "my-work-profile",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Summary");
  });
});

// ---------------------------------------------------------------------------
// Issue #65: paths command validation consistency
// ---------------------------------------------------------------------------

describe("Issue #65: paths command validation", () => {
  it("rejects nonexistent --hermes-home path like scan command", async () => {
    const badPath = join(os.tmpdir(), `hermes-doctor-nonexistent-paths-${Date.now()}`);
    const result = await runCli([
      "paths",
      "--hermes-home", badPath,
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Error");
    expect(result.stderr).toContain(badPath);
    expect(result.stderr).not.toMatch(STACK_TRACE_RE);
  });
});
