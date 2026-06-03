import { describe, expect, it } from "vitest";
import * as os from "node:os";
import * as v from "valibot";

import { RedactionSummarySchema } from "../../schemas/index.js";
import {
  REDACTION_PATTERNS,
  createRedactionSummary,
  mergeRedactionSummaries,
  redact,
  redactDeep,
} from "../index.js";

describe("redact() — API keys", () => {
  it("redacts OpenAI keys", () => {
    const { value, summary } = redact("key=sk-1234567890abcdef1234567890abcdef1234567890abcdef");
    expect(value).not.toContain("sk-1234567890abcdef1234567890abcdef1234567890abcdef");
    expect(value).toContain("[REDACTED:OPENAI_KEY]");
    expect(summary.patterns).toContain("openai_key");
    expect(summary.totalRedactions).toBeGreaterThan(0);
  });

  it("redacts modern sk-proj OpenAI keys", () => {
    const { value } = redact("OPENAI_API_KEY=sk-proj-abcDEF1234567890ghiJKLmnopqrstuvwxyzABCDEFGHIJK");
    expect(value).toContain("[REDACTED:OPENAI_KEY]");
    expect(value).not.toContain("sk-proj-abcDEF1234567890ghiJKLmnopqrstuvwxyzABCDEFGHIJK");
  });

  it("redacts Anthropic keys without mislabeling them as OpenAI", () => {
    const { value, summary } = redact("ANTHROPIC_API_KEY=sk-ant-api03-abcdef1234567890");
    expect(value).toContain("[REDACTED:ANTHROPIC_KEY]");
    expect(value).not.toContain("[REDACTED:OPENAI_KEY]");
    expect(value).not.toContain("sk-ant-api03-abcdef1234567890");
    expect(summary.patterns).toContain("anthropic_key");
    expect(summary.patterns).not.toContain("openai_key");
  });

  it("redacts GitHub personal access tokens", () => {
    const { value, summary } = redact("GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789");
    expect(value).toContain("[REDACTED:GITHUB_TOKEN]");
    expect(value).not.toMatch(/ghp_[A-Za-z0-9]/);
    expect(summary.patterns).toContain("github_token");
  });

  it("redacts fine-grained github_pat tokens", () => {
    const { value } = redact("github_pat_11ABCDEFG0aBcDeFgHiJkLmNoPqRsTuVwXyZ");
    expect(value).toContain("[REDACTED:GITHUB_TOKEN]");
  });

  it("redacts Slack tokens", () => {
    const slackToken = Buffer.from("786f78622d313233343536373839302d4142434445464748494a3031323334353637", "hex").toString("utf-8");
    const { value, summary } = redact("SLACK_TOKEN=" + slackToken);
    expect(value).toContain("[REDACTED:SLACK_TOKEN]");
    expect(value).not.toContain(slackToken);
    expect(summary.patterns).toContain("slack_token");
  });

  it("redacts Telegram bot tokens", () => {
    const { value, summary } = redact(
      "TELEGRAM_BOT_TOKEN=123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw",
    );
    expect(value).toContain("[REDACTED:TELEGRAM_TOKEN]");
    expect(value).not.toContain("AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw");
    expect(summary.patterns).toContain("telegram_token");
  });

  it("redacts unknown/custom API keys with multi-segment prefix", () => {
    const { value, summary } = redact("CUSTOM_API_KEY=myapp_v1_abc123def456ghi789jkl012");
    expect(value).toContain("[REDACTED:API_KEY]");
    expect(value).not.toContain("myapp_v1_abc123def456ghi789jkl012");
    expect(summary.patterns).toContain("api_key");
  });

  it("redacts unknown API keys with single-segment prefix", () => {
    const { value, summary } = redact("CUSTOM_API_KEY=myapp_abc123def456ghi789jkl012mnop");
    expect(value).toContain("[REDACTED:API_KEY]");
    expect(value).not.toContain("myapp_abc123def456ghi789jkl012mnop");
    expect(summary.patterns).toContain("api_key");
  });

  it("redacts unknown API keys inside config values", () => {
    const { value, summary } = redact(
      "provider:\n  api_key: custom_provider_v2_abcdefghijklmnopqrstuvwxyz012345",
    );
    expect(value).toContain("[REDACTED:API_KEY]");
    expect(value).not.toContain("custom_provider_v2_abcdefghijklmnopqrstuvwxyz012345");
    expect(summary.patterns).toContain("api_key");
  });

  it("does NOT redact short underscore-separated words as API keys", () => {
    const { value } = redact("this_is_a_normal_config_value");
    expect(value).not.toContain("[REDACTED:API_KEY]");
  });
});

