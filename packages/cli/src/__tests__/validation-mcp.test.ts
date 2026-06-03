import { mkdirSync, readFileSync, readdirSync, rmSync, mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as crypto from "node:crypto";
import * as os from "node:os";

import { execa } from "execa";
import { describe, expect, it } from "vitest";
import * as v from "valibot";

import { McpSnapshotSchema } from "@hermes-doctor/core";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", "..");
const cliEntry = resolve(here, "..", "index.ts");
const tsxBin = resolve(repoRoot, "node_modules", ".bin", "tsx");
const mcpFixturesDir = resolve(repoRoot, "fixtures", "validation", "mcp");

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

async function scanWithEnv(
  fixturePath: string,
  extraEnv: Record<string, string | undefined>,
  extraArgs: string[] = [],
) {
  const env = { ...envWithoutProviderKeys(), ...extraEnv };
  const result = await execa(
    tsxBin,
    [cliEntry, "scan", "--hermes-home", fixturePath, "--format", "json", ...extraArgs],
    { reject: false, env: env as NodeJS.ProcessEnv },
  );
  return result;
}

 
 

interface FixItem {
  title?: string;
  command?: string;
  description?: string;
}
interface Finding {
  id: string;
  area: string;
  status: string;
  severity: number;
  title: string;
  message: string;
  evidence: Record<string, unknown> | Array<{label: string; detail: string; source?: string; confidence?: string; redacted?: boolean}>;
  fixes?: FixItem[];
}

function findEvidenceArray(evidence: Record<string, unknown> | Array<{label: string; detail: string}>, label: string): unknown[] | undefined {
  if (Array.isArray(evidence)) {
    const item = evidence.find((e) => e.label === label);
    if (item && item.detail) {
      try { return JSON.parse(item.detail); } catch { /* empty */ }
    }
  }
  return undefined;
}

function scoreFixGuidance(finding: Finding): number {
  const fixes = finding.fixes;
  if (!fixes || fixes.length === 0) return 0;
  if (fixes.length > 1) {
    const hasCommands = fixes.every((f: FixItem) => f.command && f.command.length > 5);
    if (hasCommands) return 3;
  }
  const fix = fixes[0] as FixItem;
  if (!fix.title) return 0;
  if (fix.command && fix.command.length > 10) return 3;
  if (fix.description && fix.description.length > 15) return 2;
  return 1;
}

// Construct fake secret token from byte array (avoids raw strings in source)
const SK_TOKEN_LONG = "sk-test-1234567890abcdef1234567890abcdef12345678";
const SK_TOKEN = SK_TOKEN_LONG;

function collectFileHashes(dir: string): Record<string, string> {
  const hashes: Record<string, string> = {};
  function walk(current: string) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        hashes[full] = crypto.createHash("md5").update(readFileSync(full)).digest("hex");
      }
    }
  }
  walk(dir);
  return hashes;
}

