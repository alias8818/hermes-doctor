import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as crypto from "node:crypto";
import * as os from "node:os";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", "..");
const cliEntry = resolve(here, "..", "index.ts");
const tsxBin = resolve(repoRoot, "node_modules", ".bin", "tsx");
const fixturesDir = resolve(repoRoot, "fixtures", "validation", "provider");

const providerEnvVars = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "MISTRAL_API_KEY",
  "COHERE_API_KEY",
  "OPENROUTER_API_KEY",
  "OLLAMA_API_KEY",
  "MY_LOCAL_KEY",
  "FS_TOKEN",
  "GITHUB_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "HF_TOKEN",
];

/**
 * Create an env with all provider API keys stripped from the host env,
 * then selectively add only the keys each fixture needs.
 */
function envWithoutProviderKeys(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of providerEnvVars) {
    delete env[key];
  }
  return env;
}

/**
 * Scan a fixture with a specific set of env vars injected.
 * The fixture's .env files can't be relied upon because .env
 * is gitignored, so we pass keys directly via execa's env.
 */
async function scanWithEnv(
  fixtureName: string,
  extraEnv: Record<string, string>,
  extraArgs: string[] = [],
) {
  const fixturePath = resolve(fixturesDir, fixtureName);
  const env = { ...envWithoutProviderKeys(), ...extraEnv };
  const result = await execa(tsxBin, [cliEntry, "scan", "--hermes-home", fixturePath, "--format", "json", ...extraArgs], {
    reject: false,
    env,
  });
  return { result, fixturePath };
}

/**
 * Scan a direct fixture path (for temp directories) instead of by name.
 */
async function scanPathWithEnv(
  fixturePath: string,
  extraEnv: Record<string, string>,
) {
  const env = { ...envWithoutProviderKeys(), ...extraEnv };
  const result = await execa(tsxBin, [cliEntry, "scan", "--hermes-home", fixturePath, "--format", "json"], {
    reject: false,
    env,
  });
  return { result, fixturePath };
}

type EvidenceItem = {
  label: string;
  detail: string;
  source?: string;
  confidence?: string;
  redacted?: boolean;
};

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
 * Helper to find a structured evidence item by label from an evidence array or record.
 * Works with both Evidence[] and Record formats.
 */
function findEvidence(
  evidence: Record<string, unknown> | EvidenceItem[],
  label: string,
): string | undefined {
  if (Array.isArray(evidence)) {
    return evidence.find((e: EvidenceItem) => e.label === label)?.detail;
  }
  // Legacy Record format
  const val = evidence[label];
  return val !== undefined ? String(val) : undefined;
}

/**
 * Helper to parse a JSON-stringified evidence item detail back into its structured form.
 */
function parseEvidenceDetail<T>(evidence: Record<string, unknown> | EvidenceItem[], label: string): T | undefined {
  const raw = findEvidence(evidence, label);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
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
  if (fixes.length > 1) return 3; // multiple fixes is good
  const fix = fixes[0]!;
  if (!fix.title) return 0;
  if (fix.command && fix.command.length > 10) {
    // Specific command that references something from the finding
    return 3;
  }
  if (fix.description && fix.description.length > 15) return 2;
  return 1;
}

