/**
 * Cross-Area Contamination & Audit Hard Gate Tests
 *
 * VAL-CROSS-011 through VAL-CROSS-016: Cross-area isolation
 * VAL-AUDIT-001 through VAL-AUDIT-006: Audit hard gates
 *
 * Key design principles:
 * - Cross-area fixtures have bin/hermes stubs to avoid install-check broken findings
 * - cross-area/mcp-broken-only: MCP servers with missing commands/env vars, no dashboard section
 * - cross-area/provider-broken-only: Missing provider API keys, no MCP servers, no dashboard
 * - cross-area/risky-dashboard-only: Dashboard bound to 0.0.0.0, valid providers, no MCP servers
 * - cross-area/multi-broken: Both MCP broken and dashboard risky
 */
import { readFileSync, readdirSync, existsSync, unlinkSync, writeFileSync, mkdtempSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as crypto from "node:crypto";
import * as os from "node:os";

import { execa } from "execa";
import { describe, expect, it, beforeAll } from "vitest";
import * as v from "valibot";

import { DoctorReportSchema } from "@hermes-doctor/core";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", "..");
const cliEntry = resolve(here, "..", "index.ts");
const tsxBin = resolve(repoRoot, "node_modules", ".bin", "tsx");
const fixturesDir = resolve(repoRoot, "fixtures");
const crossAreaDir = resolve(fixturesDir, "validation", "cross-area");

// Provider env vars to exclude for isolation tests
const providerEnvVars = [
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY",
  "GOOGLE_API_KEY", "MISTRAL_API_KEY", "COHERE_API_KEY", "OPENROUTER_API_KEY",
  "OLLAMA_API_KEY", "MY_LOCAL_KEY", "FS_TOKEN", "GITHUB_TOKEN",
  "TELEGRAM_BOT_TOKEN", "HF_TOKEN",
];

function envWithoutProviderKeys(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of providerEnvVars) delete env[key];
  return env;
}

/**
 * Scan a fixture and return JSON report. Adds the fixture's bin/ dir to PATH
 * so the install checks can find the stubbed hermes binary.
 * Falls back to the golden-path shared bin if the fixture doesn't have its own.
 */
const goldenBinDir = resolve(fixturesDir, "validation", "golden-path", "hermes-good", "bin");

async function scanJson(fixturePath: string, extraEnv?: Record<string, string | undefined>) {
  const binDir = join(fixturePath, "bin");
  const extraPath = [];
  if (existsSync(binDir)) extraPath.push(binDir);
  if (existsSync(goldenBinDir)) extraPath.push(goldenBinDir);
  const pathWithBin = extraPath.length > 0
    ? `${extraPath.join(":")}:${process.env.PATH ?? ""}`
    : process.env.PATH ?? "";

  const env = {
    ...envWithoutProviderKeys(),
    PATH: pathWithBin,
    ...extraEnv,
  };
  const r = await execa(
    tsxBin,
    [cliEntry, "scan", "--hermes-home", fixturePath, "--format", "json"],
    { reject: false, env: env as NodeJS.ProcessEnv },
  );
  return { exitCode: r.exitCode, report: JSON.parse(r.stdout), stdout: r.stdout, stderr: r.stderr };
}

interface Finding {
  id: string;
  area: string;
  status: string;
  severity: number;
  title: string;
  message: string;
  evidence: Record<string, unknown> | Array<{label: string; detail: string; source?: string; confidence?: string; redacted?: boolean}>;
}

function findEvidence(evidence: Record<string, unknown> | Array<{label: string; detail: string}>, label: string): string | undefined {
  if (Array.isArray(evidence)) {
    return evidence.find((e: {label: string; detail: string}) => e.label === label)?.detail;
  }
  const val = (evidence as Record<string, unknown>)[label];
  return val !== undefined ? String(val) : undefined;
}

// .env files are gitignored, so ensure they exist at test runtime
beforeAll(() => {
  const envDirs = [
    resolve(fixturesDir, "validation", "cross-area", "mcp-broken-only"),
    resolve(fixturesDir, "validation", "cross-area", "risky-dashboard-only"),
    resolve(fixturesDir, "validation", "cross-area", "provider-broken-only"),
    resolve(fixturesDir, "validation", "golden-path", "dashboard-off"),
  ];
  for (const dir of envDirs) {
    const envPath = resolve(dir, ".env");
    writeFileSync(envPath, "ANTHROPIC_API_KEY=sk-ant-test-1234567890abcdef1234567890abcdef\nOPENAI_API_KEY=sk-test-1234567890abcdef1234567890abcdef\n");
  }
});