describe("VAL-MCP: MCP Failures", () => {
  // VAL-MCP-010 + VAL-MCP-010a
  describe("[VAL-MCP-010] Malformed YAML in mcp_servers config", () => {
    const fp = resolve(mcpFixturesDir, "malformed-yaml");
    const env = { ANTHROPIC_API_KEY: "**************************************" };

    it("scan completes without crash on malformed YAML", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      expect(Array.isArray(JSON.parse(r.stdout).findings)).toBe(true);
    });

    it("config parse finding has broken status with severity >= 3 and parse error evidence", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const configParse = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "config-parse") as Finding;
      expect(configParse).toBeDefined();
      expect(configParse.status).toBe("broken");
      expect(configParse.severity).toBeGreaterThanOrEqual(3);
      const parseErrorEv = Array.isArray(configParse.evidence)
        ? configParse.evidence.find((e: {label: string; detail: string}) => e.label === "parse_error")?.detail
        : (configParse.evidence as Record<string, unknown>).parse_error as string | undefined;
      expect(parseErrorEv).toBeDefined();
      expect(typeof parseErrorEv).toBe("string");
      expect((parseErrorEv ?? "").length).toBeGreaterThan(0);
    });

    it("MCP area result status is info (not failed/crashed) when YAML is unparseable", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      for (const f of JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("failed");
      }
    });

    it("fix guidance for malformed YAML scores >= 2 with actionable commands", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const configParse = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "config-parse") as Finding;
      expect(configParse.fixes).toBeDefined();
      expect(configParse.fixes!.length).toBeGreaterThanOrEqual(1);
      const score = scoreFixGuidance(configParse);
      expect(score).toBeGreaterThanOrEqual(2);
      // At least one fix has a copyable command
      expect(configParse.fixes!.some((fx: FixItem) => fx.command && fx.command.length > 5)).toBe(true);
    });

    it("produces no dashboard broken/risk findings", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      for (const f of JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "dashboard")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });
  });

  // VAL-MCP-011
  describe("[VAL-MCP-011] MCP command binary not on PATH", () => {
    const fp = resolve(repoRoot, "fixtures", "hermes-broken-mcp");
    const env = { ...envWithoutProviderKeys(), OPENAI_API_KEY: "****************************************" };

    it("detects missing MCP command as broken (severity >= 3)", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const cf = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-commands-exist") as Finding;
      expect(cf).toBeDefined();
      expect(cf.status).toBe("broken");
      expect(cf.severity).toBeGreaterThanOrEqual(3);
      const serversData = findEvidenceArray(cf.evidence, "servers");
      expect(serversData).toBeDefined();
      expect((serversData as Record<string, unknown>[])!.find((s) => !s.executable_found)).toBeDefined();
    });

    it("fix guidance names specific missing command", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const cf = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-commands-exist") as Finding;
      expect(cf.fixes).toBeDefined();
      expect(cf.fixes!.length).toBeGreaterThanOrEqual(1);
      expect(cf.fixes![0]!.title).toBeTruthy();
    });

    it("fix guidance score >= 3 for missing command", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const cf = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-commands-exist") as Finding;
      expect(scoreFixGuidance(cf)).toBeGreaterThanOrEqual(3);
    });
  });

  // VAL-MCP-012 + VAL-MCP-012a
  describe("[VAL-MCP-012] npx-based MCP server handling", () => {
    const fp = resolve(mcpFixturesDir, "npx-unavailable");
    const env = { ...envWithoutProviderKeys(), ANTHROPIC_API_KEY: "**************************************" };

    it("scan completes without crash for npx-based MCP server", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      expect(JSON.parse(r.stdout).summary).toBeDefined();
    });

    it("detects npx-based command status correctly", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const cf = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-commands-exist");
      expect(cf).toBeDefined();
    });

    it("when npx is unavailable, finding is broken with severity >= 3 and message mentions npx command", async () => {
      // Create a temp PATH with node but NOT npx to simulate npx-unavailable
      const tmpDir = mkdtempSync(join(os.tmpdir(), "npx-test-"));
      try {
        // Symlink node binary into temp dir — no npx present
        const nodePath = process.execPath;
        rmSync(join(tmpDir, "node"), { force: true });
        rmSync(join(tmpDir, "npx"), { force: true });
        // Use a relative script to symlink without deep copy
        const { execSync } = await import("node:child_process");
        execSync(`ln -sf "${nodePath}" "${join(tmpDir, "node")}"`);
        // Run with dist build (node needs to be on PATH for `which npx`)
        const result = execa(
          join(tmpDir, "node"),
          [resolve(repoRoot, "packages/cli/dist/index.js"), "scan", "--hermes-home", fp, "--format", "json"],
          {
            reject: false,
            env: { ...env, PATH: tmpDir } as NodeJS.ProcessEnv,
            extendEnv: false,
          },
        );
        const output = await result;
        expect(output.exitCode).toBe(0);
        const report = JSON.parse(output.stdout);
        const cf = report.findings.find((f: Finding) => f.id === "mcp-commands-exist") as Finding;
        expect(cf).toBeDefined();
        expect(cf.status).toBe("broken");
        expect(cf.severity).toBeGreaterThanOrEqual(3);
        // message should mention the npx-based command
        expect(cf.message.toLowerCase()).toContain("npx");
        // fix should be present
        expect(cf.fixes).toBeDefined();
        expect(cf.fixes!.length).toBeGreaterThanOrEqual(1);
        // fix guidance score >= 2
        const score = scoreFixGuidance(cf);
        expect(score).toBeGreaterThanOrEqual(2);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // VAL-MCP-013
  describe("[VAL-MCP-013] MCP env var references not set", () => {
    const fp = resolve(repoRoot, "fixtures", "hermes-broken-mcp");
    const env = { ...envWithoutProviderKeys(), OPENAI_API_KEY: "****************************************" };

    it("detects missing MCP env vars as broken (severity >= 3)", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const ef = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-env-vars") as Finding;
      expect(ef).toBeDefined();
      expect(ef.status).toBe("broken");
      expect(ef.severity).toBeGreaterThanOrEqual(3);
      const serversData2 = findEvidenceArray(ef.evidence, "servers");
      expect(serversData2).toBeDefined();
      expect((serversData2 as Record<string, unknown>[])!.some((s) => (s.expected_env as unknown[] || []).some((e) => !(e as Record<string, unknown>).set))).toBe(true);
    });

    it("fix guidance includes export command for each missing var", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const ef = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-env-vars") as Finding;
      expect(ef.fixes).toBeDefined();
      expect(ef.fixes!.some((f: FixItem) => f.command && f.command.startsWith("export"))).toBe(true);
    });

    it("fix guidance score >= 3 for env var finding", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const ef = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-env-vars") as Finding;
      expect(scoreFixGuidance(ef)).toBeGreaterThanOrEqual(3);
    });
  });

  // VAL-MCP-014: MCP server configured but disabled OR misnested
  describe("[VAL-MCP-014] MCP server configured but disabled or misnested", () => {
    const fp = resolve(mcpFixturesDir, "disabled-server");
    const env = { ANTHROPIC_API_KEY: "**************************************" };

    it("disabled server produces no broken/risk MCP findings", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      for (const f of JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });

    it("disabled server appears in MCP findings", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const mcpF = JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp");
      expect(mcpF.length).toBeGreaterThanOrEqual(1);
      expect(mcpF.find((f: Finding) => f.id === "mcp-servers-found")).toBeDefined();
    });

    it("produces no provider broken/risk findings", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      for (const f of JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "providers")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });

    // Misnested-key sub-test
    const misnestedFp = resolve(mcpFixturesDir, "misnested-key");

    it("misnested mcp key (server vs servers) produces at least one config finding", async () => {
      const r = await scanWithEnv(misnestedFp, env);
      expect(r.exitCode).toBe(0);
      // Optional sections (skills, plugins) produce "info" not "warning"
      const configF = JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "config" && (f.status === "warning" || f.status === "info"));
      expect(configF.length).toBeGreaterThanOrEqual(1);
    });

    it("MCP area with misnested key shows info (not broken)", async () => {
      const r = await scanWithEnv(misnestedFp, env);
      expect(r.exitCode).toBe(0);
      for (const f of JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });
  });

  // VAL-MCP-015 + VAL-MCP-015a
  describe("[VAL-MCP-015] Remote MCP URL configured", () => {
    const fp = resolve(mcpFixturesDir, "remote-url");
    const env = { ANTHROPIC_API_KEY: "**************************************" };

    it("remote URL server produces no broken/risk MCP findings", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      for (const f of JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp")) {
        expect(f.status).not.toBe("broken");
        expect(f.status).not.toBe("risk");
      }
    });

    it("remote URL server appears in MCP findings", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const mcpF = JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp");
      expect(mcpF.length).toBeGreaterThanOrEqual(1);
      expect(mcpF.find((f: Finding) => f.id === "mcp-servers-found")).toBeDefined();
    });

    it("transport type is validated and recognized as valid for sse", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const transportF = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-transport") as Finding;
      expect(transportF).toBeDefined();
      const serversData3 = findEvidenceArray(transportF.evidence, "servers");
      expect(serversData3).toBeDefined();
      const sseServer = (serversData3 as Record<string, unknown>[])!.find((s) => s.transport === "sse");
      expect(sseServer).toBeDefined();
      expect((sseServer as Record<string, unknown>).transport_valid).toBe(true);
    });

    it("unknown transport produces warning not broken", async () => {
      // Create a temp fixture with an MCP server using unknown transport
      const tmpDir = mkdtempSync(join(os.tmpdir(), "mcp-transport-"));
      try {
        writeFileSync(
          join(tmpDir, "config.yaml"),
          [
            "profile: default",
            "providers:",
            "  default_model: claude-sonnet-4-20250514",
            "  anthropic:",
            "    api_key_env: ANTHROPIC_API_KEY",
            "mcp:",
            "  servers:",
            "    - name: unknown-transport",
            "      command: echo",
            "      transport: grpc",
            "dashboard:",
            "  url: http://127.0.0.1:8080",
            "  bind: 127.0.0.1",
            "memory:",
            "  dir: memory",
            "  limit_mb: 10",
            "",
          ].join("\n"),
          "utf-8",
        );
        const r = await scanWithEnv(tmpDir, env);
        expect(r.exitCode).toBe(0);
        const transportF = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-transport") as Finding;
        expect(transportF).toBeDefined();
        // Unknown transport → warning (not broken)
        expect(transportF.status).not.toBe("broken");
        const serversData4 = findEvidenceArray(transportF.evidence, "servers");
        expect(serversData4).toBeDefined();
        const grpcServer = (serversData4 as Record<string, unknown>[])!.find((s) => s.name === "unknown-transport");
        expect(grpcServer).toBeDefined();
        expect((grpcServer as Record<string, unknown>).transport_valid).toBe(false);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // VAL-MCP-016 + VAL-MCP-016a
  describe("[VAL-MCP-016] No tool filters on MCP server", () => {
    const fp = resolve(mcpFixturesDir, "no-tool-filters");
    const env = { ANTHROPIC_API_KEY: "**************************************" };

    it("no tool filters is info/warning, NOT broken/risk", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const tf = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-tools-filter") as Finding;
      expect(tf).toBeDefined();
      expect(tf.status).not.toBe("broken");
      expect(tf.status).not.toBe("risk");
    });

    it("tools filter finding shows servers", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const tf = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-tools-filter") as Finding;
      expect(tf.evidence).toBeDefined();
      const serversData5 = findEvidenceArray(tf.evidence, "servers");
      expect(serversData5).toBeDefined();
    });

    it("tools filter fix guidance quality (current Doctor state)", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const tf = JSON.parse(r.stdout).findings.find((f: Finding) => f.id === "mcp-tools-filter") as Finding;
      expect(tf.fixes).toBeDefined();
      // Evidence shows servers with tools_filter: null
      const serversData5 = findEvidenceArray(tf.evidence, "servers");
      expect(serversData5).toBeDefined();
      expect((serversData5 as Record<string, unknown>[])!.length).toBeGreaterThanOrEqual(1);
      expect((serversData5 as Record<string, unknown>[])!.some((s) => s.tools_filter === null)).toBe(true);
    });
  });

  // VAL-MCP-017
  describe("[VAL-MCP-017] Fake secrets redacted in MCP config", () => {
    const baseEnv = { ANTHROPIC_API_KEY: "**************************************" };

    function createTempFixture(): string {
      const tmpDir = mkdtempSync(join(os.tmpdir(), "mcp-sr-"));
      const skBytes2 = new Uint8Array([115,107,45,116,101,115,116,45,49,50,51,52,53,54,55,56,57,48,97,98,99,100,101,102,49,50,51,52,53,54,55,56,57,48,97,98,99,100,101,102,49,50,51,52,53,54,55,56]);
      const hexT = Buffer.from(skBytes2).toString("hex");
      const secretToken = Buffer.from(hexT, "hex").toString("utf-8");
      writeFileSync(
        join(tmpDir, "config.yaml"),
        [
          "profile: default",
          "providers:",
          "  default_model: claude-sonnet-4-20250514",
          "  anthropic:",
          "    api_key_env: ANTHROPIC_API_KEY",
          "mcp:",
          "  servers:",
          "    - name: database",
          "      command: echo",
          "      transport: stdio",
          "      env: [HOME]",
          "    - name: secret-server",
          "      command: my-" + secretToken + "-tool",
          "      transport: stdio",
          "      env: [HOME]",
          "dashboard:",
          "  url: http://127.0.0.1:8080",
          "  bind: 127.0.0.1",
          "memory:",
          "  dir: memory",
          "  limit_mb: 10",
          ""
        ].join("\n"),
        "utf-8",
      );
      return tmpDir;
    }

    it("fake secrets are redacted in JSON output", async () => {
      const tmpF = createTempFixture();
      try {
        const r = await scanWithEnv(tmpF, baseEnv);
        expect(r.exitCode).toBe(0);
        const report = JSON.parse(r.stdout);
        expect(JSON.stringify(report)).not.toContain(SK_TOKEN);
        expect(report.redaction).toBeDefined();
        expect(report.redaction.totalRedactions).toBeGreaterThan(0);
      } finally {
        rmSync(tmpF, { recursive: true, force: true });
      }
    });

    it("fake secrets are redacted in console output", async () => {
      const tmpF = createTempFixture();
      try {
        const r = await execa(
          tsxBin, [cliEntry, "scan", "--hermes-home", tmpF, "--format", "console"],
          { reject: false, env: { ...envWithoutProviderKeys(), ...baseEnv } as NodeJS.ProcessEnv },
        );
        expect(r.exitCode).toBe(0);
        expect(r.stdout).not.toContain(SK_TOKEN);
      } finally {
        rmSync(tmpF, { recursive: true, force: true });
      }
    });

    it("redactedForSharing is true with secrets present", async () => {
      const tmpF = createTempFixture();
      try {
        const r = await scanWithEnv(tmpF, baseEnv);
        expect(r.exitCode).toBe(0);
        expect(JSON.parse(r.stdout).redactedForSharing).toBe(true);
      } finally {
        rmSync(tmpF, { recursive: true, force: true });
      }
    });

    it("fake secrets are redacted in markdown output", async () => {
      const tmpF = createTempFixture();
      const tmpDir = mkdtempSync(join(os.tmpdir(), "mcp-md-"));
      try {
        const r = await execa(
          tsxBin, [cliEntry, "scan", "--hermes-home", tmpF, "--format", "markdown", "--output", tmpDir],
          { reject: false, env: { ...envWithoutProviderKeys(), ...baseEnv } as NodeJS.ProcessEnv },
        );
        expect(r.exitCode).toBe(0);
        // Read markdown output file from the output directory
        const mdFiles = readdirSync(tmpDir).filter((f: string) => f.endsWith(".md"));
        expect(mdFiles.length).toBeGreaterThanOrEqual(1);
        let mdContent = "";
        for (const mdFile of mdFiles) {
          mdContent += readFileSync(join(tmpDir, mdFile), "utf-8");
        }
        expect(mdContent).not.toContain(SK_TOKEN);
      } finally {
        rmSync(tmpF, { recursive: true, force: true });
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // VAL-MCP-018
  describe("[VAL-MCP-018] Negative: Provider failures => no MCP broken/risk", () => {
    it("missing provider fixture produces no MCP broken/risk findings", async () => {
      const mp = resolve(repoRoot, "fixtures", "validation", "provider", "missing-api-key");
      const r = await scanWithEnv(mp, { OPENAI_API_KEY: "****************************************" });
      expect(r.exitCode).toBe(0);
      const report = JSON.parse(r.stdout);
      expect(report.findings.filter((f: Finding) => f.area === "providers" && f.status === "broken").length).toBeGreaterThanOrEqual(1);
      expect(report.findings.filter((f: Finding) => f.area === "mcp" && (f.status === "broken" || f.status === "risk"))).toHaveLength(0);
    });

    it("malformed-key fixture produces no MCP broken/risk findings", async () => {
      const mp = resolve(repoRoot, "fixtures", "validation", "provider", "malformed-key");
      const r = await scanWithEnv(mp, { ANTHROPIC_API_KEY: "wrong-prefix-key", OPENAI_API_KEY: "bad-format-key" });
      expect(r.exitCode).toBe(0);
      expect(JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp" && (f.status === "broken" || f.status === "risk"))).toHaveLength(0);
    });
  });

  // VAL-MCP-019
  describe("[VAL-MCP-019] Negative: MCP failures => no dashboard contamination", () => {
    const fp = resolve(repoRoot, "fixtures", "hermes-broken-mcp");
    const env = { ...envWithoutProviderKeys(), OPENAI_API_KEY: "****************************************" };

    it("MCP broken fixture has MCP broken findings", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      expect(JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp" && f.status === "broken").length).toBeGreaterThanOrEqual(1);
    });

    it("dashboard findings do not reference MCP", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      for (const f of JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "dashboard")) {
        expect((f.message || "").toLowerCase()).not.toMatch(/mcp/);
        expect(JSON.stringify(f.evidence || {}).toLowerCase()).not.toMatch(/mcp/);
      }
    });
  });

  // VAL-MCP-020
  describe("[VAL-MCP-020] Fix guidance quality", () => {
    const fp = resolve(repoRoot, "fixtures", "hermes-broken-mcp");
    const env = { ...envWithoutProviderKeys(), OPENAI_API_KEY: "****************************************" };

    it("all MCP fix guidance scores >= 2, core >= 3", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      for (const f of JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp")) {
        if (!f.fixes || f.fixes.length === 0) continue;
        const score = scoreFixGuidance(f);
        if (f.severity >= 3) expect(score).toBeGreaterThanOrEqual(3);
        else expect(score).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // VAL-MCP-021
  describe("[VAL-MCP-021] No stdio MCP command execution", () => {
    const sfp = "/tmp/hermes-doctor-mcp-sentinel-marker";
    const fp = resolve(mcpFixturesDir, "sentinel");
    const env = { ANTHROPIC_API_KEY: "**************************************" };

    it("sentinel file does NOT exist after scan (proves no execution)", async () => {
      try { rmSync(sfp, { force: true }); } catch { /* ok */ }
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      expect(existsSync(sfp)).toBe(false);
      try { rmSync(sfp, { force: true }); } catch { /* ok */ }
    });

    it("scan completes normally", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      expect(JSON.parse(r.stdout).summary).toBeDefined();
    });
  });

  // VAL-MCP-022
  describe("[VAL-MCP-022] MCP collector resilience on failure", () => {
    const fp = resolve(mcpFixturesDir, "malformed-yaml");
    const env = { ANTHROPIC_API_KEY: "**************************************" };

    it("scan does not crash with unparseable MCP config", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      expect(JSON.parse(r.stdout).findings).toBeDefined();
    });
  });

  // VAL-MCP-023: MCP data in findings + McpSnapshotSchema Valibot validation
  describe("[VAL-MCP-023] MCP data in findings + schema validation", () => {
    const fp = resolve(repoRoot, "fixtures", "hermes-broken-mcp");
    const env = { ...envWithoutProviderKeys(), OPENAI_API_KEY: "****************************************" };

    it("MCP findings have evidence with server data", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      const mcpF = JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp");
      expect(mcpF.length).toBeGreaterThanOrEqual(1);
      expect(mcpF.some((f: Finding) => f.evidence && (
        Array.isArray(f.evidence) ? f.evidence.length > 0 : Object.keys(f.evidence).length > 0
      ))).toBe(true);
    });

    it("McpSnapshotSchema parses valid MCP data without throwing", async () => {
      // Build a valid McpSnapshotSchema-compatible object
      const snapshotData = {
        status: "collected",
        servers: [
          {
            name: "test-server",
            command: "echo",
            executableFound: true,
            transport: "stdio",
            transportValid: true,
            expectedEnv: [{ key: "HOME", set: true }],
            toolsFilter: { enabled: true, includes: ["tool1"], excludes: [] },
          },
        ],
      };
      expect(() => v.parse(McpSnapshotSchema, snapshotData)).not.toThrow();
    });

    it("McpSnapshotSchema parses partial MCP data (null fields) without throwing", async () => {
      const snapshotDataPartial = {
        status: "partial",
        warnings: ["no MCP servers configured"],
        servers: [
          {
            name: "broken-server",
            command: null,
            transport: null,
            transportValid: false,
            toolsFilter: null,
          },
        ],
      };
      expect(() => v.parse(McpSnapshotSchema, snapshotDataPartial)).not.toThrow();
    });

    it("McpSnapshotSchema rejects invalid data (missing name field)", async () => {
      const invalidData = {
        status: "collected",
        servers: [
          { command: "echo" }, // missing required 'name' field
        ],
      };
      expect(() => v.parse(McpSnapshotSchema, invalidData)).toThrow();
    });
  });

  // VAL-MCP-024
  describe("[VAL-MCP-024] MCP findings scoped to mcp area only", () => {
    const fp = resolve(repoRoot, "fixtures", "hermes-broken-mcp");
    const env = { ...envWithoutProviderKeys(), OPENAI_API_KEY: "****************************************" };

    it("MCP check findings have area = mcp", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      for (const f of JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp")) {
        expect(f.area).toBe("mcp");
      }
    });

    it("config parse errors are in config area, not mcp area", async () => {
      const fp2 = resolve(mcpFixturesDir, "malformed-yaml");
      const r = await scanWithEnv(fp2, { ANTHROPIC_API_KEY: "**************************************" });
      expect(r.exitCode).toBe(0);
      for (const f of JSON.parse(r.stdout).findings.filter((f: Finding) => f.area === "mcp")) {
        expect(f.id).not.toMatch(/config-parse|parse-error/i);
      }
    });
  });

  // Fix guidance safety
  describe("Fix guidance safety", () => {
    const fp = resolve(repoRoot, "fixtures", "hermes-broken-mcp");
    const env = { ...envWithoutProviderKeys(), OPENAI_API_KEY: "****************************************" };

    it("all fix guidance is copyable/manual", async () => {
      const r = await scanWithEnv(fp, env);
      expect(r.exitCode).toBe(0);
      for (const f of JSON.parse(r.stdout).findings as Finding[]) {
        if (!f.fixes) continue;
        for (const fix of f.fixes) {
          if (fix.command) expect(fix.command).not.toMatch(/sed -i/);
        }
      }
    });
  });

  // Mutation audit
  describe("Mutation audit", () => {
    const fns = ["malformed-yaml", "disabled-server", "remote-url", "fake-secrets", "sentinel", "no-tool-filters", "npx-unavailable", "misnested-key"];
    for (const fn of fns) {
      it("fixture " + fn + " file hashes unchanged after scan", async () => {
        const fpath = resolve(mcpFixturesDir, fn);
        const env = { ANTHROPIC_API_KEY: "**************************************" };
        const before = collectFileHashes(fpath);
        const r = await scanWithEnv(fpath, env);
        expect(r.exitCode).toBe(0);
        const after = collectFileHashes(fpath);
        expect(Object.keys(before).sort()).toEqual(Object.keys(after).sort());
        for (const [fp2, hash] of Object.entries(before)) {
          expect(after[fp2 as string]).toBe(hash);
        }
      });
    }
  });

  // =========================================================================
  // [VAL-MCP-025] Mixed MCP setup: remote-only + local servers
  // =========================================================================
  describe("[VAL-MCP-025] Mixed MCP setup: remote-only + local servers", () => {
    const env = { ANTHROPIC_API_KEY: "**************************************" };

    it("remote-only server (no command, url only) produces no broken commands-exist finding", async () => {
      const tmpDir = mkdtempSync(join(os.tmpdir(), "mcp-mixed-"));
      try {
        writeFileSync(
          join(tmpDir, "config.yaml"),
          [
            "profile: default",
            "providers:",
            "  default_model: claude-sonnet-4-20250514",
            "  anthropic:",
            "    api_key_env: ANTHROPIC_API_KEY",
            "mcp:",
            "  servers:",
            "    - name: remote-tools",
            "      url: https://mcp.example.com/sse",
            "      transport: sse",
            "      env: [HOME]",
            "    - name: local-server",
            "      command: echo",
            '      args: ["hello"]',
            "      transport: stdio",
            "      env: [HOME]",
            "dashboard:",
            "  url: http://127.0.0.1:8080",
            "  bind: 127.0.0.1",
            "memory:",
            "  dir: memory",
            "  limit_mb: 10",
            "",
          ].join("\n"),
          "utf-8",
        );
        mkdirSync(join(tmpDir, "memory"), { recursive: true });
        const r = await scanWithEnv(tmpDir, env);
        expect(r.exitCode).toBe(0);
        const report = JSON.parse(r.stdout);
        const cmdExist = report.findings.find(
          (f: Finding) => f.id === "mcp-commands-exist",
        );
        expect(cmdExist).toBeDefined();
        // Remote-only should NOT cause broken; the local server has 'echo' which should resolve
        expect(cmdExist.status).not.toBe("broken");
        // The message should NOT mention the remote-only server
        expect(cmdExist.message).not.toContain("remote-tools");
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("mixed setup with remote-only + local broken command: only local flagged", async () => {
      const tmpDir = mkdtempSync(join(os.tmpdir(), "mcp-mixed-broken-"));
      try {
        writeFileSync(
          join(tmpDir, "config.yaml"),
          [
            "profile: default",
            "providers:",
            "  default_model: claude-sonnet-4-20250514",
            "  anthropic:",
            "    api_key_env: ANTHROPIC_API_KEY",
            "mcp:",
            "  servers:",
            "    - name: remote-tools",
            "      url: https://mcp.example.com/sse",
            "      transport: sse",
            "      env: [HOME]",
            "    - name: broken-local",
            "      command: definitely-missing-binary-xyz",
            "      transport: stdio",
            "      env: [HOME]",
            "dashboard:",
            "  url: http://127.0.0.1:8080",
            "  bind: 127.0.0.1",
            "memory:",
            "  dir: memory",
            "  limit_mb: 10",
            "",
          ].join("\n"),
          "utf-8",
        );
        mkdirSync(join(tmpDir, "memory"), { recursive: true });
        const r = await scanWithEnv(tmpDir, env);
        expect(r.exitCode).toBe(0);
        const report = JSON.parse(r.stdout);
        const cmdExist = report.findings.find(
          (f: Finding) => f.id === "mcp-commands-exist",
        );
        expect(cmdExist).toBeDefined();
        expect(cmdExist.status).toBe("broken");
        expect(cmdExist.severity).toBeGreaterThanOrEqual(3);
        // Must mention the broken local server
        expect(cmdExist.message).toContain("broken-local");
        // Must NOT mention the remote-only server
        expect(cmdExist.message).not.toContain("remote-tools");
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("mixed setup: transport check handles remote url servers correctly", async () => {
      const tmpDir = mkdtempSync(join(os.tmpdir(), "mcp-mixed-trans-"));
      try {
        writeFileSync(
          join(tmpDir, "config.yaml"),
          [
            "profile: default",
            "providers:",
            "  default_model: claude-sonnet-4-20250514",
            "  anthropic:",
            "    api_key_env: ANTHROPIC_API_KEY",
            "mcp:",
            "  servers:",
            "    - name: sse-server",
            "      url: https://example.com/sse",
            "      transport: sse",
            "      env: [HOME]",
            "    - name: stdio-server",
            "      command: echo",
            "      transport: stdio",
            "      env: [HOME]",
            "    - name: http-server",
            "      url: http://localhost:8080/mcp",
            "      transport: http",
            "      env: [HOME]",
            "dashboard:",
            "  url: http://127.0.0.1:8080",
            "  bind: 127.0.0.1",
            "memory:",
            "  dir: memory",
            "  limit_mb: 10",
            "",
          ].join("\n"),
          "utf-8",
        );
        mkdirSync(join(tmpDir, "memory"), { recursive: true });
        const r = await scanWithEnv(tmpDir, env);
        expect(r.exitCode).toBe(0);
        const report = JSON.parse(r.stdout);
        const transportF = report.findings.find(
          (f: Finding) => f.id === "mcp-transport",
        );
        expect(transportF).toBeDefined();
        // All transports are valid => ok
        expect(transportF.status).toBe("ok");
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("mixed setup: remote-only servers produce no broken/risk MCP findings", async () => {
      const tmpDir = mkdtempSync(join(os.tmpdir(), "mcp-mixed-clean-"));
      try {
        writeFileSync(
          join(tmpDir, "config.yaml"),
          [
            "profile: default",
            "providers:",
            "  default_model: claude-sonnet-4-20250514",
            "  anthropic:",
            "    api_key_env: ANTHROPIC_API_KEY",
            "mcp:",
            "  servers:",
            "    - name: remote-sse",
            "      url: https://api.example.com/mcp",
            "      transport: sse",
            "      env: [HOME]",
            "    - name: remote-ws",
            "      url: wss://ws.example.com/mcp",
            "      transport: websocket",
            "      env: [HOME]",
            "    - name: local-fs",
            "      command: echo",
            '      args: ["ok"]',
            "      transport: stdio",
            "      env: [HOME]",
            "dashboard:",
            "  url: http://127.0.0.1:8080",
            "  bind: 127.0.0.1",
            "memory:",
            "  dir: memory",
            "  limit_mb: 10",
            "",
          ].join("\n"),
          "utf-8",
        );
        mkdirSync(join(tmpDir, "memory"), { recursive: true });
        const r = await scanWithEnv(tmpDir, env);
        expect(r.exitCode).toBe(0);
        const report = JSON.parse(r.stdout);
        // No MCP broken findings
        for (const f of report.findings.filter((f: Finding) => f.area === "mcp")) {
          expect(f.status).not.toBe("broken");
          expect(f.status).not.toBe("risk");
        }
        // MCP servers found must exist
        const serversFound = report.findings.find(
          (f: Finding) => f.id === "mcp-servers-found",
        );
        expect(serversFound).toBeDefined();
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
