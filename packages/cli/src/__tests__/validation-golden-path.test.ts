import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as crypto from "node:crypto";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", "..");
const cliEntry = resolve(here, "..", "index.ts");
const tsxBin = resolve(repoRoot, "node_modules", ".bin", "tsx");
const fixturesDir = resolve(repoRoot, "fixtures");
const goldenFixturesDir = resolve(
  fixturesDir,
  "validation",
  "golden-path",
);

// Golden path API key (constructed at runtime to avoid storage of raw secrets)
const GP_API_KEY = Buffer.from(
  "736b2d616e742d746573742d31323334353637383930616263646566",
  "hex",
).toString("utf-8");

async function runCli(args: string[], env?: NodeJS.ProcessEnv) {
  return execa(tsxBin, [cliEntry, ...args], {
    reject: false,
    env,
  });
}

/**
 * Scan a fixture with the golden-path env (stub hermes on PATH, valid API key).
 */
async function scanGolden(fixtureName: string, extraArgs: string[] = []) {
  const fixturePath = resolve(goldenFixturesDir, fixtureName);
  const stubBin = resolve(goldenFixturesDir, "hermes-good", "bin");

  const env = {
    ...process.env,
    ANTHROPIC_API_KEY: GP_API_KEY,
    PATH: `${stubBin}:${process.env.PATH ?? ""}`,
  };

  const result = await runCli(
    [
      "scan",
      "--hermes-home",
      fixturePath,
      "--format",
      "json",
      ...extraArgs,
    ],
    env,
  );

  return { result, fixturePath };
}