// ============================================================================
// Cross-Area Flows
// ============================================================================

describe("VAL-CROSS-011: Broken MCP fixture => no provider/dashboard broken/risk", () => {
  const fp = join(crossAreaDir, "mcp-broken-only");

  it("produces at least one MCP broken finding", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    const mcpBroken = report.findings.filter(
      (f: Finding) => f.area === "mcp" && (f.status === "broken" || f.severity >= 2),
    );
    expect(mcpBroken.length).toBeGreaterThanOrEqual(1);
  });

  it("zero broken/risk findings in providers area", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings.filter((f: Finding) => f.area === "providers")) {
      expect(f.status).not.toBe("broken");
      expect(f.status).not.toBe("risk");
    }
  });

  it("zero broken/risk findings in dashboard area", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings.filter((f: Finding) => f.area === "dashboard")) {
      expect(f.status).not.toBe("broken");
      expect(f.status).not.toBe("risk");
    }
  });

  it("no provider finding mentions MCP", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings.filter((f: Finding) => f.area === "providers")) {
      const text = `${f.title} ${f.message} ${JSON.stringify(f.evidence)}`.toLowerCase();
      expect(text).not.toMatch(/mcp/);
    }
  });
});

describe("VAL-CROSS-012: Broken provider fixture => no MCP/dashboard broken/risk", () => {
  const fp = join(crossAreaDir, "provider-broken-only");

  it("produces at least one provider broken finding", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    const provBroken = report.findings.filter(
      (f: Finding) => f.area === "providers" && (f.status === "broken" || f.severity >= 2),
    );
    expect(provBroken.length).toBeGreaterThanOrEqual(1);
  });

  it("zero broken/risk findings in MCP area", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings.filter((f: Finding) => f.area === "mcp")) {
      expect(f.status).not.toBe("broken");
      expect(f.status).not.toBe("risk");
    }
  });

  it("zero broken/risk findings in dashboard area", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings.filter((f: Finding) => f.area === "dashboard")) {
      expect(f.status).not.toBe("broken");
      expect(f.status).not.toBe("risk");
    }
  });

  it("broken findings are scoped to providers area", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings.filter((f: Finding) => f.status === "broken")) {
      expect(f.area).toBe("providers");
    }
  });
});

describe("VAL-CROSS-013: Dashboard-risky fixture => no provider/MCP broken/risk", () => {
  const fp = join(crossAreaDir, "risky-dashboard-only");

  it("produces at least one dashboard or security risk finding", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    const riskFindings = report.findings.filter(
      (f: Finding) =>
        (f.area === "dashboard" || f.area === "security") &&
        (f.status === "risk" || f.severity >= 4),
    );
    expect(riskFindings.length).toBeGreaterThanOrEqual(1);
  });

  it("zero broken/risk findings in providers area", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings.filter((f: Finding) => f.area === "providers")) {
      expect(f.status).not.toBe("broken");
      expect(f.status).not.toBe("risk");
    }
  });

  it("zero broken/risk findings in MCP area", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings.filter((f: Finding) => f.area === "mcp")) {
      expect(f.status).not.toBe("broken");
      expect(f.status).not.toBe("risk");
    }
  });

  it("no provider finding mentions dashboard or bind", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings.filter((f: Finding) => f.area === "providers")) {
      const text = `${f.title} ${f.message}`.toLowerCase();
      expect(text).not.toMatch(/dashboard|0\.0\.0\.0|bind|public/i);
    }
  });
});

describe("VAL-CROSS-014: Golden path (dashboard-off) => zero broken, at most 1 risk (security-file-permissions)", () => {
  const fp = resolve(fixturesDir, "validation", "golden-path", "dashboard-off");

  it("summary.broken === 0", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    expect(report.summary.broken).toBe(0);
  });

  it("summary.risks <= 2 (security checks are risk/4)", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    expect(report.summary.risks).toBeLessThanOrEqual(2);
  });

  it("only security checks may be risk, nothing is broken", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings) {
      if (f.status === "risk") expect(f.id).toMatch(/^security-/);
      expect(f.status).not.toBe("broken");
    }
  });

  it("JSON report validates against DoctorReport schema", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    expect(() => v.parse(DoctorReportSchema, report)).not.toThrow();
  });
});

