import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { collectAll } from "../index.js";
import { collectConfig } from "../config.js";
import {
  createCollectorContext,
  DEFAULT_DASHBOARD_TIMEOUT_MS,
} from "../context.js";
import { collectDashboard } from "../dashboard.js";
import { collectInstall } from "../install.js";
import { collectLogs } from "../logs.js";
import { collectMcp } from "../mcp.js";
import { collectMemory } from "../memory.js";
import { collectPlugins } from "../plugins.js";
import { collectProviders } from "../providers.js";
import { collectSecurity } from "../security.js";
import { collectSkills } from "../skills.js";
import { collectSystem } from "../system.js";
import { cleanup, makeHermesHome } from "./support.js";

const VALID_STATUSES = new Set(["collected", "partial", "skipped", "failed"]);
const baseEnv = { PATH: process.env.PATH ?? "" } as NodeJS.ProcessEnv;

const homes: string[] = [];
async function home(files?: Record<string, string>): Promise<string> {
  const dir = await makeHermesHome(files);
  homes.push(dir);
  return dir;
}
function ctxFor(dir: string, env: NodeJS.ProcessEnv = baseEnv) {
  return createCollectorContext({ hermesHome: dir, env });
}

afterEach(async () => {
  while (homes.length > 0) {
    const dir = homes.pop();
    if (dir) await cleanup(dir);
  }
});

describe("system collector", () => {
  it("collects OS, arch and node version", async () => {
    const result = await collectSystem(ctxFor(await home()));
    expect(result.area).toBe("system");
    expect(result.status).toBe("collected");
    expect(result.data.os).toBeTruthy();
    expect(result.data.arch).toBeTruthy();
    expect(result.data.nodeVersion).toBe(process.version);
  });
});

describe("install collector", () => {
  it("reports hermes absent when not on PATH", async () => {
    const result = await collectInstall(ctxFor(await home(), { PATH: "" }));
    expect(result.status).toBe("collected");
    expect(result.data.onPath).toBe(false);
    expect(result.data.executablePath).toBeNull();
  });
});

describe("config collector", () => {
  it("parses a valid config and detects sections", async () => {
    const dir = await home({
      "config.yaml": "providers:\n  default_model: claude\nmcp:\n  servers: []\n",
    });
    const result = await collectConfig(ctxFor(dir));
    expect(result.status).toBe("collected");
    expect(result.data.configValid).toBe(true);
    expect(result.data.sections?.providers).toBe(true);
    expect(result.data.sections?.mcp).toBe(true);
  });

  it("detects mcp_servers top-level section separately from mcp section", async () => {
    const dir = await home({
      "config.yaml":
        "mcp_servers:\n  github:\n    command: npx\n  brave:\n    command: npx\n",
    });
    const result = await collectConfig(ctxFor(dir));
    expect(result.status).toBe("collected");
    expect(result.data.sections?.mcp_servers).toBe(true);
    // mcp section should NOT be detected when only mcp_servers is present
    expect(result.data.sections?.mcp).toBeFalsy();
  });

  it("returns partial when config.yaml is missing", async () => {
    const result = await collectConfig(ctxFor(await home()));
    expect(result.status).toBe("partial");
    expect(result.data.configExists).toBe(false);
  });

  it("returns failed on invalid YAML", async () => {
    const dir = await home({ "config.yaml": "foo: [unclosed\n  : bad" });
    const result = await collectConfig(ctxFor(dir));
    expect(result.status).toBe("failed");
    expect(result.data.parseError).toBeTruthy();
  });

  it("redacts home paths at the boundary", async () => {
    const dir = await home({ "config.yaml": "providers: {}\n" });
    const result = await collectConfig(ctxFor(dir));
    expect(result.data.homePath).toBe("<HOME>");
    expect(JSON.stringify(result)).not.toContain(dir);
  });
});

