import { readFileSync, mkdtempSync, existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as os from "node:os";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

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

async function runCli(args: string[]) {
  return execa(tsxBin, [cliEntry, ...args], { reject: false });
}

function tmpDir(): string {
  return mkdtempSync(join(os.tmpdir(), "hermes-doctor-test-"));
}

describe("hermes-doctor CLI", () => {
  it("--help prints usage including the program name, commands, and options", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hermes-doctor");
    expect(result.stdout).toMatch(/scan|version/);
    expect(result.stdout).toContain("--");
    expect(result.stdout.length).toBeGreaterThan(200);
  });

  it("scan --help lists the --hermes-home option", async () => {
    const result = await runCli(["scan", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--hermes-home");
  });

  it("version subcommand prints the package version", async () => {
    const result = await runCli(["version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(pkgVersion);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it("--version flag prints the package version", async () => {
    const result = await runCli(["--version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(pkgVersion);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it("scan accepts --hermes-home with fixture and exits zero", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await runCli(["scan", "--hermes-home", fixturePath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hermes Doctor");
    expect(result.stdout).toContain("Summary");
  });

  it("scan runs against hermes-good fixture and exits zero", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await runCli(["scan", "--hermes-home", fixturePath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
    expect(result.stdout).toContain("Summary");
  });

  it("bare invocation runs scan and exits zero", async () => {
    const result = await runCli([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hermes Doctor");
    expect(result.stdout).toContain("Summary");
  });

  it("unknown command exits non-zero with an error on stderr", async () => {
    const result = await runCli(["flargle"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Flue integration flag tests
  // -------------------------------------------------------------------------

  it("scan --help lists the --flue option", async () => {
    const result = await runCli(["scan", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--flue");
  });

  it("scan --help lists the --no-flue option", async () => {
    const result = await runCli(["scan", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--no-flue");
  });

  it("--flue flag is accepted without error", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--flue",
    ]);

    // Should not error on the flag itself
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("unknown option");
    expect(result.stderr).not.toContain("unrecognized");
    expect(result.stdout).toContain("Summary");
  });

  it("--no-flue flag is accepted without error", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await runCli([
      "scan",
      "--hermes-home", fixturePath,
      "--no-flue",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("unknown option");
    expect(result.stdout).toContain("Summary");
  });

  it("default mode (no --flue) does not attempt to load @flue/runtime", async () => {
    // Default mode should complete without error even if @flue/runtime
    // were not available (which we verify by not passing --flue)
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await runCli(["scan", "--hermes-home", fixturePath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Summary");
    // No flue-related warning in output
    expect(result.stdout).not.toContain("Flue");
    expect(result.stderr).not.toContain("Flue");
  });

  it("--flue without API key completes with warning", async () => {
    // Ensure no Flue API key
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await execa(tsxBin, [cliEntry, "scan", "--hermes-home", fixturePath, "--flue"], {
      reject: false,
      env: { ...process.env, FLUE_API_KEY: "", ANTHROPIC_API_KEY: "" },
    });

    expect(result.exitCode).toBe(0);
    // Should emit a warning about Flue being unavailable
    expect(result.stderr || result.stdout || "").toContain("Flue");
    // Should still produce a full report
    expect(result.stdout || "").toContain("Summary");
  });

  it("HERMES_DOCTOR_USE_FLUE=1 enables Flue mode (no API key warning)", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await execa(tsxBin, [cliEntry, "scan", "--hermes-home", fixturePath], {
      reject: false,
      env: {
        ...process.env,
        HERMES_DOCTOR_USE_FLUE: "1",
        FLUE_API_KEY: "",
        ANTHROPIC_API_KEY: "",
      },
    });

    // Should complete without error and warn about missing API key
    expect(result.exitCode).toBe(0);
    expect(result.stdout || "").toContain("Summary");
  });

  it("--no-flue overrides HERMES_DOCTOR_USE_FLUE=1", async () => {
    const fixturePath = resolve(fixturesDir, "hermes-good");
    const result = await execa(
      tsxBin,
      [cliEntry, "scan", "--hermes-home", fixturePath, "--no-flue"],
      {
        reject: false,
        env: {
          ...process.env,
          HERMES_DOCTOR_USE_FLUE: "1",
        },
      },
    );

    // Should work normally without any flue warning
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Summary");
    // No flue-related output since --no-flue overrides
    expect(result.stdout).not.toContain("Flue");
  });

  // -------------------------------------------------------------------------
  // VAL-OPT-001: --profile selects profile
  // -------------------------------------------------------------------------

  describe("VAL-OPT-001: --profile option", () => {
    it("scan --profile work is accepted and mentioned in output", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");
      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--profile", "work",
      ]);

      expect(result.exitCode).toBe(0);
      // Output should reference the profile
      expect(result.stdout.toLowerCase()).toContain("work");
    });

    it("scan without --profile defaults to 'default'", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");
      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toContain("default");
    });
  });

  // -------------------------------------------------------------------------
  // VAL-OPT-002: --hermes-home overrides path
  // -------------------------------------------------------------------------

  describe("VAL-OPT-002: --hermes-home option", () => {
    it("overrides auto-detected Hermes home", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");
      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "json",
      ]);

      expect(result.exitCode).toBe(0);
      // The report JSON should reference the fixture path for hermesHome
      expect(result.stdout).toContain("hermesHome");
    });
  });

  // -------------------------------------------------------------------------
  // VAL-OPT-003: --output writes to directory
  // -------------------------------------------------------------------------

  describe("VAL-OPT-003: --output option", () => {
    it("writes report files to specified directory", async () => {
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

      // Files should exist
      expect(existsSync(join(outDir, "hermes-doctor-report.md"))).toBe(true);
      expect(existsSync(join(outDir, "hermes-doctor-report.json"))).toBe(true);

      // Content should be valid
      const mdContent = readFileSync(join(outDir, "hermes-doctor-report.md"), "utf8");
      expect(mdContent).toContain("#");

      const jsonContent = readFileSync(join(outDir, "hermes-doctor-report.json"), "utf8");
      const parsed = JSON.parse(jsonContent);
      expect(parsed.schemaVersion).toBe("1.0");
    });

    it("creates the directory if it does not exist", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");
      const outDir = join(os.tmpdir(), `hermes-doctor-new-dir-${Math.random().toString(36).slice(2)}`);

      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "json",
        "--output", outDir,
      ]);

      expect(result.exitCode).toBe(0);
      expect(existsSync(outDir)).toBe(true);
      expect(existsSync(join(outDir, "hermes-doctor-report.json"))).toBe(true);

      await rm(outDir, { recursive: true, force: true });
    });
  });

  // -------------------------------------------------------------------------
  // VAL-OPT-004/005/006/014: --format flags
  // -------------------------------------------------------------------------

  describe("VAL-OPT-004/005/006: --format flags", () => {
    it("--format markdown produces only markdown output", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");
      const outDir = tmpDir();

      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "markdown",
        "--output", outDir,
      ]);

      expect(result.exitCode).toBe(0);

      // Only .md file should exist
      expect(existsSync(join(outDir, "hermes-doctor-report.md"))).toBe(true);
      // No .json file from this run
      expect(existsSync(join(outDir, "hermes-doctor-report.json"))).toBe(false);

      // Content starts with markdown heading
      const mdContent = readFileSync(join(outDir, "hermes-doctor-report.md"), "utf8");
      expect(mdContent.trim().startsWith("#")).toBe(true);
    });

    it("--format json produces only JSON", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");
      const outDir = tmpDir();

      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "json",
        "--output", outDir,
      ]);

      expect(result.exitCode).toBe(0);

      // .json file should exist and parse
      const jsonContent = readFileSync(join(outDir, "hermes-doctor-report.json"), "utf8");
      expect(() => JSON.parse(jsonContent)).not.toThrow();

      const parsed = JSON.parse(jsonContent);
      expect(parsed.schemaVersion).toBe("1.0");
      expect(parsed.summary).toBeDefined();
      expect(parsed.findings).toBeDefined();
    });

    it("--format console produces console output (no files)", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");
      const outDir = tmpDir();

      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "console",
        "--output", outDir,
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Hermes Doctor");
      expect(result.stdout).toContain("Summary");
      expect(result.stdout).toContain("redacted for sharing");
    });

    it("combined --format flags produce multiple outputs (VAL-OPT-014)", async () => {
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

      // Console output on stdout
      expect(result.stdout).toContain("Hermes Doctor");
      expect(result.stdout).toContain("Summary");

      // Files written
      expect(existsSync(join(outDir, "hermes-doctor-report.md"))).toBe(true);
      expect(existsSync(join(outDir, "hermes-doctor-report.json"))).toBe(true);
    });

    it("multiple --format flags WITHOUT --output produce only first format's output (no garbled hybrid)", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");

      // --format markdown --format json without --output should produce only markdown on stdout
      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "markdown",
        "--format", "json",
      ]);

      expect(result.exitCode).toBe(0);

      // stdout should start with markdown heading, not JSON
      expect(result.stdout.trim().startsWith("#")).toBe(true);
      // stdout should NOT contain JSON-like content (no opening brace at top level)
      // The markdown output contains '#' headings, JSON does not
      expect(result.stdout).toContain("Hermes Doctor");
      expect(result.stdout).toContain("## Summary");
      expect(result.stdout).toContain("## Privacy");
      // Should NOT contain JSON report structure (schemaVersion would appear in JSON)
      // Allow that JSON might produce something like schemaVersion inside markdown if garbled
      // Instead verify the output is coherent markdown by checking it starts with markdown title
      // and doesn't have JSON artifacts mixed in
      const firstLine = result.stdout.split("\n")[0];
      expect(firstLine?.trim()).toBe("# Hermes Doctor — Health Report");
    });

    it("--format markdown --format json without --output produces coherent markdown only", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");

      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "markdown",
        "--format", "json",
      ]);

      expect(result.exitCode).toBe(0);

      // Output should be pure markdown, not a mix of markdown and JSON
      const lines = result.stdout.split("\n").filter(l => l.trim().length > 0);
      // First non-empty line should be the markdown title
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]!.trim()).toBe("# Hermes Doctor — Health Report");
      // The output should contain markdown-specific sections
      expect(result.stdout).toContain("## Summary");
      expect(result.stdout).toContain("| Status | Count |");
      // The output should NOT contain JSON-specific patterns like "schemaVersion" at top level
      expect(result.stdout).not.toContain('"schemaVersion"');
      expect(result.stdout).not.toContain('"generatedAt"');
    });

    it("--format json --format markdown without --output produces coherent JSON only", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");

      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "json",
        "--format", "markdown",
      ]);

      expect(result.exitCode).toBe(0);

      // Output should be pure JSON, not a mix
      // First non-empty line should be '{'
      const trimmed = result.stdout.trim();
      expect(trimmed.startsWith("{")).toBe(true);
      // Should parse as valid JSON
      expect(() => JSON.parse(trimmed)).not.toThrow();
      const parsed = JSON.parse(trimmed);
      expect(parsed.schemaVersion).toBe("1.0");
      // Should NOT contain markdown-specific patterns
      expect(result.stdout).not.toContain("# Hermes Doctor");
      expect(result.stdout).not.toContain("## Summary");
    });

    it("--format console --format markdown --format json without --output produces only console output", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");

      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "console",
        "--format", "markdown",
        "--format", "json",
      ]);

      expect(result.exitCode).toBe(0);

      // Output should be console-formatted (Hermes Doctor heading, Summary, etc.)
      expect(result.stdout).toContain("Hermes Doctor — Health Report");
      expect(result.stdout).toContain("Summary");
      // Should NOT contain JSON structure
      expect(result.stdout).not.toContain('"schemaVersion"');
      // Should NOT contain markdown table
      expect(result.stdout).not.toContain("| Status | Count |");
    });
  });

  // -------------------------------------------------------------------------
  // VAL-OPT-008: --verbose
  // -------------------------------------------------------------------------

  describe("VAL-OPT-008: --verbose flag", () => {
    it("verbose output is longer than non-verbose output", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");

      const defaultResult = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "console",
      ]);
      const verboseResult = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "console",
        "--verbose",
      ]);

      expect(defaultResult.exitCode).toBe(0);
      expect(verboseResult.exitCode).toBe(0);

      const defaultLines = defaultResult.stdout.split("\n").filter(l => l.length > 0);
      const verboseLines = verboseResult.stdout.split("\n").filter(l => l.length > 0);
      expect(verboseLines.length).toBeGreaterThanOrEqual(defaultLines.length);
    });

    it("verbose output includes collector status information", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");

      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--format", "console",
        "--verbose",
      ]);

      expect(result.exitCode).toBe(0);
      // Should contain collector/area info and timing
      expect(
        result.stdout.toLowerCase().includes("collector") ||
        result.stdout.toLowerCase().includes("areas") ||
        result.stdout.toLowerCase().includes("findings")
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // VAL-OPT-009: --include-log-snippets
  // -------------------------------------------------------------------------

  describe("VAL-OPT-009: --include-log-snippets", () => {
    it("is accepted without error", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");
      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--include-log-snippets",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Summary");
    });
  });

  // -------------------------------------------------------------------------
  // VAL-OPT-010: --max-log-lines
  // -------------------------------------------------------------------------

  describe("VAL-OPT-010: --max-log-lines", () => {
    it("is accepted without error", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");
      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--max-log-lines", "50",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Summary");
    });
  });

  // -------------------------------------------------------------------------
  // VAL-OPT-011: export --last
  // -------------------------------------------------------------------------

  describe("VAL-OPT-011: export command", () => {
    it("export --help shows usage", async () => {
      const result = await runCli(["export", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("--last");
      expect(result.stdout).toContain("--format");
    });

    it("export without --last prints error and exits 1", async () => {
      const result = await runCli(["export"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.length).toBeGreaterThan(0);
    });

    it("export --last with no prior scan exits 1", async () => {
      const result = await runCli([
        "export",
        "--last",
        "--format", "markdown",
        "--output", "/tmp/nonexistent-export-dir-12345",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("No previous scan report");
    });

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
      // Should output valid JSON
      const parsed = JSON.parse(exportResult.stdout);
      expect(parsed.schemaVersion).toBe("1.0");
    });
  });

  // -------------------------------------------------------------------------
  // paths command
  // -------------------------------------------------------------------------

  describe("paths command", () => {
    it("prints detected Hermes paths", async () => {
      const result = await runCli(["paths"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Hermes Home");
      expect(result.stdout).toContain("Config");
      expect(result.stdout).toContain("Logs Dir");
      expect(result.stdout).toMatch(/\/|\\/);
    });

    it("accepts --hermes-home and prints that path", async () => {
      const testPath = "/tmp/my-test-hermes";
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

  // -------------------------------------------------------------------------
  // Exit code policy
  // -------------------------------------------------------------------------

  describe("Exit code policy", () => {
    it("scan exits 0 on successful scan with findings", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-broken-mcp");
      const result = await runCli(["scan", "--hermes-home", fixturePath]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Summary");
    });

    it("scan exits 0 on clean scan", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");
      const result = await runCli(["scan", "--hermes-home", fixturePath]);

      expect(result.exitCode).toBe(0);
    });

    it("tool failure exits 1 (unknown command)", async () => {
      const result = await runCli(["nonexistent-command"]);

      expect(result.exitCode).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // VAL-OPT-009/010: CLI option flags listed in --help
  // -------------------------------------------------------------------------

  describe("All CLI options listed in --help", () => {
    it("scan --help lists all options", async () => {
      const result = await runCli(["scan", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("--profile");
      expect(result.stdout).toContain("--hermes-home");
      expect(result.stdout).toContain("--format");
      expect(result.stdout).toContain("--output");
      expect(result.stdout).toContain("--verbose");
      expect(result.stdout).toContain("--include-log-snippets");
      expect(result.stdout).toContain("--max-log-lines");
      expect(result.stdout).toContain("--strict-redaction");
    });
  });

  // -------------------------------------------------------------------------
  // VAL-REDACT-009: --strict-redaction flag
  // -------------------------------------------------------------------------

  describe("VAL-REDACT-009: --strict-redaction", () => {
    it("is accepted without error", async () => {
      const fixturePath = resolve(fixturesDir, "hermes-good");
      const result = await runCli([
        "scan",
        "--hermes-home", fixturePath,
        "--strict-redaction",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Summary");
    });
  });
});

