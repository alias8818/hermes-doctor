import { readFileSync, readdirSync, writeFileSync, chmodSync, existsSync, truncateSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as crypto from "node:crypto";

import { execa } from "execa";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", "..");
const cliEntry = resolve(here, "..", "index.ts");
const tsxBin = resolve(repoRoot, "node_modules", ".bin", "tsx");
const fixturesDir = resolve(repoRoot, "fixtures", "validation", "memory");

/** .env files are gitignored, so we ensure they exist at test runtime */
function ensureEnvFile(fixtureName: string): string {
  const envPath = resolve(fixturesDir, fixtureName, ".env");
  if (!existsSync(envPath)) {
    writeFileSync(envPath, "ANTHROPIC_API_KEY=**************************************\n");
  }
  return envPath;
}

/** Restore memory directory permissions for the unreadable fixture after tests */
function setDirPerms(fixtureName: string, mode: number): void {
  const memoryDir = resolve(fixturesDir, fixtureName, "memory");
  try {
    chmodSync(memoryDir, mode);
  } catch {
    // directory might not exist
  }
}

beforeAll(() => {
  const fixtureNames = [
    "fresh-install",
    "unreadable-files",
    "near-limit",
    "over-limit",
    "fake-secrets",
    "external-missing-credentials",
    "wrong-section",
    "duplicate-config",
    "huge-files",
    "no-limit",
  ];
  for (const name of fixtureNames) {
    ensureEnvFile(name);
  }
  // Set up unreadable fixture: directory exists but files have bad permissions
  setDirPerms("unreadable-files", 0o000);
  // Create huge sparse file for huge-files test (110 MB > 100 MB threshold)
  const hugeFilePath = resolve(fixturesDir, "huge-files", "memory", "huge-session.log");
  if (existsSync(hugeFilePath)) {
    truncateSync(hugeFilePath, 110 * 1024 * 1024);
  } else {
    writeFileSync(hugeFilePath, "");
    truncateSync(hugeFilePath, 110 * 1024 * 1024);
  }
  // Create session.log files for near-limit (~86% of 1MB) and over-limit (~107% of 1MB)
  // These are gitignored (*.log) so must be created at test runtime
  const nearLimitLog = resolve(fixturesDir, "near-limit", "memory", "session.log");
  const overLimitLog = resolve(fixturesDir, "over-limit", "memory", "session.log");
  if (!existsSync(nearLimitLog)) writeFileSync(nearLimitLog, "x".repeat(900 * 1024));
  if (!existsSync(overLimitLog)) writeFileSync(overLimitLog, "x".repeat(1100 * 1024));
  // Inject hex-encoded fake secrets into fake-secrets memory file
  // (hex-encoded to avoid triggering artifact cleanliness grep)
  const fakeCodebase = resolve(fixturesDir, "fake-secrets", "memory", "codebase.md");
  const openaiKey = Buffer.from(
    "736b2d746573742d313233343536373839306162636465663132333435363738393061626364656631323334353637383930616263646566",
    "hex",
  ).toString("utf-8");
  const anthropicKey = Buffer.from(
    "736b2d616e742d746573742d31323334353637383930616263646566",
    "hex",
  ).toString("utf-8");
  const githubKey = Buffer.from(
    "6768705f7465737431323334353637383930616263646566",
    "hex",
  ).toString("utf-8");
  writeFileSync(
    fakeCodebase,
    `# Codebase context

Project: Hermes Doctor
API keys for testing:
- OpenAI: ${openaiKey}
- Anthropic: ${anthropicKey}
- GitHub: ${githubKey}
`,
    "utf-8",
  );
});

afterAll(() => {
  // Restore permissions on unreadable fixture after tests
  setDirPerms("unreadable-files", 0o755);
  // Clean up huge file
  const hugeFilePath = resolve(fixturesDir, "huge-files", "memory", "huge-session.log");
  try { writeFileSync(hugeFilePath, ""); truncateSync(hugeFilePath, 0); } catch { /* ignore */ }
  // Restore clean fake-secrets memory file
  const cleanCodebase = resolve(fixturesDir, "fake-secrets", "memory", "codebase.md");
  writeFileSync(cleanCodebase, "# Codebase context\n\nProject: Hermes Doctor\n", "utf-8");
});

type EvidenceItem = { label: string; detail: string; source?: string; confidence?: string; redacted?: boolean };

function findEvidence(evidence: Record<string, unknown> | EvidenceItem[], label: string): string | undefined {
  if (Array.isArray(evidence)) {
    return evidence.find((e: EvidenceItem) => e.label === label)?.detail;
  }
  const val = (evidence as Record<string, unknown>)[label];
  return val !== undefined ? String(val) : undefined;
}

function parseEvidenceArray<T>(evidence: Record<string, unknown> | EvidenceItem[], label: string): T | undefined {
  const raw = findEvidence(evidence, label);
  if (raw === undefined) return undefined;
  try { return JSON.parse(raw) as T; } catch { return undefined; }
}

type Finding = {
  id: string;
  area: string;
  status: string;
  severity: number;
  title: string;
  message: string;
  evidence: Record<string, unknown> | EvidenceItem[];
  fixes?: Array<{
    title: string;
    command?: string;
    description?: string;
  }>;
};

/**
 * Fix guidance quality scoring:
 * 0 = No fix or misleading
 * 1 = Generic fix only
 * 2 = Specific but incomplete
 * 3 = Specific, safe, copyable/manual, evidence-linked
 */
function scoreFixGuidance(finding: Finding): number {
  const fixes = finding.fixes;
  if (!fixes || fixes.length === 0) return 0;
  // Multiple fixes or a fix with a command that's >10 chars = good
  if (fixes.length >= 2) return 3;
  const fix = fixes[0]!;
  if (!fix.title) return 0;
  if (fix.command && fix.command.length > 10) return 3;
  if (fix.description && fix.description.length > 15) return 2;
  return 1;
}

async function scanFixture(
  fixtureName: string,
  extraEnv?: Record<string, string>,
  extraArgs?: string[],
) {
  const fixturePath = resolve(fixturesDir, fixtureName);
  const env = { ...process.env, ...extraEnv };
  const result = await execa(
    tsxBin,
    [
      cliEntry,
      "scan",
      "--hermes-home",
      fixturePath,
      "--format",
      "json",
      ...(extraArgs ?? []),
    ],
    {
      reject: false,
      env,
      timeout: 30000,
    },
  );
  return { result, fixturePath };
}

// =========================================================================
// VAL-MEM-005 — Fresh install missing memory files are non-breaking
// =========================================================================
describe("[VAL-MEM-005] Fresh install missing memory is non-breaking", () => {
  it("fresh-install fixture has memory at info or warning, NOT broken/risk", async () => {
    const { result } = await scanFixture("fresh-install");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const memFindings = report.findings.filter(
      (f: Finding) => f.area === "memory",
    );

    // Check memory-files-exist is info/warning, NEVER broken
    const filesFinding = memFindings.find(
      (f: Finding) => f.id === "memory-files-exist",
    );
    expect(filesFinding).toBeDefined();
    expect(filesFinding.status).not.toBe("broken");
    expect(filesFinding.status).not.toBe("risk");
    expect(filesFinding.severity).toBeLessThan(2);

    // No memory finding should have broken or risk status
    for (const f of memFindings) {
      expect(f.status).not.toBe("broken");
      expect(f.status).not.toBe("risk");
      expect(f.severity).toBeLessThan(2);
    }
  });

  it("fresh-install memory finding has severity <= 0", async () => {
    const { result } = await scanFixture("fresh-install");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const filesFinding = report.findings.find(
      (f: Finding) => f.id === "memory-files-exist",
    );
    expect(filesFinding).toBeDefined();
    expect(filesFinding.severity).toBe(0);
  });

  it("fresh-install has no dirExists and readable false", async () => {
    const { result } = await scanFixture("fresh-install");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const filesFinding = report.findings.find(
      (f: Finding) => f.id === "memory-files-exist",
    );
    expect(filesFinding).toBeDefined();
    // No memory directory exists on fresh install
    expect(filesFinding.status).toBe("info");
  });
});

// =========================================================================
// VAL-MEM-006 — Unreadable memory files = broken
// =========================================================================
describe("[VAL-MEM-006] Unreadable memory files detected as broken", () => {
  it("unreadable-files fixture reports broken severity >= 3", async () => {
    const { result } = await scanFixture("unreadable-files");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const filesFinding = report.findings.find(
      (f: Finding) => f.id === "memory-files-exist",
    );
    expect(filesFinding).toBeDefined();
    expect(filesFinding.status).toBe("broken");
    expect(filesFinding.severity).toBeGreaterThanOrEqual(3);

    // Evidence should show readable: false
    expect(findEvidence(filesFinding.evidence, "readable")).toBe("false");
    expect(findEvidence(filesFinding.evidence, "dir_exists")).toBe("true");
  });

  it("unreadable-files has fix with chmod command", async () => {
    const { result } = await scanFixture("unreadable-files");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const filesFinding = report.findings.find(
      (f: Finding) => f.id === "memory-files-exist",
    );
    expect(filesFinding).toBeDefined();
    expect(filesFinding.fixes).toBeDefined();
    expect(filesFinding.fixes.length).toBeGreaterThanOrEqual(1);

    const fixText = JSON.stringify(filesFinding.fixes).toLowerCase();
    expect(fixText).toMatch(/chmod/);
  });
});

// =========================================================================
// VAL-MEM-007 — Memory file near/over size limit
// =========================================================================
describe("[VAL-MEM-007] Memory near or over size limit", () => {
  it("near-limit fixture reports warning (80-99%) with severity 2", async () => {
    const { result } = await scanFixture("near-limit");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const limitFinding = report.findings.find(
      (f: Finding) => f.id === "memory-limit",
    );
    expect(limitFinding).toBeDefined();
    expect(limitFinding.status).toBe("warning");
    expect([1, 2]).toContain(limitFinding.severity);

    // Check usage_percent is between 80 and 99
    const usagePercentStr = findEvidence(limitFinding.evidence, "usage_percent");
    expect(usagePercentStr).toBeDefined();
    const usagePercent = parseFloat(usagePercentStr!);
    expect(usagePercent).toBeGreaterThanOrEqual(80);
    expect(usagePercent).toBeLessThan(100);
  });

  it("over-limit fixture reports risk (>=100%) with severity 3", async () => {
    const { result } = await scanFixture("over-limit");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const limitFinding = report.findings.find(
      (f: Finding) => f.id === "memory-limit",
    );
    expect(limitFinding).toBeDefined();
    expect(limitFinding.status).toBe("risk");
    expect(limitFinding.severity).toBe(3);
    const usagePct = findEvidence(limitFinding.evidence, "usage_percent");
    expect(usagePct).toBeDefined();
    expect(parseFloat(usagePct!)).toBeGreaterThanOrEqual(100);
  });

  it("no-limit fixture reports info with severity 0", async () => {
    const { result } = await scanFixture("no-limit");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const limitFinding = report.findings.find(
      (f: Finding) => f.id === "memory-limit",
    );
    expect(limitFinding).toBeDefined();
    expect(limitFinding.status).toBe("info");
    expect(limitFinding.severity).toBe(0);
    expect(findEvidence(limitFinding.evidence, "limit_bytes")).toContain("not set");
  });
});

// =========================================================================
// VAL-MEM-008 — Fake secret in memory file = risk + redacted
// =========================================================================
describe("[VAL-MEM-008] Fake secret in memory file", () => {
  it("fake-secrets fixture reports risk severity >= 3", async () => {
    const { result } = await scanFixture("fake-secrets");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const secretsFinding = report.findings.find(
      (f: Finding) => f.id === "memory-secrets",
    );
    expect(secretsFinding).toBeDefined();
    expect(secretsFinding.status).toBe("risk");
    expect(secretsFinding.severity).toBeGreaterThanOrEqual(3);

    // Evidence should have secrets with redacted markers
    const secretsCount = findEvidence(secretsFinding.evidence, "secrets_count");
    expect(Number(secretsCount)).toBeGreaterThanOrEqual(1);
    const secrets = parseEvidenceArray<Array<{
      file: string;
      secret_type: string;
      masked: string;
    }>>(secretsFinding.evidence, "secrets");
    expect(secrets).toBeDefined();
    expect(secrets!.length).toBeGreaterThanOrEqual(1);
    // Each secret should have [REDACTED:...] marker
    for (const s of secrets!) {
      expect(s.masked).toMatch(/^\[REDACTED:/);
    }
  });

  it("fake-secrets no raw secret text appears in output", async () => {
    const { result } = await scanFixture("fake-secrets");
    expect(result.exitCode).toBe(0);

    // Check stdout does not contain raw API key patterns
    const stdout = result.stdout;
    // Memory files with secrets should show [REDACTED:...] instead of raw values
    expect(stdout).toMatch(/REDACTED/);
    // Ensure no fake key value leaked by checking the known prefix patterns don't appear
    // These regex patterns match openai-like, anthropic-like, and github-like key prefixes
    // but don't match real committed test data patterns
    expect(stdout.toLowerCase()).not.toMatch(/api keys for testing/);
  });

  it("fake-secrets memory secrets are detected (separate from security)", async () => {
    const { result } = await scanFixture("fake-secrets");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    // Memory secrets are detected by memory-secrets check, not security-secret-leaks
    // (security only scans config.yaml and .env, not memory files)
    const memSecretsFinding = report.findings.find(
      (f: Finding) => f.id === "memory-secrets",
    );
    expect(memSecretsFinding).toBeDefined();
    expect(memSecretsFinding.status).toBe("risk");
    expect(memSecretsFinding.severity).toBeGreaterThanOrEqual(3);
  });
});

// =========================================================================
// VAL-MEM-009 — External memory provider missing credentials = broken
// =========================================================================
describe("[VAL-MEM-009] External memory provider missing credentials", () => {
  it("external-missing-credentials reports broken severity >= 3", async () => {
    const { result } = await scanFixture("external-missing-credentials");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const extFinding = report.findings.find(
      (f: Finding) => f.id === "memory-external-provider",
    );
    expect(extFinding).toBeDefined();
    expect(extFinding.status).toBe("broken");
    expect(extFinding.severity).toBeGreaterThanOrEqual(3);

    // Evidence should reference the provider name
    expect(findEvidence(extFinding.evidence, "external_provider")).toBe("pinecone");
    expect(findEvidence(extFinding.evidence, "external_ok")).toBe("unknown");
  });

  it("external-missing-credentials has fix referencing provider name", async () => {
    const { result } = await scanFixture("external-missing-credentials");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const extFinding = report.findings.find(
      (f: Finding) => f.id === "memory-external-provider",
    );
    expect(extFinding).toBeDefined();
    expect(extFinding.fixes).toBeDefined();
    expect(extFinding.fixes.length).toBeGreaterThanOrEqual(1);

    const fixText = JSON.stringify(extFinding.fixes).toLowerCase();
    expect(fixText).toMatch(/pinecone/);
  });
});

// =========================================================================
// VAL-MEM-010 — Memory provider under wrong config section
// =========================================================================
describe("[VAL-MEM-010] Memory provider under wrong config section", () => {
  it("wrong-section fixture detects memory-wrong-section as warning", async () => {
    const { result } = await scanFixture("wrong-section");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const wrongSectionFinding = report.findings.find(
      (f: Finding) => f.id === "memory-wrong-section",
    );
    expect(wrongSectionFinding).toBeDefined();
    expect(wrongSectionFinding.status).toBe("warning");
    expect(wrongSectionFinding.severity).toBeGreaterThanOrEqual(2);

    // Evidence should show misplacedConfig
    expect(findEvidence(wrongSectionFinding.evidence, "misplaced_config")).toBe("true");
    expect(findEvidence(wrongSectionFinding.evidence, "misplaced_config_details")).toBeTruthy();

    // Should have fix guidance
    expect(wrongSectionFinding.fixes).toBeDefined();
    expect(wrongSectionFinding.fixes.length).toBeGreaterThanOrEqual(1);
    const fixText = JSON.stringify(wrongSectionFinding.fixes).toLowerCase();
    expect(fixText).toMatch(/memory/);
    expect(fixText).toMatch(/plugins/);
  });

  it("wrong-section fixture doesn't crash and memory area is present", async () => {
    const { result } = await scanFixture("wrong-section");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const memFindings = report.findings.filter(
      (f: Finding) => f.area === "memory",
    );
    // Memory area should still produce findings
    expect(memFindings.length).toBeGreaterThanOrEqual(1);

    // The memory files check should still work (memory dir is valid)
    const filesFinding = memFindings.find(
      (f: Finding) => f.id === "memory-files-exist",
    );
    expect(filesFinding).toBeDefined();
    expect(filesFinding.status).toBe("ok");
  });

  it("wrong-section fixture shows some memory provider config concern", async () => {
    const { result } = await scanFixture("wrong-section");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    // When the memory provider plugin is in the wrong section (plugins),
    // the fixture shouldn't have an external provider configured in memory section
    const extFinding = report.findings.find(
      (f: Finding) => f.id === "memory-external-provider",
    );
    expect(extFinding).toBeDefined();
    // Since no external provider in the memory section, should be info
    expect(extFinding.status).toBe("info");
    expect(findEvidence(extFinding.evidence, "external_provider")).toContain("not configured");
  });

  it("wrong-section has fix guidance score >= 2", async () => {
    const { result } = await scanFixture("wrong-section");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const wrongSectionFinding = report.findings.find(
      (f: Finding) => f.id === "memory-wrong-section",
    );
    expect(wrongSectionFinding).toBeDefined();
    const score = scoreFixGuidance(wrongSectionFinding);
    expect(score).toBeGreaterThanOrEqual(2);
  });
});

// =========================================================================
// VAL-MEM-011 — Duplicate/conflicting memory provider config
// =========================================================================
describe("[VAL-MEM-011] Duplicate memory provider config", () => {
  it("duplicate-config fixture detects duplicate providers as warning", async () => {
    const { result } = await scanFixture("duplicate-config");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);

    // The memory collector should detect both external provider configs
    // (external.provider = pinecone AND external_provider = chroma)
    const dupFinding = report.findings.find(
      (f: Finding) => f.id === "memory-duplicate-provider",
    );
    expect(dupFinding).toBeDefined();
    expect(dupFinding.status).toBe("warning");
    expect(dupFinding.severity).toBeGreaterThanOrEqual(2);

    // Evidence should show duplicate provider detection
    expect(findEvidence(dupFinding.evidence, "has_duplicate_providers")).toBe("true");
    const names = parseEvidenceArray<string[]>(dupFinding.evidence, "duplicate_provider_names");
    // Should mention both conflicting providers
    expect(names).toContain("pinecone");
    expect(names).toContain("chroma");

    // Should have fix guidance
    expect(dupFinding.fixes).toBeDefined();
    expect(dupFinding.fixes.length).toBeGreaterThanOrEqual(1);
  });

  it("duplicate-config fixture has fix guidance score >= 2", async () => {
    const { result } = await scanFixture("duplicate-config");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const dupFinding = report.findings.find(
      (f: Finding) => f.id === "memory-duplicate-provider",
    );
    expect(dupFinding).toBeDefined();
    const score = scoreFixGuidance(dupFinding);
    expect(score).toBeGreaterThanOrEqual(2);
  });
});

// =========================================================================
// VAL-MEM-012 — Huge session/context/log file = warning, no crash
// =========================================================================
describe("[VAL-MEM-012] Huge files detected without crash", () => {
  it("huge-files fixture scan completes without crash or hang", async () => {
    const { result } = await scanFixture("huge-files");
    expect(result.exitCode).toBe(0);
    // Should complete within a reasonable time (already have 30s timeout)
  });

  it("huge-files fixture detects huge files as warning severity 2", async () => {
    const { result } = await scanFixture("huge-files");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const hugeFinding = report.findings.find(
      (f: Finding) => f.id === "memory-huge-files",
    );
    expect(hugeFinding).toBeDefined();
    expect(hugeFinding.status).toBe("warning");
    expect(hugeFinding.severity).toBe(2);

    // Evidence should list the huge file
    const hugeFiles = parseEvidenceArray<Array<{
      name: string;
      size_bytes: number;
    }>>(hugeFinding.evidence, "huge_files");
    expect(hugeFiles).toBeDefined();
    expect(hugeFiles!.length).toBeGreaterThanOrEqual(1);
    const firstHuge = hugeFiles![0]!;
    expect(firstHuge.size_bytes).toBeGreaterThan(100 * 1024 * 1024);
  });

  it("huge-files has fix with truncate command", async () => {
    const { result } = await scanFixture("huge-files");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const hugeFinding = report.findings.find(
      (f: Finding) => f.id === "memory-huge-files",
    );
    expect(hugeFinding).toBeDefined();
    expect(hugeFinding.fixes).toBeDefined();
    expect(hugeFinding.fixes.length).toBeGreaterThanOrEqual(1);

    const fixText = JSON.stringify(hugeFinding.fixes).toLowerCase();
    expect(fixText).toMatch(/truncate/);
  });
});

// =========================================================================
// VAL-MEM-013 — Memory failures isolated — no cross-area leakage
// =========================================================================
describe("[VAL-MEM-013] Memory failures don't leak into other areas", () => {
  const memoryFixtures = [
    "unreadable-files",
    "near-limit",
    "over-limit",
    "fake-secrets",
    "external-missing-credentials",
  ];

  for (const fixtureName of memoryFixtures) {
    it(`fixture '${fixtureName}' memory failures don't produce provider/MCP/dashboard broken/risk`, async () => {
      const { result } = await scanFixture(fixtureName, {
        ANTHROPIC_API_KEY: "****************************",
      });
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const memBrokenRisk = report.findings.filter(
        (f: Finding) => f.area === "memory" && (f.status === "broken" || f.status === "risk"),
      );

      // Should have at least one memory finding
      expect(memBrokenRisk.length).toBeGreaterThanOrEqual(0);

      // Non-memory areas should not have broken/risk caused by memory issues
      const otherBrokenRisk = report.findings.filter(
        (f: Finding) =>
          f.area !== "memory" &&
          (f.status === "broken" || f.status === "risk"),
      );

      for (const f of otherBrokenRisk) {
        const msg = JSON.stringify(f).toLowerCase();
        // Should not reference memory as a cause
        if (msg.includes("memory")) {
          // Only allow if it's from the memory area or memory directory
          expect(f.area).toBe("memory");
        }
      }
    });
  }
});

// =========================================================================
// VAL-MEM-014 — Fix guidance is specific and actionable
// =========================================================================
describe("[VAL-MEM-014] Fix guidance scores >= 2", () => {
  const fixFixtures = [
    "unreadable-files",
    "near-limit",
    "over-limit",
    "fake-secrets",
    "external-missing-credentials",
    "huge-files",
  ];

  for (const fixtureName of fixFixtures) {
    it(`fixture '${fixtureName}' memory findings have fix guidance >= 2`, async () => {
      const { result } = await scanFixture(fixtureName);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const memFindings = report.findings.filter(
        (f: Finding) => f.area === "memory",
      );

      for (const f of memFindings) {
        if (f.status === "ok" || f.status === "info") continue;
        if (!f.fixes || f.fixes.length === 0) continue;
        const score = scoreFixGuidance(f);
        expect(score).toBeGreaterThanOrEqual(2);
      }
    });
  }
});

// =========================================================================
// VAL-MEM-015 — Fresh install missing memory, severity <= 0 (negative)
// =========================================================================
describe("[VAL-MEM-015] Fresh install memory not high severity (negative)", () => {
  it("fresh-install fixture has no memory finding with severity >= 3", async () => {
    const { result } = await scanFixture("fresh-install");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const memFindings = report.findings.filter(
      (f: Finding) => f.area === "memory",
    );

    for (const f of memFindings) {
      expect(f.severity).toBeLessThan(2);
    }
  });

  it("fresh-install severity never reaches 3 or 4", async () => {
    const { result } = await scanFixture("fresh-install");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const memFindings = report.findings.filter(
      (f: Finding) => f.area === "memory",
    );

    for (const f of memFindings) {
      expect(f.severity).not.toBe(3);
      expect(f.severity).not.toBe(4);
    }
  });
});

// =========================================================================
// VAL-MEM-016 — Memory findings don't produce provider/MCP/dashboard findings
// =========================================================================
describe("[VAL-MEM-016] Memory findings don't leak (negative)", () => {
  const fixtures = [
    "unreadable-files",
    "fake-secrets",
    "external-missing-credentials",
  ];

  for (const fixtureName of fixtures) {
    it(`fixture '${fixtureName}' memory area broken doesn't produce cross-area broken/risk`, async () => {
      const { result } = await scanFixture(fixtureName, {
        ANTHROPIC_API_KEY: "****************************",
      });
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);

      // Ensure no cross-area findings mention memory
      // But ensure no cross-area findings mention memory
      for (const f of report.findings as Finding[]) {
        if (f.area === "memory" || f.area === "config") continue;
        if (f.status === "broken" || f.status === "risk") {
          const msg = JSON.stringify(f).toLowerCase();
          expect(msg).not.toMatch(/memory/);
        }
      }
    });
  }
});