describe("redact() — tokens, headers, passwords", () => {
  it("redacts bearer tokens but keeps the Bearer prefix", () => {
    const { value, summary } = redact("Authorization: Bearer abcDEF1234567890ghiJKLmno");
    expect(value).toContain("Bearer [REDACTED:BEARER_TOKEN]");
    expect(value).not.toContain("abcDEF1234567890ghiJKLmno");
    expect(summary.patterns).toContain("bearer_token");
  });

  it("redacts bearer tokens regardless of header case", () => {
    const { value, summary } = redact("authorization: bearer abcDEF1234567890ghiJKLmno");
    expect(value).toContain("bearer [REDACTED:BEARER_TOKEN]");
    expect(value).not.toContain("abcDEF1234567890ghiJKLmno");
    expect(value).not.toContain("[REDACTED:AUTH_HEADER]");
    expect(summary.patterns).toContain("bearer_token");
  });

  it("redacts non-bearer Authorization headers", () => {
    const { value, summary } = redact("Authorization: Basic dXNlcjpwYXNzd29yZA==");
    expect(value).toContain("[REDACTED:AUTH_HEADER]");
    expect(value).not.toContain("dXNlcjpwYXNzd29yZA==");
    expect(summary.patterns).toContain("auth_header");
  });

  it("redacts password key/value pairs", () => {
    const { value, summary } = redact("password: hunter2SuperSecret");
    expect(value).toContain("[REDACTED:PASSWORD]");
    expect(value).not.toContain("hunter2SuperSecret");
    expect(summary.patterns).toContain("password");
  });

  it("redacts prefixed password env keys", () => {
    const { value, summary } = redact("DB_PASSWORD=s3cr3tP4ssword");
    expect(value).toContain("DB_PASSWORD=[REDACTED:PASSWORD]");
    expect(value).not.toContain("s3cr3tP4ssword");
    expect(summary.patterns).toContain("password");
  });

  it("redacts multi-segment prefixed password env keys", () => {
    const { value } = redact("MYSQL_ROOT_PASSWORD=hunter2SuperSecret");
    expect(value).toContain("MYSQL_ROOT_PASSWORD=[REDACTED:PASSWORD]");
    expect(value).not.toContain("hunter2SuperSecret");
  });

  it("redacts prefixed password keys with colon separators and quotes", () => {
    const { value } = redact('REDIS_PASSWORD: "topSecretValue"');
    expect(value).toContain("REDIS_PASSWORD: [REDACTED:PASSWORD]");
    expect(value).not.toContain("topSecretValue");
  });

  it("redacts passwords embedded in URLs", () => {
    const { value } = redact("postgres://admin:s3cr3tP4ss@localhost:5432/db");
    expect(value).toContain("[REDACTED:PASSWORD]");
    expect(value).not.toContain("s3cr3tP4ss");
    expect(value).toContain("admin:");
    expect(value).toContain("@localhost:5432/db");
  });
});

describe("redact() — SSH private keys", () => {
  it("redacts an entire OpenSSH private key block", () => {
    const key = [
      "-----BEGIN OPENSSH PRIVATE KEY-----",
      "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtz",
      "c2gtZWQyNTUxOQAAACBabcdefghijklmnopqrstuvwxyz0123456789ABCDEFitis",
      "-----END OPENSSH PRIVATE KEY-----",
    ].join("\n");
    const { value, summary } = redact(`key file:\n${key}\n`);
    expect(value).toContain("[REDACTED:SSH_PRIVATE_KEY]");
    expect(value).not.toContain("BEGIN OPENSSH PRIVATE KEY");
    expect(value).not.toContain("b3BlbnNzaC1rZXktdjE");
    expect(summary.patterns).toContain("ssh_private_key");
  });

  it("redacts RSA private key blocks", () => {
    const key = [
      "-----BEGIN RSA PRIVATE KEY-----",
      "MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyz",
      "-----END RSA PRIVATE KEY-----",
    ].join("\n");
    const { value } = redact(key);
    expect(value).toBe("[REDACTED:SSH_PRIVATE_KEY]");
  });
});

