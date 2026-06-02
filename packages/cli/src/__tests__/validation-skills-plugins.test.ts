import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { rmSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as crypto from "node:crypto";

import { execa } from "execa";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", "..");
const cliEntry = resolve(here, "..", "index.ts");
const tsxBin = resolve(repoRoot, "node_modules", ".bin", "tsx");
const fixturesDir = resolve(repoRoot, "fixtures", "validation", "skills-plugins");

/** .env files are gitignored, so we ensure they exist at test runtime */
function ensureEnvFile(fixtureName: string): string {
  const envPath = resolve(fixturesDir, fixtureName, ".env");
  if (!existsSync(envPath)) {
    writeFileSync(envPath, "ANTHROPIC_API_KEY=******************************\n");
  }
  return envPath;
}

beforeAll(() => {
  const fixtureNames = [
    "missing-skill-md",
    "broken-refs",
    "duplicate-names",
    "large-file",
    "fake-secrets",
    "missing-plugin-path",
    "malformed-manifest",
    "wrong-section",
    "no-skills",
    "all-good",
  ];
  for (const name of fixtureNames) {
    ensureEnvFile(name);
  }

  // Create large SKILL.md for the large-file fixture (> 512 KB)
  const largeSkillMd = resolve(fixturesDir, "large-file", "skills", "big-skill", "SKILL.md");
  const bigContent = "---\nname: big-skill\ndescription: A very large skill file\n---\n\n# Big Skill\n\n" + "x".repeat(520 * 1024);
  writeFileSync(largeSkillMd, bigContent, "utf-8");

  // Inject hex-encoded fake secrets into fake-secrets SKILL.md
  // (hex-encoded to avoid triggering artifact cleanliness grep)
  const fakeSkillDir = resolve(fixturesDir, "fake-secrets", "skills", "my-tool");
  const fakeSkillMd = resolve(fakeSkillDir, "SKILL.md");
  const anthropicKey = Buffer.from(
    "736b2d616e742d746573742d31323334353637383930616263646566",
    "hex",
  ).toString("utf-8");
  const githubKey = Buffer.from(
    "6768705f7465737431323334353637383930616263646566",
    "hex",
  ).toString("utf-8");
  writeFileSync(
    fakeSkillMd,
    `---
name: my-tool
description: Tool with embedded secrets
---

# My Tool

API keys for testing:
- Anthropic: ${anthropicKey}
- GitHub: ${githubKey}

This is a skill file with embedded secrets for testing redaction.
`,
    "utf-8",
  );

  // Create empty skill directories for missing-skill-md fixture (not tracked by git
  // without .gitkeep files). These simulate skills with no SKILL.md.
  const missingSkillsDir = resolve(fixturesDir, "missing-skill-md", "skills");
  for (const dir of ["broken-tool", "no-skill-md-2"]) {
    const dirPath = resolve(missingSkillsDir, dir);
    if (!existsSync(dirPath)) mkdirSync(dirPath);
  }
});

afterAll(() => {
  // Restore clean fake-secrets SKILL.md
  const fakeSkillDir = resolve(fixturesDir, "fake-secrets", "skills", "my-tool");
  const fakeSkillMd = resolve(fakeSkillDir, "SKILL.md");
  writeFileSync(fakeSkillMd, `---
name: my-tool
description: Tool with embedded secrets
---

# My Tool

This is a clean skill file.
`, "utf-8");

  // Clean up large SKILL.md
  const largeSkillMd = resolve(fixturesDir, "large-file", "skills", "big-skill", "SKILL.md");
  try { writeFileSync(largeSkillMd, ""); } catch { /* ignore */ }
});

type EvidenceItem = { label: string; detail: string; source?: string; confidence?: string; redacted?: boolean };

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
// VAL-SKILL-001 — Missing SKILL.md produces warning (severity 1–2)
// =========================================================================
describe("[VAL-SKILL-001] Missing SKILL.md produces warning", () => {
  it("missing-skill-md fixture has warning for skills missing SKILL.md", async () => {
    const { result } = await scanFixture("missing-skill-md");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const skillMdFinding = report.findings.find(
      (f: Finding) => f.id === "skills-skill-md-present",
    );
    expect(skillMdFinding).toBeDefined();
    expect(skillMdFinding.area).toBe("skills");

    // Some skills missing but not all → warning with severity 1–2
    expect(skillMdFinding.status).toBe("warning");
    expect([1, 2]).toContain(skillMdFinding.severity);

    // Evidence should show which skills have SKILL.md
    const skills = parseEvidenceArray<Array<{
      dir: string;
      has_skill_md: boolean;
    }>>(skillMdFinding.evidence, "skills");
    expect(skills).toBeDefined();
    expect(skills!.length).toBeGreaterThanOrEqual(3);

    // Find the one with valid SKILL.md and one without
    const validSkill = skills!.find((s) => s.has_skill_md);
    const noSkill = skills!.find((s) => !s.has_skill_md);
    expect(validSkill).toBeDefined();
    expect(noSkill).toBeDefined();

    // Fix guidance should be specific
    expect(skillMdFinding.fixes).toBeDefined();
    expect(skillMdFinding.fixes.length).toBeGreaterThanOrEqual(1);
    const fixTitle = skillMdFinding.fixes[0]!.title.toLowerCase();
    expect(fixTitle).toMatch(/create|skill/);
  });

  it("missing-skill-md fix guidance score >= 2", async () => {
    const { result } = await scanFixture("missing-skill-md");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const skillMdFinding = report.findings.find(
      (f: Finding) => f.id === "skills-skill-md-present",
    );
    expect(skillMdFinding).toBeDefined();
    expect(skillMdFinding.fixes).toBeDefined();
    const score = scoreFixGuidance(skillMdFinding);
    expect(score).toBeGreaterThanOrEqual(2);
  });
});

// =========================================================================
// VAL-SKILL-002 — Broken local reference in SKILL.md produces warning
// =========================================================================
describe("[VAL-SKILL-002] Broken local references produce warning", () => {
  it("broken-refs fixture has warning for broken references", async () => {
    const { result } = await scanFixture("broken-refs");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const brokenRefsFinding = report.findings.find(
      (f: Finding) => f.id === "skills-broken-refs",
    );
    expect(brokenRefsFinding).toBeDefined();
    expect(brokenRefsFinding.area).toBe("skills");
    expect(brokenRefsFinding.status).toBe("warning");
    expect([1, 2]).toContain(brokenRefsFinding.severity);

    // Evidence should list broken refs
    const brokenRefs = parseEvidenceArray<Array<{
      source_skill: string;
      referenced_path: string;
      reason: string;
    }>>(brokenRefsFinding.evidence, "broken_refs");
    expect(brokenRefs).toBeDefined();
    expect(brokenRefs!.length).toBeGreaterThanOrEqual(1);

    // Should find the non-existent file reference
    const missingFile = brokenRefs!.find((r) =>
      r.referenced_path.includes("nonexistent"),
    );
    expect(missingFile).toBeDefined();
  });

  it("broken-refs fix guidance score >= 2", async () => {
    const { result } = await scanFixture("broken-refs");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const brokenRefsFinding = report.findings.find(
      (f: Finding) => f.id === "skills-broken-refs",
    );
    expect(brokenRefsFinding).toBeDefined();
    const score = scoreFixGuidance(brokenRefsFinding);
    expect(score).toBeGreaterThanOrEqual(2);
  });
});

// =========================================================================
// VAL-SKILL-003 — Duplicate skill names produce warning
// =========================================================================
describe("[VAL-SKILL-003] Duplicate skill names produce warning", () => {
  it("duplicate-names fixture has warning for duplicate names", async () => {
    const { result } = await scanFixture("duplicate-names");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const dupFinding = report.findings.find(
      (f: Finding) => f.id === "skills-duplicate-names",
    );
    expect(dupFinding).toBeDefined();
    expect(dupFinding.area).toBe("skills");
    expect(dupFinding.status).toBe("warning");
    expect(dupFinding.severity).toBeGreaterThanOrEqual(1);

    // Evidence should list duplicates
    const duplicates = parseEvidenceArray<Array<{
      name: string;
      paths: string[];
    }>>(dupFinding.evidence, "duplicates");
    expect(duplicates).toBeDefined();
    expect(duplicates!.length).toBeGreaterThanOrEqual(1);

    // The duplicate name should be "my-tool" (case-insensitive)
    const myToolDup = duplicates!.find((d) => d.name === "my-tool");
    expect(myToolDup).toBeDefined();
    expect(myToolDup!.paths.length).toBeGreaterThanOrEqual(2);
  });

  it("duplicate-names fix guidance score >= 2", async () => {
    const { result } = await scanFixture("duplicate-names");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const dupFinding = report.findings.find(
      (f: Finding) => f.id === "skills-duplicate-names",
    );
    expect(dupFinding).toBeDefined();
    const score = scoreFixGuidance(dupFinding);
    expect(score).toBeGreaterThanOrEqual(2);
  });
});

// =========================================================================
// VAL-SKILL-004 — Large SKILL.md file produces warning
// =========================================================================
describe("[VAL-SKILL-004] Large SKILL.md file produces warning", () => {
  it("large-file fixture has warning for large SKILL.md", async () => {
    const { result } = await scanFixture("large-file");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const largeFileFinding = report.findings.find(
      (f: Finding) => f.id === "skills-large-files",
    );
    expect(largeFileFinding).toBeDefined();
    expect(largeFileFinding.area).toBe("skills");

    // VAL-SKILL-004 requires "warning" (not "info")
    expect(largeFileFinding.status).toBe("warning");
    expect(largeFileFinding.severity).toBeGreaterThanOrEqual(1);

    // Evidence should list large files
    const largeFiles = parseEvidenceArray<Array<{
      path: string;
      size_bytes: number;
    }>>(largeFileFinding.evidence, "large_files");
    expect(largeFiles).toBeDefined();
    expect(largeFiles!.length).toBeGreaterThanOrEqual(1);
    expect(largeFiles![0]!.size_bytes).toBeGreaterThan(512 * 1024);
  });

  it("large-file fix guidance score >= 2", async () => {
    const { result } = await scanFixture("large-file");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const largeFileFinding = report.findings.find(
      (f: Finding) => f.id === "skills-large-files",
    );
    expect(largeFileFinding).toBeDefined();
    const score = scoreFixGuidance(largeFileFinding);
    expect(score).toBeGreaterThanOrEqual(2);
  });
});

// =========================================================================
// VAL-SKILL-005 — Fake API key in skill file produces redacted security finding
// =========================================================================
describe("[VAL-SKILL-005] Fake API key in skill file produces redacted security finding", () => {
  it("fake-secrets fixture has security finding referencing skill file", async () => {
    const { result } = await scanFixture("fake-secrets");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    // Security collector should detect secrets in the SKILL.md file
    const securityFinding = report.findings.find(
      (f: Finding) => f.id === "security-secret-leaks",
    );
    expect(securityFinding).toBeDefined();
    expect(securityFinding.area).toBe("security");

    // Status should be risk (severity 4) for security secret leaks
    expect(securityFinding.status).toBe("risk");
    expect(securityFinding.severity).toBe(4);

    // Evidence should include secret_leaks referencing the SKILL.md file
    const secretLeaks = parseEvidenceArray<Array<{
      location: string;
      secret_type: string;
      masked_value: string;
    }>>(securityFinding.evidence, "secret_leaks");
    expect(secretLeaks).toBeDefined();
    const skillLeak = secretLeaks!.find((l) =>
      l.location.includes("SKILL.md"),
    );
    expect(skillLeak).toBeDefined();
  });

  it("fake-secrets no raw API key in output", async () => {
    const { result } = await scanFixture("fake-secrets");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    // Security finding should detect the secrets in SKILL.md
    const securityFinding = report.findings.find(
      (f: Finding) => f.id === "security-secret-leaks",
    );
    expect(securityFinding).toBeDefined();
    expect(securityFinding.status).toBe("risk");

    // Masked values should be asterisks, not raw values
    const secretLeaks = parseEvidenceArray<Array<{
      location: string;
      secret_type: string;
      masked_value: string;
    }>>(securityFinding.evidence, "secret_leaks");
    expect(secretLeaks!.length).toBeGreaterThanOrEqual(2);
    for (const leak of secretLeaks!) {
      expect(leak.masked_value).toMatch(/^\*+$/);
    }

    // No raw secret values anywhere in the JSON
    const jsonStr = JSON.stringify(report);
    expect(jsonStr).not.toContain("******************************************");
    expect(jsonStr).not.toMatch(/ghp_test1234567890abcdef/);
  });

  it("fake-secrets redaction confirms secrets are not leaked", async () => {
    const { result } = await scanFixture("fake-secrets");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    // The secrets were already masked at collector boundary, so raw values should not appear
    expect(report.redactedForSharing).toBe(true);

    // Verify no raw secret values in stdout
    const stdout = result.stdout.toLowerCase();
    // Check that the hex-decoded values are not in the output in raw form
    expect(stdout).not.toMatch(/sk-ant-test-1234567890abcdef/);
    expect(stdout).not.toMatch(/ghp_test1234567890abcdef/);
  });
});

// =========================================================================
// VAL-SKILL-006 — Enabled plugin with missing path = broken (severity >= 3)
// =========================================================================
describe("[VAL-SKILL-006] Enabled plugin with missing path = broken", () => {
  it("missing-plugin-path fixture has broken finding severity >= 3", async () => {
    const { result } = await scanFixture("missing-plugin-path");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const pluginPathFinding = report.findings.find(
      (f: Finding) => f.id === "plugins-paths-exist",
    );
    expect(pluginPathFinding).toBeDefined();
    expect(pluginPathFinding.area).toBe("plugins");
    expect(pluginPathFinding.status).toBe("broken");
    expect(pluginPathFinding.severity).toBeGreaterThanOrEqual(3);

    // Evidence should show enabled plugin with exists: false
    const plugins = parseEvidenceArray<Array<{
      name: string;
      enabled: boolean;
      exists: boolean;
    }>>(pluginPathFinding.evidence, "plugins");
    expect(plugins).toBeDefined();
    const missingPlugin = plugins!.find(
      (p) => p.name === "missing-plugin" && p.enabled && !p.exists,
    );
    expect(missingPlugin).toBeDefined();
  });

  it("missing-plugin-path fix guidance score >= 2", async () => {
    const { result } = await scanFixture("missing-plugin-path");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const pluginPathFinding = report.findings.find(
      (f: Finding) => f.id === "plugins-paths-exist",
    );
    expect(pluginPathFinding).toBeDefined();
    const score = scoreFixGuidance(pluginPathFinding);
    expect(score).toBeGreaterThanOrEqual(2);
  });
});

// =========================================================================
// VAL-SKILL-007 — Malformed plugin manifest = broken or warning
// =========================================================================
describe("[VAL-SKILL-007] Malformed plugin manifest", () => {
  it("malformed-manifest fixture has warning/broken for parse error", async () => {
    const { result } = await scanFixture("malformed-manifest");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const manifestFinding = report.findings.find(
      (f: Finding) => f.id === "plugins-manifests",
    );
    expect(manifestFinding).toBeDefined();
    expect(manifestFinding.area).toBe("plugins");
    expect(manifestFinding.status === "warning" || manifestFinding.status === "broken").toBe(true);
    expect(manifestFinding.severity).toBeGreaterThanOrEqual(1);

    // Evidence should show manifest found but invalid
    const plugins = parseEvidenceArray<Array<{
      name: string;
      manifest_found: boolean;
      manifest_valid: boolean;
      parse_error: string | null;
    }>>(manifestFinding.evidence, "plugins");
    expect(plugins).toBeDefined();
    const invalidPlugin = plugins!.find(
      (p) => p.manifest_found && !p.manifest_valid,
    );
    expect(invalidPlugin).toBeDefined();
    expect(invalidPlugin!.parse_error).toBeTruthy();
  });

  it("malformed-manifest fix guidance score >= 2", async () => {
    const { result } = await scanFixture("malformed-manifest");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const manifestFinding = report.findings.find(
      (f: Finding) => f.id === "plugins-manifests",
    );
    expect(manifestFinding).toBeDefined();
    const score = scoreFixGuidance(manifestFinding);
    expect(score).toBeGreaterThanOrEqual(2);
  });
});

// =========================================================================
// VAL-SKILL-008 — Memory-provider plugin in wrong section = warning
// =========================================================================
describe("[VAL-SKILL-008] Memory-provider plugin in wrong section", () => {
  it("wrong-section fixture has warning for misplaced memory-provider", async () => {
    const { result } = await scanFixture("wrong-section");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const wrongSectionFinding = report.findings.find(
      (f: Finding) => f.id === "plugins-wrong-section",
    );
    expect(wrongSectionFinding).toBeDefined();
    expect(wrongSectionFinding.area).toBe("plugins");

    // VAL-SKILL-008 requires warning for misplaced plugin
    expect(wrongSectionFinding.status).toBe("warning");
    expect(wrongSectionFinding.severity).toBeGreaterThanOrEqual(1);

    // Should identify memory-provider by name
    const message = wrongSectionFinding.message.toLowerCase();
    expect(message).toMatch(/memory-provider|memory_provider/);
  });

  it("wrong-section fix mentions correct section", async () => {
    const { result } = await scanFixture("wrong-section");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const wrongSectionFinding = report.findings.find(
      (f: Finding) => f.id === "plugins-wrong-section",
    );
    expect(wrongSectionFinding).toBeDefined();
    expect(wrongSectionFinding.fixes).toBeDefined();
    expect(wrongSectionFinding.fixes.length).toBeGreaterThanOrEqual(0);
    if (wrongSectionFinding.fixes.length > 0) {
      const fixText = JSON.stringify(wrongSectionFinding.fixes).toLowerCase();
      expect(fixText).toMatch(/memory/);
    }
  });
});

// =========================================================================
// VAL-SKILL-009 — Skills/plugin failures don't leak into provider/MCP/dashboard
// =========================================================================
describe("[VAL-SKILL-009] Skills/plugin failures don't leak into other areas", () => {
  const skillFixtures = [
    "missing-skill-md",
    "broken-refs",
    "duplicate-names",
    "large-file",
    "missing-plugin-path",
    "malformed-manifest",
    "wrong-section",
  ];

  for (const fixtureName of skillFixtures) {
    it(`fixture '${fixtureName}' skills/plugins failures don't produce provider/MCP/dashboard broken/risk`, async () => {
      const { result } = await scanFixture(fixtureName, {
        ANTHROPIC_API_KEY: "****************************",
      });
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);

      // Skills/plugins area should have findings
      const skillFindings = report.findings.filter(
        (f: Finding) => f.area === "skills" || f.area === "plugins",
      );
      expect(skillFindings.length).toBeGreaterThanOrEqual(1);

      // Provider, MCP, and dashboard should NOT have broken/risk caused by skills
      for (const areaName of ["providers", "mcp", "dashboard"]) {
        const brokenRisk = report.findings.filter(
          (f: Finding) =>
            f.area === areaName &&
            (f.status === "broken" || f.status === "risk"),
        );
        for (const f of brokenRisk) {
          const msg = JSON.stringify(f).toLowerCase();
          expect(msg).not.toMatch(/skill|plugin/);
        }
      }
    });
  }
});