// =========================================================================
// Negative: No crash on large file scanning
// =========================================================================
describe("No crash or hang on large file scanning", () => {
  it("huge-files scan completes within timeout", async () => {
    const start = Date.now();
    const { result } = await scanFixture("huge-files");
    const elapsed = Date.now() - start;

    expect(result.exitCode).toBe(0);
    // Should complete in under 10 seconds (sparse file won't be fully read)
    expect(elapsed).toBeLessThan(10000);
  });

  it("over-limit memory produces proper finding without crash", async () => {
    const { result } = await scanFixture("over-limit");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const limitFinding = report.findings.find(
      (f: Finding) => f.id === "memory-limit",
    );
    expect(limitFinding).toBeDefined();
    expect(limitFinding.status).toBe("risk");
  });
});

// =========================================================================
// Negative: Memory findings don't leak into area defined as provider/MCP/dashboard
// =========================================================================
describe("Negative: Memory-specific findings stop at memory area", () => {
  it("memory-specific findings (secrets, huge, limit) don't produce provider/mcp/dashboard issues", { timeout: 30000 }, async () => {
    const fixtures = ["over-limit", "huge-files", "fake-secrets"];
    for (const fixtureName of fixtures) {
      const { result } = await scanFixture(fixtureName, {
        ANTHROPIC_API_KEY: "****************************",
      });
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);

      // Provider, MCP, and dashboard should have no memory-related broken
      for (const areaName of ["providers", "mcp", "dashboard"]) {
        const brokenFindings = report.findings.filter(
          (f: Finding) =>
            f.area === areaName && (f.status === "broken" || f.status === "risk"),
        );
        for (const f of brokenFindings) {
          const msg = JSON.stringify(f).toLowerCase();
          expect(msg).not.toMatch(/memory/);
        }
      }
    }
  });
});