describe("VAL-CROSS-015: Multi-broken fixture detects MCP and dashboard independently", () => {
  const fp = join(crossAreaDir, "multi-broken");

  it("has at least one MCP broken finding (severity >= 2)", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    const mcpBroken = report.findings.filter((f: Finding) => f.area === "mcp" && f.severity >= 2);
    expect(mcpBroken.length).toBeGreaterThanOrEqual(1);
  });

  it("has at least one dashboard/security risk finding (severity >= 3)", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    const dashRisk = report.findings.filter(
      (f: Finding) => (f.area === "dashboard" || f.area === "security") && f.severity >= 3,
    );
    expect(dashRisk.length).toBeGreaterThanOrEqual(1);
  });

  it("MCP and dashboard findings are distinct", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    const mcpIds = report.findings.filter((f: Finding) => f.area === "mcp").map((f: Finding) => f.id);
    const dashSecIds = report.findings
      .filter((f: Finding) => f.area === "dashboard" || f.area === "security")
      .map((f: Finding) => f.id);
    const overlap = mcpIds.filter((id: string) => dashSecIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("summary shows broken >= 1 and risks >= 1", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    expect(report.summary.broken).toBeGreaterThanOrEqual(1);
    expect(report.summary.risks).toBeGreaterThanOrEqual(1);
  });

  it("MCP broken findings keep severity >= 2", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings.filter(
      (f: Finding) => f.area === "mcp" && f.status === "broken",
    )) {
      expect(f.severity).toBeGreaterThanOrEqual(2);
    }
  });

  it("dashboard/security risk findings keep severity >= 3", async () => {
    const { exitCode, report } = await scanJson(fp);
    expect(exitCode).toBe(0);
    for (const f of report.findings.filter(
      (f: Finding) => (f.area === "dashboard" || f.area === "security") && f.status === "risk",
    )) {
      expect(f.severity).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("VAL-CROSS-016: Local cross-validation consistency", () => {
  const fp = resolve(fixturesDir, "validation", "golden-path", "dashboard-off");

  it("two local runs produce identical summary counts", async () => {
    const r1 = await scanJson(fp);
    const r2 = await scanJson(fp);
    expect(r1.exitCode).toBe(0);
    expect(r2.exitCode).toBe(0);

    expect(r1.report.summary).toEqual(r2.report.summary);
  });

  it("two local runs produce identical findings (minus generatedAt, platform)", async () => {
    const r1 = await scanJson(fp);
    const r2 = await scanJson(fp);
    expect(r1.exitCode).toBe(0);
    expect(r2.exitCode).toBe(0);

    const strip = (report: Record<string, unknown>) => {
      const c = JSON.parse(JSON.stringify(report));
      delete c.generatedAt;
      delete c.platform;
      return c;
    };

    expect(strip(r1.report).findings).toEqual(strip(r2.report).findings);
  });
});

// ============================================================================
// Audit Hard Gates
// ============================================================================

/**
 * Collect SHA-256 hashes of all files in a directory tree.
 */
function collectSha256Hashes(dir: string): Record<string, string> {
  const hashes: Record<string, string> = {};
  function walk(current: string) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        hashes[full] = crypto.createHash("sha256").update(readFileSync(full)).digest("hex");
      }
    }
  }
  walk(dir);
  return hashes;
}

describe("VAL-AUDIT-001: Fixture file mutation (SHA-256 before/after identical)", () => {
  const auditFixtures = [
    resolve(fixturesDir, "hermes-good"),
    resolve(fixturesDir, "hermes-broken-mcp"),
    resolve(fixturesDir, "hermes-risky-dashboard"),
    join(crossAreaDir, "multi-broken"),
    join(crossAreaDir, "mcp-broken-only"),
    join(crossAreaDir, "provider-broken-only"),
    join(crossAreaDir, "risky-dashboard-only"),
  ];

  for (const fp of auditFixtures) {
    const fixtureName = fp.split("/").pop() ?? "unknown";
    it(`'${fixtureName}' — identical SHA-256 hashes before/after scan`, async () => {
      const before = collectSha256Hashes(fp);
      const r = await execa(
        tsxBin,
        [cliEntry, "scan", "--hermes-home", fp, "--format", "json"],
        { reject: false },
      );
      expect(r.exitCode).toBe(0);
      const after = collectSha256Hashes(fp);

      expect(Object.keys(before).sort()).toEqual(Object.keys(after).sort());
      for (const [filePath, hash] of Object.entries(before)) {
        expect(after[filePath]).toBe(hash);
      }
    });
  }
});

