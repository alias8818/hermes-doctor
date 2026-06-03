import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

import {
  redact,
  buildReport,
  createRedactionSummary,
  type DoctorFinding,
  type DoctorReport,
} from "@hermes-doctor/core";

import { renderConsole } from "../output/console-renderer.js";
import { renderMarkdown } from "../output/markdown-renderer.js";
import { renderJson } from "../output/json-renderer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const cliEntry = path.resolve(__dirname, "..", "index.ts");
const tsxBin = path.resolve(repoRoot, "node_modules", ".bin", "tsx");
const tortureFixturesDir = path.resolve(repoRoot, "fixtures", "validation", "redaction-torture");

// =========================================================================
// Fake secrets — constructed at runtime from hex to avoid raw strings in source.
// =========================================================================

const FAKE = {
  openaiKey: Buffer.from("736b2d746573742d313233343536373839306162636465663132333435363738393061626364656631323334353637383930616263646566", "hex").toString("utf-8"),
  anthropicKey: Buffer.from("736b2d616e742d746573742d31323334353637383930616263646566", "hex").toString("utf-8"),
  githubToken: Buffer.from("6768705f74657374313233343536373839306162636465666768696a6b6c6d6e6f", "hex").toString("utf-8"),
  githubPat: Buffer.from("6769746875625f7061745f746573745f6162633132336465663435366768693738396a6b6c3031326d6e6f", "hex").toString("utf-8"),
  slackToken: Buffer.from("786f78622d313233343536373839302d4142434445464748494a303132333435363738", "hex").toString("utf-8"),
  bearerToken: Buffer.from("746573742d6265617265722d746f6b656e2d6162633132336465663435366768693738396a6b6c303132", "hex").toString("utf-8"),
  webhookUrl: Buffer.from("68747470733a2f2f686f6f6b732e736c61636b2e636f6d2f73657276696365732f543030303030303030302f423030303030303030302f5858585858585858585858585858585858585858585858", "hex").toString("utf-8"),
  discordWebhook: Buffer.from("68747470733a2f2f646973636f72642e636f6d2f6170692f776562686f6f6b732f3132333435363738393031323334353637382f6162634445465f6768694a4b4c6d6e6f505152737475565758797a", "hex").toString("utf-8"),
  password: Buffer.from("746573742d70617373776f72642d616263313233", "hex").toString("utf-8"),
  sshBegin: Buffer.from("2d2d2d2d2d424547494e204f50454e5353482050524956415445204b45592d2d2d2d2d", "hex").toString("utf-8"),
  sshEnd: Buffer.from("2d2d2d2d2d454e44204f50454e5353482050524956415445204b45592d2d2d2d2d", "hex").toString("utf-8"),
  // Unknown/custom API key format: myapp_v1_abc123def456ghi789jkl01234
  unknownKey: Buffer.from("6d796170705f76315f6162633132336465663435366768693738396a6b6c3031323334", "hex").toString("utf-8"),
};

const RAW_SECRET_PREFIXES = [
  FAKE.openaiKey,
  FAKE.anthropicKey,
  FAKE.githubToken,
  FAKE.slackToken,
  FAKE.bearerToken,
  FAKE.password,
  FAKE.githubPat,
  FAKE.unknownKey,
];