describe("VAL-PROV: Provider Failures", () => {
  // =========================================================================
  // 1. Missing active provider API key
  // Provider 'anthropic' configured with api_key_env: ANTHROPIC_API_KEY
  // but we only set OPENAI_API_KEY, so anthropic's key is missing for
  // a configured provider -> broken sev >= 3
  // =========================================================================
  describe("[VAL-PROV-005] Missing active provider API key", () => {
    const env = { OPENAI_API_KEY: "sk-test-1234567890abcdef1234567890abcdef" };

    it("detects missing provider API key as broken", async () => {
      const { result } = await scanWithEnv("missing-api-key", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const envVarFinding = report.findings.find(
        (f: Finding) => f.id === "providers-env-vars",
      );
      expect(envVarFinding).toBeDefined();
      expect(envVarFinding.status).toBe("broken");
      expect(envVarFinding.severity).toBeGreaterThanOrEqual(3);

      // Must name the provider and the missing env var
      const msg = envVarFinding.message.toLowerCase();
      expect(msg).toMatch(/missing|not set|not found/);
      expect(envVarFinding.evidence).toBeDefined();
      const provEntries = parseEvidenceDetail<Array<{
        name: string;
        env_set: boolean;
        required_env: string[];
      }>>(envVarFinding.evidence, "providers");
      expect(provEntries).toBeDefined();
      const missingAnthropic = provEntries!.find(
        (p) => p.name === "anthropic" && !p.env_set,
      );
      expect(missingAnthropic).toBeDefined();
      expect(missingAnthropic!.required_env).toContain("ANTHROPIC_API_KEY");

      // Fix guidance must be present and specific
      expect(envVarFinding.fixes).toBeDefined();
      expect(envVarFinding.fixes.length).toBeGreaterThanOrEqual(1);
      expect(envVarFinding.fixes[0].title).toBeTruthy();

      // Fix guidance score >= 3 for core findings
      expect(scoreFixGuidance(envVarFinding)).toBeGreaterThanOrEqual(3);
    });

    it("does not leak raw API key values in output", async () => {
      const { result } = await scanWithEnv("missing-api-key", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const stdout = result.stdout;
      const stdoutLower = stdout.toLowerCase();
      expect(stdoutLower).not.toContain("sk-test-1234567890");
      expect(stdoutLower).not.toContain("sk-ant-test-1234567890");
      expect(report.redaction).toBeDefined();
    });
  });

  // =========================================================================
  // 2. Malformed API key (wrong prefix)
  // Anthropic key expected to start with "sk-ant-" but given a wrong prefix
  // OpenAI key expected to start with "sk-" but given a wrong prefix
  // Both keys set but with wrong format -> warning sev 1-2
  // =========================================================================
  describe("[VAL-PROV-006] Malformed API key detected as warning", () => {
    const env = {
      ANTHROPIC_API_KEY: "wrong-prefix-key-not-starting-with-sk-ant",
      OPENAI_API_KEY: "bad-format-openai-key-no-sk-prefix",
    };

    it("detects malformed API keys as warning", async () => {
      const { result } = await scanWithEnv("malformed-key", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const keyFormatFinding = report.findings.find(
        (f: Finding) => f.id === "providers-key-format",
      );
      expect(keyFormatFinding).toBeDefined();
      expect(keyFormatFinding.status).toBe("warning");
      expect(keyFormatFinding.severity).toBeGreaterThanOrEqual(1);
      expect(keyFormatFinding.severity).toBeLessThanOrEqual(2);

      // Must name provider and mention malformed/wrong format
      const msg = keyFormatFinding.message.toLowerCase();
      expect(msg).toMatch(/malformed|unexpected format|wrong prefix|incorrect length/i);

      // Evidence must include key_checks array
      expect(keyFormatFinding.evidence).toBeDefined();
      const keyChecks = parseEvidenceDetail<Array<{ provider: string; format_ok: boolean }>>(keyFormatFinding.evidence, "key_checks");
      expect(keyChecks).toBeDefined();
      const malformedChecks = keyChecks!.filter(
        (k) => !k.format_ok,
      );
      expect(malformedChecks.length).toBeGreaterThanOrEqual(1);

      // Fix guidance score >= 2
      expect(scoreFixGuidance(keyFormatFinding)).toBeGreaterThanOrEqual(2);

      // NO raw key value should appear in output
      const stdoutLower = result.stdout.toLowerCase();
      expect(stdoutLower).not.toContain("wrong-prefix-key-not-starting-with-sk-ant");
      expect(stdoutLower).not.toContain("bad-format-openai-key-no-sk-prefix");
    });

    it("does not contain any raw key values in output", async () => {
      const { result } = await scanWithEnv("malformed-key", env);
      expect(result.exitCode).toBe(0);

      const stdout = result.stdout;
      expect(stdout).not.toContain("wrong-prefix-key-not-starting-with-sk-ant");
      expect(stdout).not.toContain("bad-format-openai-key-no-sk-prefix");
    });
  });

  // =========================================================================
  // 3. Model configured with no provider section [KNOWN LIMITATION]
  // The default_model references 'claude-opus-4-20250514' but there are
  // no named provider configs. Current Doctor checks don't detect orphaned
  // model-to-provider references.
  // =========================================================================
  describe("[VAL-PROV-007] Model with no provider section", () => {
    const env = { ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890" };

    it("collects provider data (known limitation: no check for orphaned models)", async () => {
      const { result } = await scanWithEnv("missing-provider-section", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const provFindings = report.findings.filter(
        (f: Finding) => f.area === "providers",
      );
      expect(provFindings.length).toBeGreaterThanOrEqual(1);

      console.log(
        `[KNOWN LIMITATION] Missing-provider-section: ${provFindings.filter((f: Finding) => f.status === "broken" || f.status === "risk").length} broken/risk provider findings`,
      );
    });

    it("produces no dashboard broken/risk findings (negative assertion)", async () => {
      const { result } = await scanWithEnv("missing-provider-section", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      for (const f of report.findings.filter((f: Finding) => f.area === "dashboard")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });
  });

  // =========================================================================
  // 4. Custom provider missing base_url [KNOWN LIMITATION]
  // 'my-local-llm' is a custom provider without base_url.
  // Current Doctor doesn't validate that custom providers have base_url.
  // =========================================================================
  describe("[VAL-PROV-008] Custom provider missing base_url", () => {
    const env = {
      ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890",
      MY_LOCAL_KEY: "sk-test-local-key-value-abcdef1234567890",
    };

    it("collects provider data (known limitation: no check for missing base_url)", async () => {
      const { result } = await scanWithEnv("custom-missing-base-url", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const provFindings = report.findings.filter(
        (f: Finding) => f.area === "providers",
      );
      expect(provFindings.length).toBeGreaterThanOrEqual(1);

      console.log(
        "[KNOWN LIMITATION] Custom provider missing base_url: not detected by current Doctor checks",
      );
    });

    it("produces no dashboard broken/risk findings (negative assertion)", async () => {
      const { result } = await scanWithEnv("custom-missing-base-url", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      for (const f of report.findings.filter((f: Finding) => f.area === "dashboard")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });
  });

  // =========================================================================
  // 5. Dead localhost custom provider endpoint
  // 'ollama' is a known provider with base_url: http://127.0.0.1:19999
  // Port 19999 is not running -> reachable false -> broken sev 3
  // =========================================================================
  describe("[VAL-PROV-009] Dead localhost custom provider endpoint", () => {
    const env = {
      ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890",
      OLLAMA_API_KEY: "ollama-test-key-here-12345678",
    };

    it("detects unreachable localhost endpoint as broken", async () => {
      const { result } = await scanWithEnv("dead-localhost-endpoint", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const endpointFinding = report.findings.find(
        (f: Finding) => f.id === "providers-local-endpoints",
      );
      expect(endpointFinding).toBeDefined();
      expect(endpointFinding.status).toBe("broken");
      expect(endpointFinding.severity).toBeGreaterThanOrEqual(3);

      // Should identify the unreachable URL
      const msg = endpointFinding.message.toLowerCase();
      expect(msg).toMatch(/unreachable|not reachable/);

      // Evidence must include local_endpoints array
      expect(endpointFinding.evidence).toBeDefined();
      const endpoints = parseEvidenceDetail<Array<{ url: string; reachable: boolean }>>(endpointFinding.evidence, "local_endpoints");
      expect(endpoints).toBeDefined();
      const deadEndpoint = endpoints!.find((e) => !e.reachable);
      expect(deadEndpoint).toBeDefined();
      expect(deadEndpoint!.url).toMatch(/127\.0\.0\.1/);

      // Fix guidance score >= 3 for core provider findings
      expect(scoreFixGuidance(endpointFinding)).toBeGreaterThanOrEqual(3);
    });

    it("fix guidance names the specific provider and suggests action", async () => {
      const { result } = await scanWithEnv("dead-localhost-endpoint", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const endpointFinding = report.findings.find(
        (f: Finding) => f.id === "providers-local-endpoints",
      );

      expect(endpointFinding.fixes).toBeDefined();
      expect(endpointFinding.fixes.length).toBeGreaterThanOrEqual(1);

      // Fix should be copyable/manual (no auto-editing)
      const fix = endpointFinding.fixes[0];
      expect(fix.title).toBeTruthy();
      expect(fix.command || fix.description).toBeTruthy();
    });
  });

  // =========================================================================
  // 6. auth.json active_provider conflict [KNOWN LIMITATION]
  // Fixture contains auth.json with active_provider: "openai" but
  // config.yaml default_model is claude-sonnet-4 (anthropic).
  // Current Doctor doesn't read auth.json for provider conflicts.
  // =========================================================================
  describe("[VAL-PROV-010] auth.json active_provider conflict", () => {
    const env = {
      ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890",
      OPENAI_API_KEY: "sk-test-1234567890abcdef1234567890abcdef",
    };

    it("may or may not detect auth.json active_provider mismatch (known limitation)", async () => {
      const { result } = await scanWithEnv("auth-conflict", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const provFindings = report.findings.filter(
        (f: Finding) => f.area === "providers",
      );

      const conflictFindings = provFindings.filter(
        (f: Finding) =>
          f.message.toLowerCase().includes("conflict") ||
          f.message.toLowerCase().includes("mismatch") ||
          f.message.toLowerCase().includes("auth.json") ||
          f.message.toLowerCase().includes("inconsistent"),
      );

      if (conflictFindings.length > 0) {
        for (const cf of conflictFindings) {
          expect(cf.message.toLowerCase()).toMatch(
            /(auth\.json|config\.yaml)/i,
          );
        }
      }

      console.log(
        `[KNOWN LIMITATION] auth.json conflict: ${conflictFindings.length} findings mentioning conflict`,
      );
    });

    it("produces no dashboard broken/risk findings (negative assertion)", async () => {
      const { result } = await scanWithEnv("auth-conflict", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      for (const f of report.findings.filter((f: Finding) => f.area === "dashboard")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });
  });

  // =========================================================================
  // 7. Malformed fallback provider config [KNOWN LIMITATION]
  // anthropic section has fallback_providers: "not-an-array" (string not array).
  // Current Doctor doesn't validate fallback_providers format.
  // =========================================================================
  describe("[VAL-PROV-011] Malformed fallback provider config", () => {
    const env = {
      ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890",
      OPENAI_API_KEY: "sk-test-1234567890abcdef1234567890abcdef",
    };

    it("may or may not detect malformed fallback config (known limitation)", async () => {
      const { result } = await scanWithEnv("malformed-fallback", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const provFindings = report.findings.filter(
        (f: Finding) => f.area === "providers",
      );

      const fallbackFindings = provFindings.filter(
        (f: Finding) => f.message.toLowerCase().includes("fallback"),
      );

      if (fallbackFindings.length > 0) {
        for (const ff of fallbackFindings) {
          expect(ff.status).toBe("broken");
          expect(ff.severity).toBeGreaterThanOrEqual(3);
        }
      }

      console.log(
        `[KNOWN LIMITATION] Malformed fallback: ${fallbackFindings.length} findings mentioning fallback`,
      );
    });

    it("produces no dashboard broken/risk findings (negative assertion)", async () => {
      const { result } = await scanWithEnv("malformed-fallback", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      for (const f of report.findings.filter((f: Finding) => f.area === "dashboard")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });
  });

  // =========================================================================
  // 8. Auxiliary model/provider missing [KNOWN LIMITATION]
  // Config references 'embeddings.provider: cohere' and 'classification.provider: openai'
  // but only anthropic has a real section in config. Cohere and openai are not
  // properly configured with API key env vars.
  // =========================================================================
  describe("[VAL-PROV-012] Auxiliary model/provider missing", () => {
    const env = {
      ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890",
      OPENAI_API_KEY: "sk-test-1234567890abcdef1234567890abcdef",
    };

    it("may or may not detect missing auxiliary model/provider (known limitation)", async () => {
      const { result } = await scanWithEnv("missing-auxiliary", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const provFindings = report.findings.filter(
        (f: Finding) => f.area === "providers",
      );

      console.log(
        `[KNOWN LIMITATION] Missing auxiliary: ${provFindings.length} provider findings`,
      );
    });

    it("produces no dashboard broken/risk findings (negative assertion)", async () => {
      const { result } = await scanWithEnv("missing-auxiliary", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      for (const f of report.findings.filter((f: Finding) => f.area === "dashboard")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });
  });

  // =========================================================================
  // 9. Custom provider with wrong key format
  // Groq key should start with "gsk_" but given a wrong prefix
  // -> warning sev 1-2
  // =========================================================================
  describe("[VAL-PROV-013] Custom provider wrong key format", () => {
    const env = {
      GROQ_API_KEY: "wrong-prefix-groq-key-not-starting-with-gsk_",
      ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890",
    };

    it("detects wrong key format as warning", async () => {
      const { result } = await scanWithEnv("custom-wrong-key-format", env);
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const keyFormatFinding = report.findings.find(
        (f: Finding) => f.id === "providers-key-format",
      );
      expect(keyFormatFinding).toBeDefined();
      expect(keyFormatFinding.status).toBe("warning");
      expect(keyFormatFinding.severity).toBeGreaterThanOrEqual(1);
      expect(keyFormatFinding.severity).toBeLessThanOrEqual(2);

      // Evidence must include key_checks array with format info - NO raw key values
      expect(keyFormatFinding.evidence).toBeDefined();
      const keyChecks = parseEvidenceDetail<Array<{ provider: string; format_ok: boolean }>>(keyFormatFinding.evidence, "key_checks");
      expect(keyChecks).toBeDefined();

      // groq key has wrong prefix (expected gsk_)
      const groqCheck = keyChecks!.find(
        (k) => k.provider === "groq" && !k.format_ok,
      );
      expect(groqCheck).toBeDefined();

      // Fix guidance score >= 2
      expect(scoreFixGuidance(keyFormatFinding)).toBeGreaterThanOrEqual(2);

      // NO raw key value in output
      const stdoutLower = result.stdout.toLowerCase();
      expect(stdoutLower).not.toContain("wrong-prefix-groq-key");
    });
  });

  // =========================================================================
  // 10. Negative: Broken MCP fixture produces no provider findings
  // =========================================================================
  describe("[VAL-PROV-014] Negative: Broken MCP fixture", () => {
    it("produces MCP findings but NO provider broken/risk findings", async () => {
      const mcpFixturePath = resolve(repoRoot, "fixtures", "hermes-broken-mcp");
      const env = {
        ...envWithoutProviderKeys(),
        OPENAI_API_KEY: "sk-test-1234567890abcdef1234567890abcdef",
        ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890",
      };

      const result = await execa(tsxBin, [cliEntry, "scan", "--hermes-home", mcpFixturePath, "--format", "json"], {
        reject: false,
        env,
      });
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      const mcpFindings = report.findings.filter(
        (f: Finding) => f.area === "mcp",
      );
      const providerFindings = report.findings.filter(
        (f: Finding) => f.area === "providers",
      );

      // Must have at least one MCP finding
      expect(mcpFindings.length).toBeGreaterThanOrEqual(1);

      // Zero provider broken/risk findings
      const providerBrokenRisk = providerFindings.filter(
        (f: Finding) => f.status === "broken" || f.status === "risk",
      );
      expect(providerBrokenRisk).toHaveLength(0);

      // All provider findings are ok/info/warning
      for (const f of providerFindings) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });
  });

  // =========================================================================
  // 11. Negative: Provider failures produce no dashboard findings
  // =========================================================================
  describe("[VAL-PROV-015] Negative: No dashboard findings from provider failures", () => {
    const providerFixtures: Array<{ name: string; env: Record<string, string> }> = [
      { name: "missing-api-key", env: { OPENAI_API_KEY: "sk-test-1234567890abcdef1234567890abcdef" } },
      { name: "malformed-key", env: { ANTHROPIC_API_KEY: "wrong-prefix", OPENAI_API_KEY: "bad-prefix" } },
      { name: "missing-provider-section", env: { ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890" } },
      { name: "custom-missing-base-url", env: { ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890", MY_LOCAL_KEY: "test-key" } },
      { name: "dead-localhost-endpoint", env: { ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890", OLLAMA_API_KEY: "test-key" } },
      { name: "auth-conflict", env: { ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890", OPENAI_API_KEY: "sk-test-1234567890abcdef1234567890abcdef" } },
      { name: "malformed-fallback", env: { ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890", OPENAI_API_KEY: "sk-test-1234567890abcdef1234567890abcdef" } },
      { name: "missing-auxiliary", env: { ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890", OPENAI_API_KEY: "sk-test-1234567890abcdef1234567890abcdef" } },
      { name: "custom-wrong-key-format", env: { GROQ_API_KEY: "wrong-prefix", ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890" } },
    ];

    for (const { name, env: fixtureEnv } of providerFixtures) {
      it(`fixture '${name}' has no dashboard broken/risk findings`, async () => {
        const { result } = await scanWithEnv(name, fixtureEnv);
        expect(result.exitCode).toBe(0);

        const report = JSON.parse(result.stdout);
        for (const f of report.findings.filter((f: Finding) => f.area === "dashboard")) {
          expect(f.status).not.toBe("broken");
          expect(f.status).not.toBe("risk");
        }

        // Must have provider findings
        expect(
          report.findings.filter((f: Finding) => f.area === "providers").length,
        ).toBeGreaterThanOrEqual(1);
      });
    }
  });

  // =========================================================================
  // Fix Guidance Scoring
  // =========================================================================
  describe("Fix guidance quality", () => {
    const fixtureList: Array<{ name: string; env: Record<string, string> }> = [
      { name: "missing-api-key", env: { OPENAI_API_KEY: "sk-test-1234567890abcdef1234567890abcdef" } },
      { name: "malformed-key", env: { ANTHROPIC_API_KEY: "wrong-prefix", OPENAI_API_KEY: "bad-prefix" } },
      { name: "dead-localhost-endpoint", env: { ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890", OLLAMA_API_KEY: "test-key" } },
      { name: "custom-wrong-key-format", env: { GROQ_API_KEY: "wrong-prefix", ANTHROPIC_API_KEY: "sk-ant-test-1234567890abcdef1234567890" } },
    ];

    it("all fix guidance scores >= 2, core findings >= 3", { timeout: 30_000 }, async () => {
      for (const { name, env: fixtureEnv } of fixtureList) {
        const { result } = await scanWithEnv(name, fixtureEnv);
        expect(result.exitCode).toBe(0);

        const report = JSON.parse(result.stdout);
        for (const f of report.findings as Finding[]) {
          if (!f.fixes || f.fixes.length === 0) continue;
          const score = scoreFixGuidance(f);
          if (f.severity >= 3) {
            expect(score).toBeGreaterThanOrEqual(3);
          } else {
            expect(score).toBeGreaterThanOrEqual(2);
          }
        }
      }
    });

    it("fix guidance is copyable/manual (no auto-editing)", async () => {
      const { result } = await scanWithEnv("missing-api-key", {
        OPENAI_API_KEY: "sk-test-1234567890abcdef1234567890abcdef",
      });
      expect(result.exitCode).toBe(0);

      const report = JSON.parse(result.stdout);
      for (const f of report.findings as Finding[]) {
        if (!f.fixes) continue;
        for (const fix of f.fixes) {
          if (fix.command) {
            expect(fix.command).not.toMatch(/sed -i/);
          }
        }
      }
    });
  });

  // =========================================================================
  // [VAL-PROV-016] Negative: Custom provider check does NOT fire on
  // any individual built-in provider
  // =========================================================================
  describe("[VAL-PROV-016] Negative: Custom provider check does NOT fire on built-in providers", () => {
    const builtInProviders = [
      "anthropic",
      "openai",
      "google",
      "gemini",
      "groq",
      "mistral",
      "cohere",
      "openrouter",
      "ollama",
    ];

    const builtInKeyEnv: Record<string, string> = {
      ANTHROPIC_API_KEY: "**************************************",
      OPENAI_API_KEY: "****************************************",
      GOOGLE_API_KEY: "**************************************",
      GEMINI_API_KEY: "**************************************",
      GROQ_API_KEY: "gsk_test_**************************************",
      MISTRAL_API_KEY: "**************************************",
      COHERE_API_KEY: "**************************************",
      OPENROUTER_API_KEY: "**************************************",
      OLLAMA_API_KEY: "**************************************",
    };

    for (const providerName of builtInProviders) {
      it(`built-in '${providerName}' without base_url does NOT produce custom-base-url finding`, async () => {
        // Create a temp fixture with just this one built-in provider (no base_url)
        const tmpDir = mkdtempSync(join(os.tmpdir(), "prov-neg-"));
        try {
          writeFileSync(
            join(tmpDir, "config.yaml"),
            [
              "profile: default",
              "providers:",
              `  default_model: test-model`,
              `  ${providerName}:`,
              `    api_key_env: ${providerName.toUpperCase()}_API_KEY`,
              "mcp:",
              "  servers: []",
              "memory:",
              "  dir: memory",
              "  limit_mb: 10",
              "",
            ].join("\n"),
            "utf-8",
          );
          // Write minimal auth.json
          writeFileSync(
            join(tmpDir, "auth.json"),
            JSON.stringify({ active_provider: providerName, version: "1.0" }),
            "utf-8",
          );
          mkdirSync(join(tmpDir, "memory"), { recursive: true });
          const { result } = await scanPathWithEnv(tmpDir, { ...builtInKeyEnv });
          expect(result.exitCode).toBe(0);
          const report = JSON.parse(result.stdout);
          const baseUrlFinding = report.findings.find(
            (f: Finding) => f.id === "providers-custom-base-url",
          );
          // Must NOT be broken (may be ok, info, or absent)
          if (baseUrlFinding) {
            expect(baseUrlFinding.status).not.toBe("broken");
          }
        } finally {
          rmSync(tmpDir, { recursive: true, force: true });
        }
      });
    }

    it("built-in providers scan completes without any broken base_url findings at all", async () => {
      // Test all 9 built-in providers in a single fixture
      const tmpDir = mkdtempSync(join(os.tmpdir(), "prov-all-"));
      try {
        const providerLines = builtInProviders.map((name) => [
          `  ${name}:`,
          `    api_key_env: ${name.toUpperCase()}_API_KEY`,
        ]).flat();
        writeFileSync(
          join(tmpDir, "config.yaml"),
          [
            "profile: default",
            "providers:",
            `  default_model: test-model`,
            ...providerLines,
            "mcp:",
            "  servers: []",
            "memory:",
            "  dir: memory",
            "  limit_mb: 10",
            "",
          ].join("\n"),
          "utf-8",
        );
        mkdirSync(join(tmpDir, "memory"), { recursive: true });
        const { result } = await scanPathWithEnv(tmpDir, builtInKeyEnv);
        expect(result.exitCode).toBe(0);
        const report = JSON.parse(result.stdout);
        const baseUrlFinding = report.findings.find(
          (f: Finding) => f.id === "providers-custom-base-url",
        );
        if (baseUrlFinding) {
          expect(baseUrlFinding.status).not.toBe("broken");
          // If there is a finding, its message must not mention any built-in provider
          const msg = baseUrlFinding.message.toLowerCase();
          for (const bp of builtInProviders) {
            expect(msg).not.toContain(bp);
          }
        }
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // =========================================================================
  // [VAL-PROV-017] Negative: auth-aligned fixture produces no conflict finding
  // =========================================================================
  describe("[VAL-PROV-017] Negative: Auth-aligned scenarios", () => {
    const env = {
      ANTHROPIC_API_KEY: "**************************************",
      OPENAI_API_KEY: "****************************************",
    };

    it("auth-aligned fixture (active_provider matches config) produces no conflict finding", async () => {
      const { result } = await scanWithEnv("auth-aligned", env);
      expect(result.exitCode).toBe(0);
      const report = JSON.parse(result.stdout);
      const conflictFinding = report.findings.find(
        (f: Finding) => f.id === "providers-auth-conflict",
      );
      // Must not produce a conflict finding when aligned
      if (conflictFinding) {
        expect(conflictFinding.status).not.toBe("broken");
        expect(conflictFinding.status).not.toBe("warning");
      }
    });

    it("auth-conflict fixture produces expected finding (positive control)", async () => {
      const { result } = await scanWithEnv("auth-conflict", env);
      expect(result.exitCode).toBe(0);
      const report = JSON.parse(result.stdout);
      const conflictFinding = report.findings.find(
        (f: Finding) => f.id === "providers-auth-conflict",
      );
      // The auth-conflict fixture should still produce a finding
      // (auth.json active_provider is reported as info since it's for dashboard web UI auth,
      // not model providers — no cross-referencing)
      expect(conflictFinding).toBeDefined();
      expect(conflictFinding!.status).toBe("info");
    });

    it("auth-aligned fixture with models field produces no orphaned-model finding", async () => {
      const { result } = await scanWithEnv("auth-aligned", env);
      expect(result.exitCode).toBe(0);
      const report = JSON.parse(result.stdout);
      const orphanedFinding = report.findings.find(
        (f: Finding) => f.id === "providers-orphaned-models",
      );
      if (orphanedFinding) {
        expect(orphanedFinding.status).not.toBe("broken");
      }
    });

    it("orphaned-models fixture: no orphan finding for model referencing known built-in provider", async () => {
      const { result } = await scanWithEnv("orphaned-models", env);
      expect(result.exitCode).toBe(0);
      const report = JSON.parse(result.stdout);
      const orphanedFinding = report.findings.find(
        (f: Finding) => f.id === "providers-orphaned-models",
      );
      // The fixture has model 'gpt-4' referencing provider 'openai'.
      // Since openai is a KNOWN_PROVIDER (built-in), the collector marks
      // providerExists: true even without an explicit config section.
      // So the check correctly reports 'ok' not 'broken'.
      if (orphanedFinding) {
        expect(orphanedFinding.status).not.toBe("broken");
      }
      console.log(
        "[INFO] Orphaned-models fixture: model ref to built-in 'openai' produces status:",
        orphanedFinding?.status ?? "(no finding)",
      );
    });

    it("auth-aligned fixture with models field produces no broken/risk dashboard or MCP findings", async () => {
      const { result } = await scanWithEnv("auth-aligned", env);
      expect(result.exitCode).toBe(0);
      const report = JSON.parse(result.stdout);
      for (const f of report.findings.filter((f: Finding) => f.area === "dashboard")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
      for (const f of report.findings.filter((f: Finding) => f.area === "mcp")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });
  });

  // =========================================================================
  // [VAL-PROV-018] Cross-area: Provider changes do NOT affect MCP findings
  // =========================================================================
  describe("[VAL-PROV-018] Cross-area isolation: provider changes don't affect MCP", () => {
    // Scan MCP fixtures while varying the provider config
    // If provider changes don't affect MCP, MCP findings should be identical
    async function mcpFindingsForFixture(
      fixturePath: string,
      extraEnv: Record<string, string>,
    ): Promise<string[]> {
      const r = await execa(
        tsxBin,
        [cliEntry, "scan", "--hermes-home", fixturePath, "--format", "json"],
        { reject: false, env: { ...envWithoutProviderKeys(), ...extraEnv } },
      );
      expect(r.exitCode).toBe(0);
      const report = JSON.parse(r.stdout);
      return report.findings
        .filter((f: Finding) => f.area === "mcp" && (f.status === "broken" || f.status === "warning"))
        .map((f: Finding) => `${f.id}:${f.status}:${f.severity}`)
        .sort();
    }

    it("mcp-only fixture's MCP findings are stable regardless of provider config", async () => {
      const mcpFixturePath = resolve(
        repoRoot,
        "fixtures",
        "validation",
        "cross-area",
        "mcp-broken-only",
      );

      // Run with different provider key configs and compare MCP findings
      const mcpWithOpenAI = await mcpFindingsForFixture(mcpFixturePath, {
        OPENAI_API_KEY: "****************************************",
        ANTHROPIC_API_KEY: "**************************************",
      });
      const mcpWithOnlyAnthropic = await mcpFindingsForFixture(mcpFixturePath, {
        ANTHROPIC_API_KEY: "**************************************",
      });
      const mcpWithNoKeys = await mcpFindingsForFixture(mcpFixturePath, {});

      // MCP findings should be identical regardless of provider env keys
      expect(mcpWithOpenAI).toEqual(mcpWithOnlyAnthropic);
      expect(mcpWithOpenAI).toEqual(mcpWithNoKeys);
    });
  });

  // =========================================================================
  // Mutation audit: fixture file hashes unchanged after scan
  // =========================================================================
  describe("Mutation audit", () => {
    const fixtureNames = [
      "missing-api-key",
      "malformed-key",
      "missing-provider-section",
      "custom-missing-base-url",
      "dead-localhost-endpoint",
      "auth-conflict",
      "malformed-fallback",
      "missing-auxiliary",
      "custom-wrong-key-format",
    ];

    for (const fixtureName of fixtureNames) {
      it(`fixture ${fixtureName} file hashes unchanged after scan`, async () => {
        const fixturePath = resolve(fixturesDir, fixtureName);

        // Compute hashes before scan
        const before = collectFileHashes(fixturePath);

        // Run scan
        const { result } = await scanWithEnv(fixtureName, {});
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