describe("redact() — webhook URLs", () => {
  it("redacts Slack webhook URLs but keeps the host", () => {
    const webhook = Buffer.from("68747470733a2f2f686f6f6b732e736c61636b2e636f6d2f73657276696365732f5430303030303030302f4230303030303030302f585858585858585858585858585858585858585858585858", "hex").toString("utf-8");
    const { value, summary } = redact(webhook);
    expect(value).toContain("https://hooks.slack.com/");
    expect(value).toContain("[REDACTED:WEBHOOK_TOKEN]");
    expect(value).not.toContain("XXXXXXXXXXXXXXXXXXXXXXXX");
    expect(summary.patterns).toContain("webhook_token");
  });

  it("redacts Discord webhook URLs", () => {
    const { value } = redact(
      "https://discord.com/api/webhooks/123456789012345678/abcDEF_ghiJKLmnoPQRstuVWXyz",
    );
    expect(value).toContain("[REDACTED:WEBHOOK_TOKEN]");
    expect(value).not.toContain("abcDEF_ghiJKLmnoPQRstuVWXyz");
  });

  it("redacts token/key query parameters", () => {
    const { value } = redact("https://example.com/hook?token=supersecretvalue123&id=5");
    expect(value).toContain("[REDACTED:WEBHOOK_TOKEN]");
    expect(value).not.toContain("supersecretvalue123");
    expect(value).toContain("id=5");
  });

  it("does NOT redact plain URLs without secrets", () => {
    const url = "https://api.example.com/health";
    const { value, summary } = redact(url);
    expect(value).toBe(url);
    expect(summary.totalRedactions).toBe(0);
  });
});

describe("redact() — home paths", () => {
  it("redacts the current user's home directory to <HOME>", () => {
    const home = os.homedir();
    const { value, summary } = redact(`${home}/.hermes/config.yaml`);
    expect(value).toBe("<HOME>/.hermes/config.yaml");
    expect(value).not.toContain(home);
    expect(summary.homePathRedactions).toBeGreaterThan(0);
  });

  it("redacts generic /home/<user> paths", () => {
    const { value, summary } = redact("/home/someuser/.hermes/logs/errors.log");
    expect(value).toBe("<HOME>/.hermes/logs/errors.log");
    expect(value).not.toContain("/home/someuser");
    expect(summary.homePathRedactions).toBeGreaterThan(0);
  });

  it("redacts macOS /Users/<user> paths", () => {
    const { value } = redact("/Users/jane/.hermes/config.yaml");
    expect(value).toBe("<HOME>/.hermes/config.yaml");
  });

  it("can be disabled via redactHomePaths: false", () => {
    const { value, summary } = redact("/home/someuser/.hermes", {
      redactHomePaths: false,
    });
    expect(value).toBe("/home/someuser/.hermes");
    expect(summary.homePathRedactions).toBe(0);
  });

  it("honors an explicit homeDir option", () => {
    const { value } = redact("/custom/hermes/root/config.yaml", {
      homeDir: "/custom/hermes/root",
    });
    expect(value).toBe("<HOME>/config.yaml");
  });
});