describe("dashboard collector", () => {
  it("skips when no dashboard configured", async () => {
    const dir = await home({ "config.yaml": "providers: {}\n" });
    const result = await collectDashboard(ctxFor(dir));
    expect(result.status).toBe("skipped");
    expect(result.data.probed).toBe(false);
  });

  it("does not probe remote dashboards", async () => {
    const dir = await home({
      "config.yaml": "dashboard:\n  url: https://dashboard.example.com:8443\n",
    });
    const result = await collectDashboard(ctxFor(dir));
    expect(result.status).toBe("collected");
    expect(result.data.isLocalhost).toBe(false);
    expect(result.data.probed).toBe(false);
    expect(result.data.reachable).toBe(false);
  });

  it("probes localhost dashboards with the configured timeout", async () => {
    const dir = await home({
      "config.yaml": "dashboard:\n  url: http://127.0.0.1:9\n",
    });
    const ctx = ctxFor(dir);
    expect(ctx.dashboardTimeoutMs).toBe(DEFAULT_DASHBOARD_TIMEOUT_MS);
    const start = Date.now();
    const result = await collectDashboard(ctx);
    expect(Date.now() - start).toBeLessThan(ctx.dashboardTimeoutMs + 1000);
    expect(result.data.isLocalhost).toBe(true);
    expect(result.data.probed).toBe(true);
    expect(result.data.reachable).toBe(false);
  });
});

describe("providers collector", () => {
  it("detects configured providers and checks key format", async () => {
    const dir = await home({
      "config.yaml":
        "providers:\n  default_model: claude-sonnet\n  anthropic:\n    api_key_env: ANTHROPIC_API_KEY\n",
    });
    const result = await collectProviders(
      ctxFor(dir, { ...baseEnv, ANTHROPIC_API_KEY: "sk-ant-abcdefgh12345678" }),
    );
    expect(result.status).toBe("collected");
    const anthropic = result.data.providers?.find((p) => p.name === "anthropic");
    expect(anthropic?.envSet).toBe(true);
    const keyCheck = result.data.keyChecks?.find((k) => k.provider === "anthropic");
    expect(keyCheck?.formatOk).toBe(true);
    expect(JSON.stringify(result)).not.toContain("sk-ant-abcdefgh12345678");
  });

  it("reads provider keys from a .env file in the home", async () => {
    const dir = await home({
      "config.yaml": "providers:\n  openai:\n    api_key_env: OPENAI_API_KEY\n",
      ".env": "OPENAI_API_KEY=sk-livesecret0000000000\n",
    });
    const result = await collectProviders(ctxFor(dir));
    const openai = result.data.providers?.find((p) => p.name === "openai");
    expect(openai?.envSet).toBe(true);
    expect(JSON.stringify(result)).not.toContain("sk-livesecret0000000000");
  });
});