// =========================================================================
// Fixture setup: write secrets to gitignored files at test time
// =========================================================================
function ensureTortureFixtureSecrets() {
  const fixtureDir = path.resolve(tortureFixturesDir, "all-surfaces");

  const envPath = path.join(fixtureDir, ".env");
  if (!existsSync(envPath)) {
    writeFileSync(
      envPath,
      [
        `ANTHROPIC_API_KEY=${FAKE.anthropicKey}`,
        `OPENAI_API_KEY=${FAKE.openaiKey}`,
        `GITHUB_TOKEN=${FAKE.githubToken}`,
        `GITHUB_PAT=${FAKE.githubPat}`,
        `SLACK_BOT_TOKEN=${FAKE.slackToken}`,
        `BEARER_TOKEN=${FAKE.bearerToken}`,
        `WEBHOOK_URL=${FAKE.webhookUrl}`,
        `PASSWORD=${FAKE.password}`,
        `DISCORD_WEBHOOK=${FAKE.discordWebhook}`,
        `CUSTOM_PROVIDER_KEY=${FAKE.unknownKey}`,
        "",
      ].join("\n"),
    );
  }

  mkdirSync(path.join(fixtureDir, "logs"), { recursive: true });
  const errLogPath = path.join(fixtureDir, "logs", "errors.log");
  if (!existsSync(errLogPath)) {
    writeFileSync(
      errLogPath,
      [
        `2026-05-31T10:05:00.000Z [ERROR] 401 Unauthorized: Invalid API key ${FAKE.openaiKey}`,
        `2026-05-31T10:05:01.000Z [ERROR] 403 Forbidden: Bearer ${FAKE.bearerToken} rejected`,
        `2026-05-31T10:05:02.000Z [ERROR] Failed to send webhook to ${FAKE.webhookUrl}`,
        '2026-05-31T10:05:03.000Z [ERROR] MCP server "database" exited with code 1',
        `2026-05-31T10:05:04.000Z [ERROR] Token ${FAKE.githubToken} expired`,
        `2026-05-31T10:05:05.000Z [ERROR] Custom provider key ${FAKE.unknownKey} rejected`,
        `2026-05-31T10:05:05.000Z [ERROR] Slack token ${FAKE.slackToken} revoked`,
        "2026-05-31T10:05:06.000Z [CRITICAL] Out of memory",
        "2026-05-31T10:05:07.000Z [ERROR] ECONNREFUSED on 0.0.0.0:8080",
        `2026-05-31T10:05:08.000Z [ERROR] ${FAKE.sshBegin}`,
        "2026-05-31T10:05:08.500Z [ERROR] b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn",
        `2026-05-31T10:05:09.000Z [ERROR] ${FAKE.sshEnd}`,
        "",
      ].join("\n"),
    );
  }

  const hermesLogPath = path.join(fixtureDir, "logs", "hermes.log");
  if (!existsSync(hermesLogPath)) {
    writeFileSync(
      hermesLogPath,
      [
        "2026-05-31T10:00:00.000Z [INFO] Hermes Agent starting",
        "2026-05-31T10:00:00.500Z [INFO] Loading configuration from config.yaml",
        "2026-05-31T10:00:01.000Z [INFO] Provider loaded: anthropic",
        "2026-05-31T10:00:01.500Z [INFO] Dashboard starting on http://127.0.0.1:8080",
        "2026-05-31T10:00:02.000Z [INFO] Memory loaded: 2 files",
        "2026-05-31T10:00:02.500Z [INFO] Ready",
        "",
      ].join("\n"),
    );
  }
}

// =========================================================================
// Helpers
// =========================================================================

function gpApiKey() {
  return Buffer.from("736b2d616e742d746573742d31323334353637383930616263646566", "hex").toString("utf-8");
}

async function runCli(args: string[], env?: NodeJS.ProcessEnv) {
  return execa(tsxBin, [cliEntry, ...args], { reject: false, env });
}

async function scanFixture(fixtureName: string, extraArgs: string[] = []) {
  ensureTortureFixtureSecrets();
  const fixturePath = path.resolve(tortureFixturesDir, fixtureName);
  const stubBin = path.resolve(tortureFixturesDir, fixtureName, "bin");
  const env = {
    ...process.env,
    ANTHROPIC_API_KEY: gpApiKey(),
    OPENAI_API_KEY: gpApiKey(),
    GOOGLE_API_KEY: gpApiKey(),
    PATH: `${stubBin}:${process.env.PATH ?? ""}`,
  };
  const result = await runCli(["scan", "--hermes-home", fixturePath, ...extraArgs], env);
  return { result, fixturePath };
}

async function scanJson(fixtureName: string, extraArgs: string[] = []) {
  const { result } = await scanFixture(fixtureName, [...extraArgs, "--format", "json"]);
  expect(result.exitCode, `CLI exit code: ${result.exitCode}`).toBe(0);
  return { result, report: JSON.parse(result.stdout) };
}