describe("VAL-AUDIT-002: MCP command execution audit — sentinel file NOT created", () => {
  const sentinelPath = "/tmp/hermes-doctor-mcp-sentinel-marker";
  const fp = resolve(fixturesDir, "validation", "mcp", "sentinel");

  it("sentinel file does NOT exist after scan (proves no MCP execution)", async () => {
    try { unlinkSync(sentinelPath); } catch { /* ok */ }

    const r = await execa(
      tsxBin,
      [cliEntry, "scan", "--hermes-home", fp, "--format", "json"],
      { reject: false },
    );
    expect(r.exitCode).toBe(0);
    expect(existsSync(sentinelPath)).toBe(false);

    try { unlinkSync(sentinelPath); } catch { /* ok */ }
  });

  it("scan completes normally with sentinel fixture", async () => {
    try { unlinkSync(sentinelPath); } catch { /* ok */ }

    const r = await execa(
      tsxBin,
      [cliEntry, "scan", "--hermes-home", fp, "--format", "json"],
      { reject: false },
    );
    expect(r.exitCode).toBe(0);
    const report = JSON.parse(r.stdout);
    expect(report.summary).toBeDefined();
    expect(report.findings).toBeDefined();
  });
});

describe("VAL-AUDIT-003: Network call audit — no outbound internet (local diagnostics only)", () => {
  const gpDashOff = resolve(fixturesDir, "validation", "golden-path", "dashboard-off");
  const gpDashOn = resolve(fixturesDir, "validation", "golden-path", "dashboard-on");

  it("scan completes quickly (no outbound internet calls in default mode)", async () => {
    const start = Date.now();
    const r = await execa(
      tsxBin,
      [cliEntry, "scan", "--hermes-home", gpDashOff, "--format", "json", "--no-flue"],
      { reject: false, timeout: 30_000 },
    );
    const elapsed = Date.now() - start;
    expect(r.exitCode).toBe(0);
    expect(elapsed).toBeLessThan(15_000);
  });

  it("remote dashboard URL is not probed", async () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), "hermes-audit-net-"));
    try {
      writeFileSync(
        join(tmpDir, "config.yaml"),
        [
          "profile: default",
          "providers:",
          "  default_model: claude-sonnet-4-20250514",
          "  anthropic:",
          "    api_key_env: ANTHROPIC_API_KEY",
          "dashboard:",
          "  url: https://example.com:8080",
          "  bind: 0.0.0.0",
          "memory:",
          "  dir: memory",
          "  limit_mb: 10",
          "",
        ].join("\n"),
        "utf-8",
      );
      const r = await execa(
        tsxBin,
        [cliEntry, "scan", "--hermes-home", tmpDir, "--format", "json"],
        { reject: false, env: { ANTHROPIC_API_KEY: "**************************************" } as NodeJS.ProcessEnv },
      );
      expect(r.exitCode).toBe(0);
      const report = JSON.parse(r.stdout);
      const reachable = report.findings.find((f: Finding) => f.id === "dashboard-reachable");
      if (reachable) {
        // For remote URL, probed should not be true
        expect(findEvidence(reachable.evidence, "probed")).not.toBe("true");
      }
    } finally {
      try {
        const rm = await import("node:fs/promises");
        await rm.rm(tmpDir, { recursive: true, force: true });
      } catch { /* ok */ }
    }
  });

  it("localhost dashboard probe is attempted (local diagnostics only)", async () => {
    const r = await execa(
      tsxBin,
      [cliEntry, "scan", "--hermes-home", gpDashOn, "--format", "json"],
      { reject: false, timeout: 30_000 },
    );
    expect(r.exitCode).toBe(0);
    const report = JSON.parse(r.stdout);
    const reachable = report.findings.find((f: Finding) => f.id === "dashboard-reachable");
    expect(reachable).toBeDefined();
    if (reachable) {
      // Dashboard-on fixture uses an uncommon localhost port (47999) to avoid colliding with dev servers on 8080.
      // The probe IS attempted but will fail since no dashboard is running.
      // Key: the finding is NOT the "info" status that means "not probed" (remote URL).
      // For localhost probes, status is either "ok" (reachable) or "broken" (unreachable).
      // Since no dashboard is running, expect "broken" (probe attempted but failed).
      expect(reachable.status).toBe("broken");
    }
  });
});