describe("mcp collector", () => {
  it("statically analyzes servers without executing them", async () => {
    const dir = await home({
      "config.yaml":
        "mcp:\n  servers:\n    - name: fs\n      command: node ./server.js\n      transport: stdio\n      env:\n        - FS_TOKEN\n    - name: bogus\n      command: definitely-not-a-real-binary-xyz\n",
    });
    const result = await collectMcp(ctxFor(dir));
    expect(result.status).toBe("collected");
    const fs = result.data.servers?.find((s) => s.name === "fs");
    expect(fs?.transport).toBe("stdio");
    expect(fs?.transportValid).toBe(true);
    expect(fs?.executableFound).toBe(true);
    expect(fs?.expectedEnv?.[0]).toEqual({ key: "FS_TOKEN", set: false });
    const bogus = result.data.servers?.find((s) => s.name === "bogus");
    expect(bogus?.executableFound).toBe(false);
  });

  it("supports mcpServers map style", async () => {
    const dir = await home({
      "config.yaml":
        "mcpServers:\n  github:\n    command: npx\n    args:\n      - -y\n      - server\n",
    });
    const result = await collectMcp(ctxFor(dir));
    const github = result.data.servers?.find((s) => s.name === "github");
    expect(github?.command).toBe("npx -y server");
  });

  it("supports mcp_servers top-level map style (Hermes v24)", async () => {
    const dir = await home({
      "config.yaml":
        "mcp_servers:\n  github:\n    command: npx\n    args:\n      - -y\n      - \"@modelcontextprotocol/server-github\"\n  brave:\n    command: npx\n    args:\n      - -y\n      - \"@modelcontextprotocol/server-brave\"\n",
    });
    const result = await collectMcp(ctxFor(dir));
    expect(result.status).toBe("collected");
    const github = result.data.servers?.find((s) => s.name === "github");
    expect(github?.command).toBe("npx -y @modelcontextprotocol/server-github");
    const brave = result.data.servers?.find((s) => s.name === "brave");
    expect(brave?.command).toBe("npx -y @modelcontextprotocol/server-brave");
    expect(result.data.servers).toHaveLength(2);
  });

  it("skips when no MCP servers configured", async () => {
    const dir = await home({ "config.yaml": "providers: {}\n" });
    const result = await collectMcp(ctxFor(dir));
    expect(result.status).toBe("skipped");
  });

  it("handles empty command string (command: \"\") as executableFound: false", async () => {
    const dir = await home({
      "config.yaml":
        "mcp:\n  servers:\n    - name: empty-cmd\n      command: \"\"\n      transport: stdio\n",
    });
    const result = await collectMcp(ctxFor(dir));
    expect(result.status).toBe("collected");
    const empty = result.data.servers?.find((s) => s.name === "empty-cmd");
    expect(empty?.command).toBe("");
    expect(empty?.executableFound).toBe(false);
    expect(empty?.transport).toBe("stdio");
    expect(empty?.transportValid).toBe(true);
  });

  it("distinguishes null (no command) from empty string command", async () => {
    const dir = await home({
      "config.yaml":
        "mcp:\n  servers:\n    - name: remote-only\n      url: https://example.com/mcp\n      transport: sse\n    - name: empty-cmd\n      command: \"\"\n      transport: stdio\n",
    });
    const result = await collectMcp(ctxFor(dir));
    expect(result.status).toBe("collected");
    const remote = result.data.servers?.find((s) => s.name === "remote-only");
    expect(remote?.command).toBeNull();
    expect(remote?.executableFound).toBeUndefined();
    expect(remote?.transport).toBe("sse");
    const empty = result.data.servers?.find((s) => s.name === "empty-cmd");
    expect(empty?.command).toBe("");
    expect(empty?.executableFound).toBe(false);
    expect(empty?.transport).toBe("stdio");
  });
});

describe("memory collector", () => {
  it("collects files, sizes and usage percent", async () => {
    const dir = await home({
      "config.yaml": "memory:\n  limit_mb: 1\n",
      "memory/notes.md": "x".repeat(2048),
    });
    const result = await collectMemory(ctxFor(dir));
    expect(result.status).toBe("collected");
    expect(result.data.fileCount).toBe(1);
    expect(result.data.totalSizeBytes).toBeGreaterThanOrEqual(2048);
    expect(result.data.limitBytes).toBe(1024 * 1024);
    expect(result.data.usagePercent).toBeGreaterThan(0);
  });

  it("returns partial when memory dir is absent", async () => {
    const result = await collectMemory(ctxFor(await home()));
    expect(result.status).toBe("partial");
    expect(result.data.readable).toBe(false);
  });
});

describe("skills collector", () => {
  it("parses metadata and detects broken references and duplicates", async () => {
    const dir = await home({
      "skills/alpha/SKILL.md": "---\nname: shared\ndescription: ok\n---\nSee [missing](./nope.md)\n",
      "skills/beta/SKILL.md": "---\nname: shared\n---\nno description\n",
    });
    const result = await collectSkills(ctxFor(dir));
    expect(result.status).toBe("collected");
    expect(result.data.skills?.length).toBe(2);
    // Hermes SKILL.md files are arbitrary Markdown — no required front matter fields
    expect(result.data.brokenRefs?.length).toBeGreaterThan(0);
    expect(result.data.duplicates?.some((d) => d.name === "shared")).toBe(true);
  });
});