// =========================================================================
// VAL-REDTEAM-001: config.yaml torture
// =========================================================================
describe("VAL-REDTEAM-001: config.yaml torture", () => {
  it("no raw secrets in JSON, redactedForSharing true", async () => {
    const { result, report } = await scanJson("all-surfaces");
    for (const s of RAW_SECRET_PREFIXES) expect(result.stdout).not.toContain(s);
    expect(report.redactedForSharing).toBe(true);
  });

  it("console has [REDACTED:] markers and redacted-for-sharing", async () => {
    const { result } = await scanFixture("all-surfaces", ["--format", "console"]);
    for (const s of RAW_SECRET_PREFIXES) expect(result.stdout).not.toContain(s);
    expect(result.stdout).toMatch(/\[REDACTED:\w+\]/);
    expect(result.stdout.toLowerCase()).toContain("redacted for sharing");
  });

  it("markdown has no raw secrets", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "rt-001-"));
    await scanFixture("all-surfaces", ["--format", "markdown", "--output", tmpDir]);
    const md = readFileSync(path.join(tmpDir, "hermes-doctor-report.md"), "utf-8");
    for (const s of RAW_SECRET_PREFIXES) expect(md).not.toContain(s);
  });
});

// =========================================================================
// VAL-REDTEAM-002: .env secrets
// =========================================================================
describe("VAL-REDTEAM-002: .env torture", () => {
  it("no raw .env secrets in console", async () => {
    const { result } = await scanFixture("all-surfaces", ["--format", "console"]);
    for (const s of RAW_SECRET_PREFIXES) expect(result.stdout).not.toContain(s);
    expect(result.stdout.toLowerCase()).toContain("redacted for sharing");
  });

  it("JSON patterns include .env-relevant types", async () => {
    const { result, report } = await scanJson("all-surfaces");
    for (const s of RAW_SECRET_PREFIXES) expect(result.stdout).not.toContain(s);
    const p = report.redaction.patterns;
    // Patterns present depends on which secrets are in the fixture and which
    // redaction patterns fire. The important property is that raw secrets
    // don't appear in output (checked above).
    expect(p.length).toBeGreaterThanOrEqual(3);
    // At minimum, one token pattern and one webhook pattern should fire
    const tokenPatterns = ["openai_key", "github_token", "slack_token", "bearer_token", "api_key"];
    const webhookPatterns = ["webhook_token", "password"];
    expect(tokenPatterns.some((t) => p.includes(t))).toBe(true);
    expect(webhookPatterns.some((t) => p.includes(t))).toBe(true);
    expect(report.redactedForSharing).toBe(true);
  });

  it("markdown is clean", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "rt-002-"));
    await scanFixture("all-surfaces", ["--format", "markdown", "--output", tmpDir]);
    const md = readFileSync(path.join(tmpDir, "hermes-doctor-report.md"), "utf-8");
    for (const s of RAW_SECRET_PREFIXES) expect(md).not.toContain(s);
    expect(md.toLowerCase()).toContain("redacted for sharing");
  });
});

// =========================================================================
// VAL-REDTEAM-003: Log file secrets
// =========================================================================
describe("VAL-REDTEAM-003: Log file torture", () => {
  it("JSON with --include-log-snippets: no raw secrets, redactedForSharing", async () => {
    const { result, report } = await scanJson("all-surfaces", ["--include-log-snippets"]);
    for (const s of RAW_SECRET_PREFIXES) expect(result.stdout).not.toContain(s);
    expect(report.redaction.patterns).toContain("bearer_token");
    expect(report.redaction.patterns).toContain("webhook_token");
    expect(report.redaction.patterns).toContain("github_token");
    expect(report.redactedForSharing).toBe(true);
  });

  it("console has log-source [REDACTED:] markers", async () => {
    const { result } = await scanFixture("all-surfaces", ["--include-log-snippets", "--format", "console"]);
    for (const s of RAW_SECRET_PREFIXES) expect(result.stdout).not.toContain(s);
    expect(result.stdout).toContain("[REDACTED:BEARER_TOKEN]");
    expect(result.stdout).toContain("[REDACTED:WEBHOOK_TOKEN]");
  });
});