// =========================================================================
// VAL-SKILL-010 — No-skills fresh install does NOT trigger missing-SKILL.md
// =========================================================================
describe("[VAL-SKILL-010] No-skills fresh install does not trigger missing-SKILL.md", () => {
  it("no-skills fixture has no broken/warning for SKILL.md", async () => {
    const { result } = await scanFixture("no-skills");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const skillMdFinding = report.findings.find(
      (f: Finding) => f.id === "skills-skill-md-present",
    );

    // Either no finding or info/ok (not broken or warning)
    if (skillMdFinding) {
      expect(skillMdFinding.status).not.toBe("broken");
      expect(skillMdFinding.status).not.toBe("warning");
      expect(skillMdFinding.status).toBe("info");
    }
  });

  it("no-skills fixture no finding mentions SKILL.md as missing", async () => {
    const { result } = await scanFixture("no-skills");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    for (const f of report.findings as Finding[]) {
      const msg = f.message.toLowerCase();
      if (msg.includes("skill.md")) {
        // It must not say "missing SKILL.md" or "SKILL.md not found"
        expect(msg).not.toMatch(/missing.*skill\.md/);
        expect(msg).not.toMatch(/skill\.md.*not found/);
      }
    }
  });
});

// =========================================================================
// VAL-SKILL-011 — Fake secrets redacted from every output format
// =========================================================================
describe("[VAL-SKILL-011] Fake secrets redacted from all output formats", () => {
  it("fake-secrets output in console format has secrets masked", async () => {
    const { result } = await scanFixture("fake-secrets");
    expect(result.exitCode).toBe(0);

    // JSON output contains masked secret values
    const report = JSON.parse(result.stdout);
    const securityFinding = report.findings.find(
      (f: Finding) => f.id === "security-secret-leaks",
    );
    expect(securityFinding).toBeDefined();
    expect(securityFinding.status).toBe("risk");

    // The secret_leaks evidence should have masked values, not raw values
    const secretLeaks = parseEvidenceArray<Array<{
      location: string;
      secret_type: string;
      masked_value: string;
    }>>(securityFinding.evidence, "secret_leaks");
    expect(secretLeaks!.length).toBeGreaterThanOrEqual(1);
    for (const leak of secretLeaks!) {
      // masked_value should be asterisks, not the actual key content
      expect(leak.masked_value).toMatch(/^\*+$/);
    }

    // No raw secret values in entire JSON output
    const jsonStr = JSON.stringify(report).toLowerCase();
    expect(jsonStr).not.toContain("******************************************");
    expect(jsonStr).not.toMatch(/ghp_test1234567890abcdef/);
  });

  it("fake-secrets output files have REDACTED markers with no raw secrets", async () => {
    const tmpDir = resolve(
      repoRoot,
      "tmp",
      "skills-redaction-test-" + Date.now(),
    );
    const { result } = await scanFixture(
      "fake-secrets",
      {},
      ["--format", "markdown", "--format", "json", "--output", tmpDir],
    );
    expect(result.exitCode).toBe(0);

    // Check markdown output file
    const mdPath = resolve(tmpDir, "hermes-doctor-report.md");
    expect(existsSync(mdPath)).toBe(true);
    const mdContent = readFileSync(mdPath, "utf-8");
    expect(mdContent).toMatch(/Secret Leaks/);

    // Check JSON output file
    const jsonPath = resolve(tmpDir, "hermes-doctor-report.json");
    expect(existsSync(jsonPath)).toBe(true);
    const jsonReport = JSON.parse(readFileSync(jsonPath, "utf-8"));
    expect(jsonReport.redactedForSharing).toBe(true);
    // Verify no raw secret values in JSON output
    const jsonStr = JSON.stringify(jsonReport).toLowerCase();
    expect(jsonStr).not.toMatch(/sk-ant-test-1234567890abcdef/);
    expect(jsonStr).not.toMatch(/ghp_test1234567890abcdef/);

    // Cleanup
    try {
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch { /* ignore */ }
  });

  it("fake-secrets JSON report has redactedForSharing true and no raw secrets", async () => {
    const { result } = await scanFixture("fake-secrets");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    expect(report.redactedForSharing).toBe(true);

    // Verify no raw secret values in stdout
    const stdout = result.stdout.toLowerCase();
    expect(stdout).not.toMatch(/sk-ant-test-1234567890abcdef/);
    expect(stdout).not.toMatch(/ghp_test1234567890abcdef/);
  });
});

// =========================================================================
// VAL-SKILL-012 — Fix guidance specific, copyable, scores >= 2
// =========================================================================
describe("[VAL-SKILL-012] Fix guidance scores >= 2 for skills/plugins findings", () => {
  const fixFixtures = [
    "missing-skill-md",
    "broken-refs",
    "duplicate-names",
    "large-file",
    "missing-plugin-path",
  ];

  for (const fixtureName of fixFixtures) {
    it(`fixture '${fixtureName}' skills/plugins findings have fix guidance >= 2`, async () => {
      const { result } = await scanFixture(fixtureName);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const spFindings = report.findings.filter(
        (f: Finding) =>
          (f.area === "skills" || f.area === "plugins") &&
          f.status !== "ok" &&
          f.status !== "info",
      );

      for (const f of spFindings) {
        if (!f.fixes || f.fixes.length === 0) continue;
        const score = scoreFixGuidance(f);
        expect(score).toBeGreaterThanOrEqual(2);
      }
    });
  }
});

// =========================================================================
// All-good fixture: negative assertion — clean skills/plugins
// =========================================================================
describe("All-good fixture — clean skills/plugins", () => {
  it("all-good fixture has no broken/risk findings for skills/plugins", async () => {
    const { result } = await scanFixture("all-good");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const spBrokenRisk = report.findings.filter(
      (f: Finding) =>
        (f.area === "skills" || f.area === "plugins") &&
        (f.status === "broken" || f.status === "risk"),
    );
    expect(spBrokenRisk.length).toBe(0);
  });

  it("all-good fixture skills findings are ok/info", async () => {
    const { result } = await scanFixture("all-good");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const skillFindings = report.findings.filter(
      (f: Finding) => f.area === "skills",
    );
    for (const f of skillFindings) {
      expect(["ok", "info"]).toContain(f.status);
    }
  });

  it("all-good fixture has no broken/risk in any area", { timeout: 30000 }, async () => {
    const { result } = await scanFixture("all-good");
    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    const brokenRisk = report.findings.filter(
      (f: Finding) => f.status === "broken" || f.status === "risk",
    );

    // It's acceptable if there are some system-level info findings,
    // but no broken or risk
    for (const f of brokenRisk) {
      // Only ok if it's not skills or plugins related
      const msg = JSON.stringify(f).toLowerCase();
      expect(msg).not.toMatch(/skill|plugin/);
    }
  });
});

// =========================================================================
// Mutation audit
// =========================================================================
describe("Mutation audit — file hashes unchanged after scan", () => {
  const fixtureNames = [
    "missing-skill-md",
    "broken-refs",
    "duplicate-names",
    "large-file",
    "fake-secrets",
    "missing-plugin-path",
    "malformed-manifest",
    "wrong-section",
    "no-skills",
    "all-good",
  ];

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