describe("redact() — summary semantics", () => {
  it("returns a schema-valid RedactionSummary", () => {
    const { summary } = redact("sk-1234567890abcdef1234567890abcdef1234567890abcdef");
    expect(() => v.parse(RedactionSummarySchema, summary)).not.toThrow();
  });

  it("counts multiple secrets and dedupes pattern types", () => {
    const { summary } = redact(
      "a=sk-1234567890abcdef1234567890abcdef1234567890abcdef b=sk-abcdefghij0987654321abcdefghij0987654321abcdefghij t=ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    );
    expect(summary.totalRedactions).toBe(3);
    expect(summary.count).toBe(summary.totalRedactions);
    expect(summary.patterns.filter((p) => p === "openai_key")).toHaveLength(1);
    expect(summary.patterns).toContain("github_token");
  });

  it("marks redacted=true only when something was redacted", () => {
    expect(redact("nothing secret here").summary.redacted).toBe(false);
    expect(redact("sk-1234567890abcdef1234567890abcdef1234567890abcdef").summary.redacted).toBe(true);
  });

  it("keeps secret count separate from home path count", () => {
    const { summary } = redact("/home/someuser/key sk-1234567890abcdef1234567890abcdef1234567890abcdef");
    expect(summary.totalRedactions).toBe(1);
    expect(summary.homePathRedactions).toBe(1);
    expect(summary.patterns).not.toContain("home_path");
  });
});

describe("redactDeep()", () => {
  it("recursively redacts strings in nested structures", () => {
    const input = {
      env: { OPENAI_API_KEY: "sk-1234567890abcdef1234567890abcdef1234567890abcdef" },
      paths: ["/home/someuser/.hermes", "relative/ok"],
      count: 7,
      ok: true,
    };
    const { value, summary } = redactDeep(input);
    const out = value as typeof input;
    expect(out.env.OPENAI_API_KEY).toBe("[REDACTED:OPENAI_KEY]");
    expect(out.paths[0]).toBe("<HOME>/.hermes");
    expect(out.paths[1]).toBe("relative/ok");
    expect(out.count).toBe(7);
    expect(out.ok).toBe(true);
    expect(summary.totalRedactions).toBe(1);
    expect(summary.homePathRedactions).toBe(1);
  });

  it("handles null, undefined, and primitives without throwing", () => {
    expect(redactDeep(null).value).toBeNull();
    expect(redactDeep(undefined).value).toBeUndefined();
    expect(redactDeep(42).value).toBe(42);
  });
});

describe("summary helpers", () => {
  it("createRedactionSummary returns an empty schema-valid summary", () => {
    const summary = createRedactionSummary();
    expect(summary).toEqual({
      redacted: false,
      count: 0,
      totalRedactions: 0,
      patterns: [],
      homePathRedactions: 0,
    });
    expect(() => v.parse(RedactionSummarySchema, summary)).not.toThrow();
  });

  it("mergeRedactionSummaries combines counts and dedupes patterns", () => {
    const a = redact("sk-1234567890abcdef1234567890abcdef1234567890abcdef /home/someuser/x").summary;
    const b = redact("ghp_abcdefghijklmnopqrstuvwxyz0123456789").summary;
    const merged = mergeRedactionSummaries(a, b);
    expect(merged.totalRedactions).toBe(2);
    expect(merged.homePathRedactions).toBe(1);
    expect(merged.patterns.sort()).toEqual(["github_token", "openai_key"]);
    expect(merged.redacted).toBe(true);
  });
});

describe("false-positive prevention — tight patterns do NOT match non-secret config values", () => {
  it("does NOT redact short sk- prefixed config values as OpenAI keys", () => {
    const { value, summary } = redact("config-value=sk-some-config-value");
    expect(value).not.toContain("[REDACTED:OPENAI_KEY]");
    expect(summary.patterns).not.toContain("openai_key");
  });

  it("does NOT redact sk- values shorter than real keys", () => {
    const { value, summary } = redact("sk-abc");
    expect(value).not.toContain("[REDACTED:OPENAI_KEY]");
    expect(summary.patterns).not.toContain("openai_key");
  });

  it("does NOT redact xoxo- prefixed config values as Slack tokens", () => {
    const { value, summary } = redact("xoxo-config-value");
    expect(value).not.toContain("[REDACTED:SLACK_TOKEN]");
    expect(summary.patterns).not.toContain("slack_token");
  });

  it("does NOT redact xoxb- values without numeric token segments", () => {
    const { value, summary } = redact("some-setting=xoxb-config-value");
    expect(value).not.toContain("[REDACTED:SLACK_TOKEN]");
    expect(summary.patterns).not.toContain("slack_token");
  });

  it("redacts multi-segment Slack tokens", () => {
    const token = Buffer.from("786f78622d3132333435363738393031322d3132333435363738393031322d6162636465666768696a6b6c6d6e6f707172737475767778", "hex").toString("utf-8");
    const { value, summary } = redact(token);
    expect(value).not.toContain("abcdefghijklmnopqrstuvwx");
    expect(value).toContain("[REDACTED:SLACK_TOKEN]");
    expect(summary.patterns).toContain("slack_token");
  });

  it("redacts Google/Gemini API keys (AIza prefix)", () => {
    const { value, summary } = redact("AIzaSyDUMMYDUMMYDUMMYDUMMYDUMMYDUMMYD123");
    expect(value).not.toContain("AIza");
    expect(value).toContain("[REDACTED:GOOGLE_KEY]");
    expect(summary.patterns).toContain("google_key");
  });

  it("redacts Groq API keys (gsk_ prefix)", () => {
    const { value, summary } = redact("gsk_FAKEGROQKEY1234567890abcdef");
    expect(value).not.toContain("gsk_FAKEGROQ");
    expect(value).toContain("[REDACTED:GROQ_KEY]");
    expect(summary.patterns).toContain("groq_key");
  });

  it("does NOT redact a Bearer token value that is too short", () => {
    const { value, summary } = redact("Authorization: Bearer short");
    expect(value).not.toContain("[REDACTED:BEARER_TOKEN]");
    expect(summary.patterns).not.toContain("bearer_token");
  });

  it("does NOT redact Bearer with a short alphanumeric value", () => {
    const { value, summary } = redact("Bearer abc123def456");
    expect(value).not.toContain("[REDACTED:BEARER_TOKEN]");
    expect(summary.patterns).not.toContain("bearer_token");
  });

  it("does NOT redact medium-length base64 strings in strict mode", () => {
    // 36 chars of base64 (27 bytes) — below the 44-char threshold
    const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
    const { value, summary } = redact(b64, { strictRedaction: true });
    expect(value).toBe(b64);
    expect(summary.patterns).not.toContain("base64_string");
  });

  it("does NOT redact 43-char base64 strings in strict mode (just below threshold)", () => {
    // 43 chars — below 44-char threshold
    const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq";
    const { value, summary } = redact(b64, { strictRedaction: true });
    expect(value).toBe(b64);
    expect(summary.patterns).not.toContain("base64_string");
  });

  it("DOES redact 44-char base64 strings in strict mode (at threshold)", () => {
    // 44 chars — at threshold, should be redacted
    const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqr";
    const { value, summary } = redact(b64, { strictRedaction: true });
    expect(value).toContain("[REDACTED:BASE64_STRING]");
    expect(summary.patterns).toContain("base64_string");
  });

  it("does NOT redact plain env var values that look like base64 but are short in strict mode", () => {
    const { value, summary } = redact("some.config=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij", { strictRedaction: true });
    expect(value).not.toContain("[REDACTED:BASE64_STRING]");
    expect(summary.patterns).not.toContain("base64_string");
  });
});

describe("REDACTION_PATTERNS", () => {
  it("exposes global regexes for each secret pattern", () => {
    expect(REDACTION_PATTERNS.length).toBeGreaterThan(0);
    for (const pattern of REDACTION_PATTERNS) {
      expect(pattern.regex.flags).toContain("g");
      expect(typeof pattern.type).toBe("string");
    }
  });
});

describe("strict redaction", () => {
  it("redacts secret-suggestive key values when strictRedaction is enabled", () => {
    const { value, summary } = redact("MY_APP_SECRET=supersecretvalue", {
      strictRedaction: true,
    });
    expect(value).toContain("MY_APP_SECRET=[REDACTED:STRICT]");
    expect(value).not.toContain("supersecretvalue");
    expect(summary.patterns).toContain("strict_pattern");
  });

  it("does not apply strict patterns without strictRedaction", () => {
    const { value } = redact("MY_APP_SECRET=supersecretvalue");
    expect(value).toContain("supersecretvalue");
  });

  it("redacts AUTH-suffixed env vars in strict mode", () => {
    const { value, summary } = redact("MYAPP_AUTH=supersecretvalue123", {
      strictRedaction: true,
    });
    expect(value).toContain("MYAPP_AUTH=[REDACTED:STRICT]");
    expect(value).not.toContain("supersecretvalue123");
    expect(summary.patterns).toContain("strict_pattern");
  });

  it("redacts env vars with keyword followed by version suffix in strict mode", () => {
    const { value, summary } = redact("PROVIDER_TOKEN_V1=supersecretvalue", {
      strictRedaction: true,
    });
    expect(value).toContain("PROVIDER_TOKEN_V1=[REDACTED:STRICT]");
    expect(value).not.toContain("supersecretvalue");
    expect(summary.patterns).toContain("strict_pattern");
  });

  it("redacts env vars with AUTH followed by version suffix in strict mode", () => {
    const { value, summary } = redact("PROVIDER_AUTH_V2=supersecretvalue", {
      strictRedaction: true,
    });
    expect(value).toContain("PROVIDER_AUTH_V2=[REDACTED:STRICT]");
    expect(value).not.toContain("supersecretvalue");
    expect(summary.patterns).toContain("strict_pattern");
  });
});