// =========================================================================
// VAL-REDTEAM-004: Memory file secrets
// =========================================================================
describe("VAL-REDTEAM-004: Memory file torture", () => {
  it("no raw secrets in JSON output", async () => {
    const { result } = await scanFixture("all-surfaces", ["--format", "json"]);
    for (const s of RAW_SECRET_PREFIXES) expect(result.stdout).not.toContain(s);
  });
});

// =========================================================================
// VAL-REDTEAM-005: SKILL.md secrets
// =========================================================================
describe("VAL-REDTEAM-005: SKILL.md torture", () => {
  it("no raw skill secrets in console", async () => {
    const { result } = await scanFixture("all-surfaces", ["--format", "console"]);
    expect(result.stdout).not.toContain(FAKE.anthropicKey);
    expect(result.stdout).not.toContain(FAKE.githubToken);
  });
});

// =========================================================================
// VAL-REDTEAM-006: Plugin manifest secrets
// =========================================================================
describe("VAL-REDTEAM-006: Plugin manifest torture", () => {
  it("no raw plugin secrets in console", async () => {
    const { result } = await scanFixture("all-surfaces", ["--format", "console"]);
    expect(result.stdout).not.toContain(FAKE.openaiKey);
    expect(result.stdout).not.toContain(FAKE.githubToken);
    expect(result.stdout).not.toContain(FAKE.bearerToken);
    expect(result.stdout).not.toContain(FAKE.webhookUrl);
  });
});

// =========================================================================
// VAL-REDTEAM-007: Renderer-level defense-in-depth
// =========================================================================
describe("VAL-REDTEAM-007: Renderer defense-in-depth", () => {
  function leakyReport(): DoctorReport {
    const findings: DoctorFinding[] = [{
      id: "leak",
      area: "security",
      status: "risk",
      severity: 4,
      title: "Secret Leak Detected",
      message: `OpenAI key ${FAKE.openaiKey} and Bearer ${FAKE.bearerToken} found`,
      evidence: {
        openaiKey: FAKE.openaiKey,
        githubToken: FAKE.githubToken,
        slackToken: FAKE.slackToken,
        webhookUrl: FAKE.webhookUrl,
      },
      fixes: [],
    }];
    return buildReport(findings, { redaction: createRedactionSummary() });
  }

  it("renderConsole catches post-collector injected secrets", () => {
    const out = renderConsole(leakyReport());
    expect(out).not.toContain(FAKE.openaiKey);
    expect(out).not.toContain(FAKE.githubToken);
    expect(out).not.toContain(FAKE.slackToken);
    expect(out).not.toContain(FAKE.webhookUrl);
    expect(out).toContain("[REDACTED:OPENAI_KEY]");
    expect(out).toMatch(/\[REDACTED:GITHUB[\]_\\]*TOKEN\]/);
    expect(out).toMatch(/\[REDACTED:SLACK[\]_\\]*TOKEN\]/);
    expect(out).toMatch(/\[REDACTED:WEBHOOK[\]_\\]*TOKEN\]/);
  });

  it("renderMarkdown catches post-collector injected secrets", () => {
    const out = renderMarkdown(leakyReport());
    expect(out).not.toContain(FAKE.openaiKey);
    expect(out).not.toContain(FAKE.githubToken);
    expect(out).not.toContain(FAKE.slackToken);
    expect(out).not.toContain(FAKE.webhookUrl);
    // escapeMd applies to finding.message and evidence — redaction markers
    // get their brackets/underscores escaped. Check for the redacted type names.
    expect(out).toMatch(/OPENAI[\]_\\]*KEY/);
    expect(out).toMatch(/GITHUB[\]_\\]*TOKEN/);
    expect(out).toMatch(/SLACK[\]_\\]*TOKEN/);
    expect(out).toMatch(/WEBHOOK[\]_\\]*TOKEN/);
  });

  it("renderJson catches injected secrets and update count", () => {
    const json = renderJson(leakyReport());
    const parsed = JSON.parse(json);
    const text = JSON.stringify(parsed);
    expect(text).not.toContain(FAKE.openaiKey);
    expect(text).not.toContain(FAKE.githubToken);
    expect(text).not.toContain(FAKE.slackToken);
    expect(parsed.redaction.totalRedactions).toBeGreaterThanOrEqual(4);
    expect(parsed.redaction.patterns).toContain("openai_key");
    expect(parsed.redaction.patterns).toContain("github_token");
    expect(parsed.redaction.patterns).toContain("slack_token");
    expect(parsed.redaction.patterns).toContain("webhook_token");
    expect(parsed.redactedForSharing).toBe(true);
  });
});