describe("plugins collector", () => {
  it("parses manifests and reports missing installs", async () => {
    const dir = await home({
      "config.yaml": "plugins:\n  - name: installed\n    enabled: true\n  - name: ghost\n    enabled: false\n",
      "plugins/installed/plugin.json":
        JSON.stringify({ name: "installed", version: "1.0.0", engines: { hermes: ">=1.0" } }),
    });
    const result = await collectPlugins(ctxFor(dir));
    expect(result.status).toBe("collected");
    const installed = result.data.plugins?.find((p) => p.name === "installed");
    expect(installed?.manifestValid).toBe(true);
    expect(installed?.requiresHermes).toBe(">=1.0");
    const ghost = result.data.plugins?.find((p) => p.name === "ghost");
    expect(ghost?.exists).toBe(false);
  });
});

describe("logs collector", () => {
  it("counts and classifies recent errors", async () => {
    const dir = await home({
      "logs/hermes.log":
        "2024-01-01T00:00:00Z INFO started\n2024-01-01T00:01:00Z ERROR 401 unauthorized invalid api key\n2024-01-01T00:02:00Z ERROR ECONNREFUSED network failure\n",
    });
    const result = await collectLogs(ctxFor(dir));
    expect(result.status).toBe("collected");
    expect(result.data.errorCount).toBe(2);
    expect(result.data.errorTypes?.auth).toBe(1);
    expect(result.data.errorTypes?.network).toBe(1);
    expect(result.data.recentErrors?.[0]?.timestamp).toBe("2024-01-01T00:01:00Z");
  });

  it("skips when no logs directory exists", async () => {
    const result = await collectLogs(ctxFor(await home()));
    expect(result.status).toBe("skipped");
  });
});

describe("security collector", () => {
  it("detects secret leaks, public binding and masks values", async () => {
    const dir = await home({
      "config.yaml":
        "dashboard:\n  bind: 0.0.0.0\nsecurity:\n  sandbox: true\nproviders:\n  anthropic:\n    api_key: sk-ant-supersecret12345678\n",
      ".env": "OPENAI_API_KEY=sk-anotherrawsecret999\n",
    });
    const result = await collectSecurity(
      ctxFor(dir, { ...baseEnv, GH: "ghp_0123456789abcdef0123456789abcdef0000" }),
    );
    expect(result.status).toBe("collected");
    expect(result.data.publicBinding).toBe(true);
    expect(result.data.sandboxEnabled).toBe(true);
    expect(result.data.secretLeaks?.length).toBeGreaterThan(0);
    expect(result.data.envExposure).toBe(true);
    expect(result.data.exposedVars).toContain("GH");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("sk-ant-supersecret12345678");
    expect(serialized).not.toContain("sk-anotherrawsecret999");
    expect(serialized).not.toContain("ghp_0123456789abcdef0123456789abcdef0000");
  });
});

describe("collectAll", () => {
  it("never throws and returns all 11 areas with valid statuses", async () => {
    const results = await collectAll({ hermesHome: await home(), env: baseEnv });
    const areas = Object.keys(results);
    expect(areas).toHaveLength(11);
    for (const result of Object.values(results)) {
      expect(VALID_STATUSES.has(result.status)).toBe(true);
      expect(Array.isArray(result.evidence)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    }
  });

  it("tolerates a non-existent hermes home without throwing", async () => {
    const missing = path.join(await home(), "does-not-exist");
    const results = await collectAll({ hermesHome: missing, env: baseEnv });
    expect(results.config.status).toBe("partial");
    expect(results.system.status).toBe("collected");
  });
});