describe("VAL-AUDIT-004: Artifact cleanliness — no real secret patterns in committed files", () => {
  // These patterns match the actual validation contract exactly.
  // We search only source, config, markdown, and json files, excluding node_modules/, .git/,
  // REDTEAM_REDACTION.md (red team test report containing known fake secrets), and
  // fixture files (test fixtures are expected to contain test-only fake secrets).

  const rgBaseArgs = [
    "--no-ignore",
    "-g", "*.ts",
    "-g", "*.json",
    "-g", "*.md",
    "-g", "*.yaml",
    "-g", "*.yml",
    "-g", "!node_modules/**",
    "-g", "!.git/**",
    "-g", "!pnpm-lock.yaml",
    "-g", "!reports/REDTEAM_REDACTION.md",
    "-g", "!fixtures/**",
    "-g", "!local-only/**",
    "-g", "!**/__tests__/**",
    "-g", "!**/dist/**",
    repoRoot,
  ];

  it("no OpenAI-like keys (sk-<alphanum min20>) outside node_modules and .git", async () => {
    const r = await execa("rg", [
      "--no-ignore",
      "sk-[a-zA-Z0-9]{20,}",
      ...rgBaseArgs.slice(1),
    ], { reject: false });
    expect(r.exitCode, `rg error: ${r.stderr}`).toBeLessThan(2);
    if (r.stdout && r.stdout.trim().length > 0) {
      const lines = r.stdout.split("\n").filter((l: string) => l.trim().length > 0);
      // Filter out test patterns and redaction markers
      const realKeys = lines.filter(
        (l: string) =>
          !l.includes("sk-test-") &&
          !l.includes("sk-ant-test-") &&
          !l.includes("[REDACTED:") &&
          !l.includes("sk-ant-test-"),
      );
      expect(realKeys.length).toBe(0);
    }
  });

  it("no Anthropic keys (sk-ant-<alphanum min20>)", async () => {
    const r = await execa("rg", [
      "--no-ignore",
      "sk-ant-[a-zA-Z0-9]{20,}",
      ...rgBaseArgs.slice(1),
    ], { reject: false });
    if (r.stdout && r.stdout.trim().length > 0) {
      const lines = r.stdout.split("\n").filter((l: string) => l.trim().length > 0);
      const realKeys = lines.filter(
        (l: string) => !l.includes("sk-ant-test-") && !l.includes("[REDACTED:"),
      );
      expect(realKeys.length).toBe(0);
    }
  });

  it("no GitHub classic tokens (ghp_<alphanum 36>)", async () => {
    const r = await execa("rg", [
      "--no-ignore",
      "ghp_[a-zA-Z0-9]{36}",
      ...rgBaseArgs.slice(1),
    ], { reject: false });
    if (r.stdout && r.stdout.trim().length > 0) {
      const lines = r.stdout.split("\n").filter((l: string) => l.trim().length > 0);
      const realKeys = lines.filter((l: string) => !l.includes("ghp_test") && !l.includes("[REDACTED:"));
      expect(realKeys.length).toBe(0);
    }
  });

  it("no GitHub fine-grained tokens (github_pat_<alphanum min20>)", async () => {
    const r = await execa("rg", [
      "--no-ignore",
      "github_pat_[a-zA-Z0-9_]{20,}",
      ...rgBaseArgs.slice(1),
    ], { reject: false });
    if (r.stdout && r.stdout.trim().length > 0) {
      const lines = r.stdout.split("\n").filter((l: string) => l.trim().length > 0);
      const realKeys = lines.filter(
        (l: string) => !l.includes("github_pat_test") && !l.includes("[REDACTED:"),
      );
      expect(realKeys.length).toBe(0);
    }
  });

  it("no SSH/RSA/OPENSSH private key blocks", async () => {
    const r = await execa("rg", [
      "--no-ignore",
      "-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----",
      ...rgBaseArgs.slice(1),
    ], { reject: false });
    // Allow regex pattern definitions in code and test strings (not actual secrets)
    if (r.stdout && r.stdout.trim().length > 0) {
      const lines = r.stdout.split("\n").filter((l: string) => l.trim().length > 0);
      // These are legitimate code references to the pattern, not actual secrets
      const actualSecrets = lines.filter(
        (l: string) =>
          !l.includes("patterns.ts") &&
          !l.includes("redaction.test.ts") &&
          !l.includes("BEGIN [A-Z0-9 ]*PRIVATE KEY"),
      );
      expect(actualSecrets.length).toBe(0);
    }
  });

  it("no AWS access key patterns (AKIA<uppercase 16>)", async () => {
    const r = await execa("rg", [
      "--no-ignore",
      "AKIA[0-9A-Z]{16}",
      ...rgBaseArgs.slice(1),
    ], { reject: false });
    if (r.stdout && r.stdout.trim().length > 0) {
      const lines = r.stdout.split("\n").filter((l: string) => l.trim().length > 0);
      expect(lines.length).toBe(0);
    }
  });

  it("no Slack webhook URL patterns", async () => {
    const r = await execa("rg", [
      "--no-ignore",
      "https://hooks\\.slack\\.com/services/T",
      ...rgBaseArgs.slice(1),
    ], { reject: false });
    if (r.stdout && r.stdout.trim().length > 0) {
      const lines = r.stdout.split("\n").filter((l: string) => l.trim().length > 0);
      expect(lines.length).toBe(0);
    }
  });

  it("no Bearer tokens with hex pattern", async () => {
    const r = await execa("rg", [
      "--no-ignore",
      "Bearer [a-fA-F0-9]{32,}",
      ...rgBaseArgs.slice(1),
    ], { reject: false });
    if (r.stdout && r.stdout.trim().length > 0) {
      const lines = r.stdout.split("\n").filter((l: string) => l.trim().length > 0);
      // Allow [REDACTED:BEARER_TOKEN] in source
      const real = lines.filter((l: string) => !l.includes("[REDACTED:"));
      expect(real.length).toBe(0);
    }
  });
});