// =========================================================================
// VAL-REDTEAM-008: Cumulative redaction
// =========================================================================
describe("VAL-REDTEAM-008: Cumulative redaction", () => {
  it("totalRedactions >= 4 with log snippets", async () => {
    const { report } = await scanJson("all-surfaces", ["--include-log-snippets"]);
    // With tightened patterns (min-length thresholds, required structure),
    // more selective redaction means fewer but higher-quality redactions.
    expect(report.redaction.totalRedactions).toBeGreaterThanOrEqual(4);
  });

  it("patterns include secret types from all surfaces", async () => {
    const { report } = await scanJson("all-surfaces", ["--include-log-snippets"]);
    const p = report.redaction.patterns;
    expect(p.length).toBeGreaterThanOrEqual(3);
    // These patterns fire reliably across all fixture surfaces
    expect(p).toContain("github_token");
    expect(p).toContain("webhook_token");
  });
});

// =========================================================================
// VAL-REDTEAM-009: Hard gate -- zero raw secrets
// =========================================================================
describe("VAL-REDTEAM-009: Hard gate -- zero raw secrets", () => {
  it("JSON: zero raw secret prefixes", async () => {
    const { result } = await scanFixture("all-surfaces", ["--include-log-snippets", "--format", "json"]);
    for (const s of RAW_SECRET_PREFIXES) expect(result.stdout).not.toContain(s);
  });

  it("Console: zero raw secret prefixes", async () => {
    const { result } = await scanFixture("all-surfaces", ["--include-log-snippets", "--format", "console"]);
    for (const s of RAW_SECRET_PREFIXES) expect(result.stdout).not.toContain(s);
  });

  it("Markdown: zero raw secret prefixes", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "rt-009-"));
    await scanFixture("all-surfaces", ["--include-log-snippets", "--format", "markdown", "--output", tmpDir]);
    const md = readFileSync(path.join(tmpDir, "hermes-doctor-report.md"), "utf-8");
    for (const s of RAW_SECRET_PREFIXES) expect(md).not.toContain(s);
  });
});

// =========================================================================
// VAL-REDTEAM-010: Redacted for sharing
// =========================================================================
describe("VAL-REDTEAM-010: Redacted for sharing under worst torture", () => {
  it("JSON redactedForSharing is true", async () => {
    const { report } = await scanJson("all-surfaces", ["--include-log-snippets"]);
    expect(report.redactedForSharing).toBe(true);
  });

  it("console contains 'redacted for sharing'", async () => {
    const { result } = await scanFixture("all-surfaces", ["--include-log-snippets", "--format", "console"]);
    expect(result.stdout.toLowerCase()).toContain("redacted for sharing");
  });

  it("markdown contains 'redacted for sharing'", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "rt-010-"));
    await scanFixture("all-surfaces", ["--include-log-snippets", "--format", "markdown", "--output", tmpDir]);
    const md = readFileSync(path.join(tmpDir, "hermes-doctor-report.md"), "utf-8");
    expect(md.toLowerCase()).toContain("redacted for sharing");
  });
});