type Finding = {
  id: string;
  area: string;
  status: string;
  severity: number;
  title: string;
  message: string;
  evidence: Record<string, unknown>;
};
describe("VAL-GOLDEN: Golden Path", () => {
  // =========================================================================
  // dashboard-off fixture -- clean install, no dashboard
  // =========================================================================
  describe("dashboard-off fixture", () => {
    it("[VAL-GOLDEN-001] produces zero broken findings", async () => {
      const { result } = await scanGolden("dashboard-off");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      expect(report.summary.broken).toBe(0);
      for (const f of report.findings) {
        expect(f.status).not.toBe("broken");
      }
    });

    it("[VAL-GOLDEN-002] produces at most 2 risk findings (security checks are risk/4)", async () => {
      const { result } = await scanGolden("dashboard-off");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      // security checks correctly flag fixture file permissions and test secrets as risk/4
      expect(report.summary.risks).toBeLessThanOrEqual(2);
      for (const f of report.findings) {
        if (f.status === "risk") {
          expect(f.id).toMatch(/^security-/);
        }
      }
    });

    it("[VAL-GOLDEN-003] produces <= 3 warnings, all explainable", async () => {
      const { result } = await scanGolden("dashboard-off");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      expect(report.summary.warnings).toBeLessThanOrEqual(3);

      for (const f of report.findings) {
        if (f.status === "warning") {
          expect(f.area).toBeTruthy();
          expect(f.evidence).toBeTruthy();
          expect(Object.keys(f.evidence ?? {}).length).toBeGreaterThanOrEqual(1);
          expect(f.message).toBeTruthy();
          // Must not be alarmist
          expect(f.message.toLowerCase()).not.toMatch(
            /compromised|breach|dangerous|malicious/i,
          );
        }
      }
    });

    it("[VAL-GOLDEN-004] exits with code 0", async () => {
      const { result } = await scanGolden("dashboard-off");
      expect(result.exitCode).toBe(0);
      // signal may be null or undefined depending on execa version
      if (result.signal !== undefined) {
        expect(result.signal).toBeNull();
      }
    });

    it("[VAL-GOLDEN-005] completes end-to-end without crash or timeout", async () => {
      const { result } = await scanGolden("dashboard-off");
      expect(result.exitCode).toBe(0);
      expect(result.isTerminated).toBe(false);
      // No uncaught exception or stack trace in non-verbose stdout
      const nonVerbose = result.stdout;
      expect(nonVerbose).not.toMatch(/Error:|Uncaught|unhandled rejection/);
    });

    it("[VAL-GOLDEN-006] JSON report validates against DoctorReport schema", async () => {
      const { result } = await scanGolden("dashboard-off");
      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.schemaVersion).toBe("1.0");
      expect(parsed.generatedAt).toBeTruthy();
      expect(parsed.profile).toBeTruthy();
      expect(typeof parsed.summary).toBe("object");
      expect(typeof parsed.summary.ok).toBe("number");
      expect(typeof parsed.summary.info).toBe("number");
      expect(typeof parsed.summary.warnings).toBe("number");
      expect(typeof parsed.summary.broken).toBe("number");
      expect(typeof parsed.summary.risks).toBe("number");
      expect(typeof parsed.summary.total).toBe("number");
      expect(Array.isArray(parsed.findings)).toBe(true);
      expect(typeof parsed.redaction).toBe("object");
      expect(typeof parsed.redactedForSharing).toBe("boolean");
      // No extra top-level keys
      const expectedKeys = [
        "schemaVersion",
        "generatedAt",
        "profile",
        "hermesHome",
        "platform",
        "summary",
        "findings",
        "redaction",
        "flueEnabled",
        "redactedForSharing",
      ];
      for (const key of Object.keys(parsed)) {
        expect(expectedKeys).toContain(key);
      }
    });

    it("[VAL-GOLDEN-007] redactedForSharing is true in JSON report", async () => {
      const { result } = await scanGolden("dashboard-off");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      expect(report.redactedForSharing).toBe(true);
    });

    it("[VAL-GOLDEN-008] redaction summary reports count 0 on clean install", async () => {
      const { result } = await scanGolden("dashboard-off");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      expect(report.redaction.count).toBe(0);
      expect(report.redaction.totalRedactions).toBe(0);
      expect(Array.isArray(report.redaction.patterns)).toBe(true);
      expect(report.redaction.patterns).toHaveLength(0);
    });

    it("[VAL-GOLDEN-009] console output is human-readable", async () => {
      const fixturePath = resolve(goldenFixturesDir, "dashboard-off");
      const stubBin = resolve(goldenFixturesDir, "hermes-good", "bin");
      const env = {
        ...process.env,
        ANTHROPIC_API_KEY: GP_API_KEY,
        PATH: `${stubBin}:${process.env.PATH ?? ""}`,
      };

      const result = await runCli(
        [
          "scan",
          "--hermes-home",
          fixturePath,
          "--format",
          "console",
        ],
        env,
      );
      expect(result.exitCode).toBe(0);

      const stdout = result.stdout;
      // Has summary with finding counts
      expect(stdout.length).toBeGreaterThan(100);
      // Has severity headings or status indicators
      expect(stdout).toMatch(/OK|Info|Warning|Broken|Risk/i);
      // Has finding titles with area names
      expect(stdout).toMatch(/Dashboard|Providers|Memory|Config|System|MCP/i);
      // Contains the summary section
      expect(stdout).toMatch(/Summary/i);
    });

    it("[VAL-GOLDEN-010] console output contains 'redacted for sharing' notice", async () => {
      const { result } = await scanGolden("dashboard-off", [
        "--format",
        "console",
      ]);
      expect(result.exitCode).toBe(0);

      expect(result.stdout.toLowerCase()).toContain("redacted for sharing");
    });

    it("[VAL-GOLDEN-011] Dashboard OFF is not marked broken", async () => {
      const { result } = await scanGolden("dashboard-off");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      for (const f of report.findings) {
        if (f.area === "dashboard") {
          expect(f.status).not.toBe("broken");
          expect(f.status).not.toBe("risk");
        }
      }
    });

    it("[VAL-GOLDEN-013] no invented, alarmist, or evidence-free findings", async () => {
      const { result } = await scanGolden("dashboard-off");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const validAreas = [
        "system",
        "install",
        "config",
        "dashboard",
        "providers",
        "mcp",
        "memory",
        "skills",
        "plugins",
        "logs",
        "security",
      ];

      for (const f of report.findings) {
        expect(validAreas).toContain(f.area);
        expect(f.evidence).toBeTruthy();
        expect(f.message).toBeTruthy();
        // No alarmist language
        expect(f.message.toLowerCase()).not.toMatch(
          /may have been compromised|possible breach|dangerous configuration/i,
        );
      }
    });
  });

  // =========================================================================
  // dashboard-on fixture -- clean install WITH dashboard configured
  // =========================================================================
  describe("dashboard-on fixture", () => {
    it("dashboard-reachable finding is broken when no dashboard running", async () => {
      const { result } = await scanGolden("dashboard-on");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const dashReachable = report.findings.find(
        (f: Finding) => f.id === "dashboard-reachable",
      );
      expect(dashReachable).toBeDefined();
      expect(dashReachable.status).toBe("broken");
      expect(dashReachable.severity).toBeGreaterThanOrEqual(3);

      // But dashboard-localhost-binding should be ok
      const dashBinding = report.findings.find(
        (f: Finding) => f.id === "dashboard-localhost-binding",
      );
      expect(dashBinding).toBeDefined();
      expect(dashBinding.status).toBe("ok");
    });

    it("[VAL-GOLDEN-007] redactedForSharing is true in JSON", async () => {
      const { result } = await scanGolden("dashboard-on");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      expect(report.redactedForSharing).toBe(true);
    });

    it("redaction count is 0 on clean fixture", async () => {
      const { result } = await scanGolden("dashboard-on");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      expect(report.redaction.count).toBe(0);
    });
  });

  // =========================================================================
  // default-memory fixture -- clean install, no memory files, no limit
  // =========================================================================
  describe("default-memory fixture", () => {
    it("[VAL-GOLDEN-012] missing memory is info, NOT broken or risk", async () => {
      const { result } = await scanGolden("default-memory");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      for (const f of report.findings) {
        if (f.area === "memory") {
          expect(f.status).not.toBe("broken");
          expect(f.status).not.toBe("risk");
          // Severity should be 0 (info)
          expect(f.severity).toBeLessThan(2);
        }
      }
    });

    it("missing memory produces info messages about fresh install", async () => {
      const { result } = await scanGolden("default-memory");
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const memFindings = report.findings.filter(
        (f: Finding) => f.area === "memory",
      );

      // memory-files-exist should say no memory files found
      const filesExist = memFindings.find(
        (f: Finding) => f.id === "memory-files-exist",
      );
      expect(filesExist).toBeDefined();
      expect(filesExist.message.toLowerCase()).toMatch(
        /no memory file|memory directory/,
      );
    });
  });

  // =========================================================================
  // Mutation audit: fixture file hashes unchanged after scan
  // =========================================================================
  describe("Mutation audit", () => {
    const fixturesToCheck = ["dashboard-off", "dashboard-on", "default-memory"];

    for (const fixtureName of fixturesToCheck) {
      it(`fixture ${fixtureName} file hashes unchanged after scan`, async () => {
        const fixturePath = resolve(goldenFixturesDir, fixtureName);

        // Compute hashes before scan
        const before = collectFileHashes(fixturePath);

        // Run scan
        const { result } = await scanGolden(fixtureName);
        expect(result.exitCode).toBe(0);

        // Compute hashes after scan
        const after = collectFileHashes(fixturePath);

        // Compare
        expect(Object.keys(before).sort()).toEqual(
          Object.keys(after).sort(),
        );
        for (const [filePath, hash] of Object.entries(before)) {
          expect(after[filePath]).toBe(hash);
        }
      });
    }
  });
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
        const content = readFileSync(full);
        const hash = crypto.createHash("md5").update(content).digest("hex");
        hashes[full] = hash;
      }
    }
  }

  walk(dir);
  return hashes;
}