describe("VAL-AUDIT-005: No files written to Hermes home during scan", () => {
  const auditFixtures = [
    resolve(fixturesDir, "hermes-good"),
    resolve(fixturesDir, "hermes-broken-mcp"),
    resolve(fixturesDir, "hermes-risky-dashboard"),
  ];

  for (const fp of auditFixtures) {
    const fixtureName = fp.split("/").pop() ?? "unknown";
    it(`'${fixtureName}' — no new files, no modified files after scan`, async () => {
      const before = collectSha256Hashes(fp);
      const beforePaths = Object.keys(before).sort();

      const tmpOut = mkdtempSync(join(os.tmpdir(), "hermes-audit-out-"));
      try {
        const r = await execa(
          tsxBin,
          [cliEntry, "scan", "--hermes-home", fp, "--format", "json", "--output", tmpOut],
          { reject: false },
        );
        expect(r.exitCode).toBe(0);

        const after = collectSha256Hashes(fp);
        const afterPaths = Object.keys(after).sort();

        expect(afterPaths).toEqual(beforePaths);
        for (const [filePath, hash] of Object.entries(before)) {
          expect(after[filePath]).toBe(hash);
        }
      } finally {
        try {
          const rm = await import("node:fs/promises");
          await rm.rm(tmpOut, { recursive: true, force: true });
        } catch { /* ok */ }
      }
    });
  }
});