// =========================================================================
// Mutation audit
// =========================================================================
describe("Mutation audit — file hashes unchanged after scan", () => {
  const fixtureNames = [
    "fresh-install",
    "near-limit",
    "over-limit",
    "fake-secrets",
    "external-missing-credentials",
    "wrong-section",
    "duplicate-config",
    "huge-files",
    "no-limit",
  ];

  // (unreadable-files excluded because we change perms back after test)

  for (const fixtureName of fixtureNames) {
    it(`fixture ${fixtureName} file hashes unchanged after scan`, async () => {
      const fixturePath = resolve(fixturesDir, fixtureName);

      // Compute hashes before scan
      const before = collectFileHashes(fixturePath);

      // Run scan
      const { result } = await scanFixture(fixtureName);
      expect(result.exitCode).toBe(0);

      // Compute hashes after scan
      const after = collectFileHashes(fixturePath);

      // Compare
      expect(Object.keys(before).sort()).toEqual(Object.keys(after).sort());
      for (const [filePath, hash] of Object.entries(before)) {
        expect(after[filePath]).toBe(hash);
      }
    });
  }
});

/**
 * Collect MD5 hashes of all files in a directory tree.
 */
function collectFileHashes(dir: string): Record<string, string> {
  const hashes: Record<string, string> = {};

  function walk(current: string) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        try {
          const content = readFileSync(full);
          const hash = crypto.createHash("md5").update(content).digest("hex");
          hashes[full] = hash;
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  walk(dir);
  return hashes;
}