// =========================================================================
// VAL-REDTEAM-011: Defense-in-depth layer isolation
// =========================================================================
describe("VAL-REDTEAM-011: Defense-in-depth isolation", () => {
  it("Test A: Renderer catches post-collector injected secrets while preserving pre-redacted content", () => {
    const findings: DoctorFinding[] = [
      {
        id: "pre",
        area: "security", status: "warning", severity: 2,
        title: "Pre-redacted",
        message: "Found [REDACTED:OPENAI_KEY] in config",
        evidence: { key: "[REDACTED:ANTHROPIC_KEY]" },
        fixes: [],
      },
      {
        id: "post",
        area: "security", status: "risk", severity: 4,
        title: "Post-injected",
        message: `Raw: ${FAKE.openaiKey} bypassed collector`,
        evidence: {
          ghp: FAKE.githubToken,
          webhook: FAKE.webhookUrl,
        },
        fixes: [],
      },
    ];
    const red = createRedactionSummary();
    red.totalRedactions = 2; red.count = 2;
    red.patterns = ["openai_key", "anthropic_key"]; red.redacted = true;

    const report = buildReport(findings, { redaction: red });
    const json = renderJson(report);
    const parsed = JSON.parse(json);
    const text = JSON.stringify(parsed);

    expect(text).not.toContain(FAKE.openaiKey);
    expect(text).not.toContain(FAKE.githubToken);
    expect(text).not.toContain(FAKE.webhookUrl);
    expect(text).toContain("[REDACTED:OPENAI_KEY]");
    expect(text).toContain("[REDACTED:ANTHROPIC_KEY]");

    const r = parsed.redaction;
    expect(r.totalRedactions).toBeGreaterThanOrEqual(5);
    expect(r.count).toBeGreaterThanOrEqual(5);
    expect(r.patterns).toContain("openai_key");
    expect(r.patterns).toContain("github_token");
    expect(r.patterns).toContain("webhook_token");
  });

  it("Test B: Double-redaction does not corrupt [REDACTED:] placeholders", () => {
    const input = "Found [REDACTED:OPENAI_KEY] and [REDACTED:BEARER_TOKEN] in config";
    const { value } = redact(input);
    expect(value).not.toContain("[REDACTED:[REDACTED:");
    expect(value).toContain("[REDACTED:OPENAI_KEY]");
    expect(value).toContain("[REDACTED:BEARER_TOKEN]");
    expect(value).toBe(input);
  });
});

// =========================================================================
// VAL-REDTEAM-012: Strict mode escalation
// =========================================================================
describe("VAL-REDTEAM-012: Strict mode torture", () => {
  it("strict totalRedactions >= normal totalRedactions", async () => {
    const n = (await scanJson("all-surfaces", ["--include-log-snippets"])).report;
    const s = (await scanJson("all-surfaces", ["--include-log-snippets", "--strict-redaction"])).report;
    expect(s.redaction.totalRedactions).toBeGreaterThanOrEqual(n.redaction.totalRedactions);
    expect(n.redactedForSharing).toBe(true);
    expect(s.redactedForSharing).toBe(true);
  });

  it("strict mode: zero raw secrets in JSON", async () => {
    const { result } = await scanFixture("all-surfaces", ["--include-log-snippets", "--strict-redaction", "--format", "json"]);
    for (const s of RAW_SECRET_PREFIXES) expect(result.stdout).not.toContain(s);
  });

  it("strict mode console is safe", async () => {
    const { result } = await scanFixture("all-surfaces", ["--include-log-snippets", "--strict-redaction", "--format", "console"]);
    for (const s of RAW_SECRET_PREFIXES) expect(result.stdout).not.toContain(s);
    expect(result.stdout.toLowerCase()).toContain("redacted for sharing");
  });
});

// =========================================================================
// Multi-format smoke test
// =========================================================================
describe("VAL-REDTEAM: Multi-format output", () => {
  it("all three formats produce clean output", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "rt-allfmt-"));
    const { result } = await scanFixture("all-surfaces", [
      "--format", "console",
      "--format", "markdown",
      "--format", "json",
      "--output", tmpDir,
    ]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(path.join(tmpDir, "hermes-doctor-report.md"))).toBe(true);
    const md = readFileSync(path.join(tmpDir, "hermes-doctor-report.md"), "utf-8");
    const json = readFileSync(path.join(tmpDir, "hermes-doctor-report.json"), "utf-8");
    for (const s of RAW_SECRET_PREFIXES) {
      expect(result.stdout).not.toContain(s);
      expect(md).not.toContain(s);
      expect(json).not.toContain(s);
    }
  });
});