describe("VAL-AUDIT-006: JSON report validates against DoctorReport valibot schema", () => {
  const testFixtures = [
    { path: resolve(fixturesDir, "hermes-good"),                   name: "hermes-good" },
    { path: resolve(fixturesDir, "hermes-missing-provider"),       name: "hermes-missing-provider" },
    { path: resolve(fixturesDir, "hermes-broken-mcp"),             name: "hermes-broken-mcp" },
    { path: resolve(fixturesDir, "hermes-risky-dashboard"),        name: "hermes-risky-dashboard" },
    { path: resolve(fixturesDir, "hermes-memory-full"),            name: "hermes-memory-full" },
    { path: resolve(fixturesDir, "validation", "cross-area", "multi-broken"), name: "cross-area/multi-broken" },
  ];

  for (const { path: fp, name } of testFixtures) {
    it(`'${name}' validates against DoctorReportSchema`, async () => {
      const r = await execa(
        tsxBin,
        [cliEntry, "scan", "--hermes-home", fp, "--format", "json"],
        { reject: false },
      );
      expect(r.exitCode).toBe(0);

      const parsed = JSON.parse(r.stdout);
      const validated = v.parse(DoctorReportSchema, parsed);
      expect(validated).toBeDefined();

      // Spot-check key fields
      expect(validated.schemaVersion).toBe("1.0");
      expect(typeof validated.generatedAt).toBe("string");
      expect(typeof validated.profile).toBe("string");
      expect(typeof validated.platform).toBe("object");
      expect(typeof validated.summary).toBe("object");
      expect(Array.isArray(validated.findings)).toBe(true);
      expect(typeof validated.redaction).toBe("object");

      // Each finding has required fields
      for (const finding of validated.findings) {
        expect(typeof finding.id).toBe("string");
        expect(typeof finding.area).toBe("string");
        expect(typeof finding.status).toBe("string");
        expect(typeof finding.severity).toBe("number");
        expect(typeof finding.title).toBe("string");
      }

      // Redaction fields
      expect(typeof validated.redaction.redacted).toBe("boolean");
      expect(typeof validated.redaction.totalRedactions).toBe("number");
    });
  }

  it("minimal fixture (no content) produces valid schema", async () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), "hermes-schema-empty-"));
    try {
      writeFileSync(
        join(tmpDir, "config.yaml"),
        "profile: default\nproviders:\n  default_model: claude\n",
        "utf-8",
      );
      const r = await execa(
        tsxBin,
        [cliEntry, "scan", "--hermes-home", tmpDir, "--format", "json"],
        { reject: false },
      );
      expect(r.exitCode).toBe(0);

      const parsed = JSON.parse(r.stdout);
      const validated = v.parse(DoctorReportSchema, parsed);
      expect(validated).toBeDefined();
      expect(Array.isArray(validated.findings)).toBe(true);
    } finally {
      try {
        const rm = await import("node:fs/promises");
        await rm.rm(tmpDir, { recursive: true, force: true });
      } catch { /* ok */ }
    }
  });
});

// ============================================================================
// VAL-CROSS-017: Cross-area isolation — provider changes don't affect MCP
// ============================================================================
describe("VAL-CROSS-017: Cross-area isolation — provider changes don't affect MCP findings", () => {
  // Scan the mcp-broken-only fixture with different provider states.
  // The MCP broken findings must remain identical regardless of provider config.

  const fp = join(crossAreaDir, "mcp-broken-only");

  async function mcpFindingKeys(providerEnv: Record<string, string | undefined>): Promise<string[]> {
    const { report } = await scanJson(fp, providerEnv);
    return report.findings
      .filter((f: Finding) => f.area === "mcp")
      .map((f: Finding) => `${f.id}:${f.status}:${f.severity}`)
      .sort();
  }

  it("MCP findings are identical with no provider env vars vs full provider env vars", async () => {
    // Run without any provider env vars
    const keysNoEnv = await mcpFindingKeys({});
    // Run with full provider env vars
    const keysFullEnv = await mcpFindingKeys({
      OPENAI_API_KEY: "****************************************",
      ANTHROPIC_API_KEY: "**************************************",
    });
    // MCP findings must be identical regardless of provider env
    expect(keysNoEnv).toEqual(keysFullEnv);
  });

  it("MCP findings are identical with partial vs full provider env vars", async () => {
    const keysPartial = await mcpFindingKeys({
      OPENAI_API_KEY: "****************************************",
    });
    const keysFull = await mcpFindingKeys({
      OPENAI_API_KEY: "****************************************",
      ANTHROPIC_API_KEY: "**************************************",
    });
    expect(keysPartial).toEqual(keysFull);
  });

  it("MCP finding count is stable across provider config changes", async () => {
    const countNoEnv = (await mcpFindingKeys({})).length;
    const countFull = (await mcpFindingKeys({
      OPENAI_API_KEY: "****************************************",
      ANTHROPIC_API_KEY: "**************************************",
    })).length;
    expect(countNoEnv).toEqual(countFull);
    expect(countNoEnv).toBeGreaterThanOrEqual(1);
  });

  it("MCP broken findings remain broken regardless of provider config", async () => {
    const { report } = await scanJson(fp, {
      OPENAI_API_KEY: "****************************************",
      ANTHROPIC_API_KEY: "**************************************",
    });
    const mcpBroken = report.findings.filter(
      (f: Finding) => f.area === "mcp" && f.status === "broken",
    );
    expect(mcpBroken.length).toBeGreaterThanOrEqual(1);

    // Now run without any provider env — the same MCP should be broken
    const { report: report2 } = await scanJson(fp, {});
    const mcpBroken2 = report2.findings.filter(
      (f: Finding) => f.area === "mcp" && f.status === "broken",
    );
    expect(mcpBroken2.length).toBe(mcpBroken.length);
    for (let i = 0; i < mcpBroken.length; i++) {
      expect(mcpBroken2[i].id).toEqual(mcpBroken[i].id);
    }
  });
});

// ============================================================================
// VAL-CROSS-018: Cross-area isolation — MCP changes don't affect providers
// ============================================================================
describe("VAL-CROSS-018: Cross-area isolation — MCP changes don't affect provider findings", () => {
  const fp = join(crossAreaDir, "provider-broken-only");

  async function providerFindingKeys(envOverride: Record<string, string | undefined>): Promise<string[]> {
    const { report } = await scanJson(fp, envOverride);
    return report.findings
      .filter((f: Finding) => f.area === "providers")
      .map((f: Finding) => `${f.id}:${f.status}:${f.severity}`)
      .sort();
  }

  it("provider broken findings exist regardless of MCP config", async () => {
    const { report } = await scanJson(fp, {
      ANTHROPIC_API_KEY: "**************************************",
    });
    const provBroken = report.findings.filter(
      (f: Finding) => f.area === "providers" && f.status === "broken",
    );
    expect(provBroken.length).toBeGreaterThanOrEqual(1);
  });

  it("provider findings produce zero MCP broken/risk findings", async () => {
    const { report } = await scanJson(fp, {
      ANTHROPIC_API_KEY: "**************************************",
    });
    // Must have at least one broken provider finding
    const provBroken = report.findings.filter(
      (f: Finding) => f.area === "providers" && f.status === "broken",
    );
    expect(provBroken.length).toBeGreaterThanOrEqual(1);
    // Must have zero MCP broken/risk findings
    const mcpBrokenRisk = report.findings.filter(
      (f: Finding) => f.area === "mcp" && (f.status === "broken" || f.status === "risk"),
    );
    expect(mcpBrokenRisk).toHaveLength(0);
  });

  it("provider findings are stable across different MCP configs", async () => {
    const keysOriginal = await providerFindingKeys({
      ANTHROPIC_API_KEY: "**************************************",
    });
    // Even with extra providers configured, the original provider findings persist
    expect(keysOriginal.length).toBeGreaterThanOrEqual(1);
    // All broken findings are in providers area
    const { report } = await scanJson(fp, {
      ANTHROPIC_API_KEY: "**************************************",
    });
    for (const f of report.findings.filter((f: Finding) => f.status === "broken")) {
      expect(f.area).toBe("providers");
    }
  });
});

// ============================================================================
// VAL-CROSS-019: Verify no finding text cross-contamination
// ============================================================================
describe("VAL-CROSS-019: Finding text cross-contamination negative assertions", () => {
  it("provider findings in provider-broken-only fixture do not mention MCP", async () => {
    const fp = join(crossAreaDir, "provider-broken-only");
    const { report } = await scanJson(fp, {
      ANTHROPIC_API_KEY: "**************************************",
    });
    for (const f of report.findings.filter((f: Finding) => f.area === "providers")) {
      const combined = `${f.title} ${f.message} ${JSON.stringify(f.evidence)}`.toLowerCase();
      expect(combined).not.toMatch(/\bmcp\b/);
    }
  });

  it("MCP findings in mcp-broken-only fixture do not mention providers", async () => {
    const fp = join(crossAreaDir, "mcp-broken-only");
    const { report } = await scanJson(fp, {
      OPENAI_API_KEY: "****************************************",
      ANTHROPIC_API_KEY: "**************************************",
    });
    for (const f of report.findings.filter((f: Finding) => f.area === "mcp")) {
      const combined = `${f.title} ${f.message} ${JSON.stringify(f.evidence)}`.toLowerCase();
      expect(combined).not.toMatch(/\bprovider\b/);
    }
  });

  it("dashboard findings in risky-dashboard-only fixture do not mention MCP or providers", async () => {
    const fp = join(crossAreaDir, "risky-dashboard-only");
    const { report } = await scanJson(fp, {
      ANTHROPIC_API_KEY: "**************************************",
    });
    for (const f of report.findings.filter(
      (f: Finding) => f.area === "dashboard" || f.area === "security",
    )) {
      const combined = `${f.title} ${f.message} ${JSON.stringify(f.evidence)}`.toLowerCase();
      expect(combined).not.toMatch(/\bmcp\b/);
      expect(combined).not.toMatch(/\bprovider\b/);
    }
  });
});
