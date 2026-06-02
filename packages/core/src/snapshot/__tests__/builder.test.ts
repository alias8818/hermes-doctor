import * as v from "valibot";
import { describe, expect, it } from "vitest";

import type { CollectorResult } from "../../schemas/collector.js";
import { HermesSnapshotSchema } from "../../schemas/snapshot.js";
import type { CollectorResults } from "../../collectors/index.js";
import { buildSnapshot } from "../builder.js";

/**
 * Helper: create a minimal CollectorResult for a given area.
 */
function makeResult<T>(
  area: string,
  data: T,
  overrides: Partial<CollectorResult<T>> = {},
): CollectorResult<T> {
  return {
    area: area as CollectorResult<T>["area"],
    status: overrides.status ?? "collected",
    data,
    evidence: overrides.evidence ?? [],
    warnings: overrides.warnings ?? [],
    errors: overrides.errors ?? [],
    durationMs: overrides.durationMs ?? 42,
  };
}

/**
 * Helper: create empty collector results suitable for building snapshots.
 */
function emptyResults(): CollectorResults {
  const emptyData = {};
  return {
    system: makeResult("system", emptyData),
    install: makeResult("install", emptyData),
    config: makeResult("config", emptyData),
    dashboard: makeResult("dashboard", emptyData),
    providers: makeResult("providers", emptyData),
    mcp: makeResult("mcp", emptyData),
    memory: makeResult("memory", emptyData),
    skills: makeResult("skills", emptyData),
    plugins: makeResult("plugins", emptyData),
    logs: makeResult("logs", emptyData),
    security: makeResult("security", emptyData),
  };
}

describe("buildSnapshot", () => {
  it("produces a valid HermesSnapshot from empty collector results", () => {
    const snapshot = buildSnapshot(emptyResults());

    expect(snapshot.schemaVersion).toBe("1.0");
    expect(snapshot.collectedAt).toBeTruthy();
    expect(snapshot.profile).toBe("default");
    expect(snapshot.hermesHome).toBeNull();
    expect(snapshot.collectionWarnings).toEqual([]);
    expect(snapshot.redaction.redacted).toBe(false);
    expect(snapshot.redaction.count).toBe(0);

    // Verify all 11 areas are present
    expect(snapshot.system).toBeDefined();
    expect(snapshot.install).toBeDefined();
    expect(snapshot.config).toBeDefined();
    expect(snapshot.dashboard).toBeDefined();
    expect(snapshot.providers).toBeDefined();
    expect(snapshot.mcp).toBeDefined();
    expect(snapshot.memory).toBeDefined();
    expect(snapshot.skills).toBeDefined();
    expect(snapshot.plugins).toBeDefined();
    expect(snapshot.logs).toBeDefined();
    expect(snapshot.security).toBeDefined();

    // Schema validation should pass
    const validated = v.parse(HermesSnapshotSchema, snapshot);
    expect(validated.schemaVersion).toBe("1.0");
  });

  it("includes profile and hermesHome from options", () => {
    const snapshot = buildSnapshot(emptyResults(), {
      profile: "work",
      hermesHome: "/home/user/.hermes",
    });

    expect(snapshot.profile).toBe("work");
    expect(snapshot.hermesHome).toBe("/home/user/.hermes");
  });

  it("uses provided collectedAt timestamp", () => {
    const ts = "2026-05-31T12:00:00.000Z";
    const snapshot = buildSnapshot(emptyResults(), { collectedAt: ts });
    expect(snapshot.collectedAt).toBe(ts);
  });

  it("defaults profile to 'default' when not provided", () => {
    const snapshot = buildSnapshot(emptyResults());
    expect(snapshot.profile).toBe("default");
  });

  it("defaults hermesHome to null when not provided", () => {
    const snapshot = buildSnapshot(emptyResults());
    expect(snapshot.hermesHome).toBeNull();
  });

  it("merges collector status, warnings and errors into each area snapshot", () => {
    const results = emptyResults();
    results.system = makeResult("system", { os: "linux" }, {
      status: "collected",
      warnings: ["docker not found"],
      errors: [],
    });
    results.config = makeResult("config", { configValid: true }, {
      status: "partial",
      warnings: ["config.yaml has missing sections"],
      errors: [],
    });

    const snapshot = buildSnapshot(results, {
      hermesHome: "/tmp/hermes",
    });

    // system area
    expect(snapshot.system.os).toBe("linux");
    expect(snapshot.system.status).toBe("collected");
    expect(snapshot.system.warnings).toEqual(["docker not found"]);

    // config area
    expect(snapshot.config.configValid).toBe(true);
    expect(snapshot.config.status).toBe("partial");
    expect(snapshot.config.warnings).toEqual(["config.yaml has missing sections"]);
  });

  it("aggregates collection warnings from all areas", () => {
    const results = emptyResults();
    results.system = makeResult("system", {}, { warnings: ["docker not found"] });
    results.providers = makeResult("providers", {}, { warnings: ["missing key"] });
    results.logs = makeResult("logs", {}, { warnings: ["no logs dir"] });

    const snapshot = buildSnapshot(results);

    expect(snapshot.collectionWarnings).toContain("docker not found");
    expect(snapshot.collectionWarnings).toContain("missing key");
    expect(snapshot.collectionWarnings).toContain("no logs dir");
    expect(snapshot.collectionWarnings).toHaveLength(3);
  });

  it("includes a redaction summary that reflects the content", () => {
    const results = emptyResults();
    results.system = makeResult("system", {
      os: "linux",
      // already-redacted value
      nodeVersion: "[REDACTED:OPENAI_KEY]",
    });

    const snapshot = buildSnapshot(results);

    expect(snapshot.redaction.redacted).toBe(true);
    expect(snapshot.redaction.totalRedactions).toBeGreaterThan(0);
    expect(snapshot.redaction.patterns).toContain("openai_key");
  });

  it("detects <HOME> path redactions in the snapshot", () => {
    const results = emptyResults();
    results.install = makeResult("install", {
      executablePath: "<HOME>/.hermes/bin/hermes",
    });

    const snapshot = buildSnapshot(results);

    expect(snapshot.redaction.homePathRedactions).toBeGreaterThan(0);
    expect(snapshot.redaction.redacted).toBe(true);
  });

  it("detects multiple redaction types in the snapshot", () => {
    const results = emptyResults();
    results.system = makeResult("system", {
      os: "linux",
      nodeVersion: "v26.2.0",
    });
    results.providers = makeResult("providers", {
      defaultModel: "claude",
      providers: [
        { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: false },
      ],
    });
    results.config = makeResult("config", {
      homePath: "<HOME>/.hermes",
      configPath: "<HOME>/.hermes/config.yaml",
    });

    // Add previously-redacted evidence
    results.security = makeResult("security", {
      bindAddress: "0.0.0.0",
      secretLeaks: [
        { location: ".env", secretType: "openai_key", maskedValue: "[REDACTED:OPENAI_KEY]" },
        { location: "config.yaml", secretType: "github_token", maskedValue: "[REDACTED:GITHUB_TOKEN]" },
      ],
    });

    const snapshot = buildSnapshot(results);

    expect(snapshot.redaction.redacted).toBe(true);
    expect(snapshot.redaction.homePathRedactions).toBeGreaterThan(0);
    expect(snapshot.redaction.patterns).toContain("openai_key");
    expect(snapshot.redaction.patterns).toContain("github_token");
  });

  it("validates against HermesSnapshotSchema", () => {
    const results = emptyResults();
    results.system = makeResult("system", {
      os: "linux",
      arch: "x64",
      nodeVersion: "v26.2.0",
    });
    results.config = makeResult("config", {
      homePath: "<HOME>/.hermes",
      homeExists: true,
      configPath: "<HOME>/.hermes/config.yaml",
      configExists: false,
    });

    const snapshot = buildSnapshot(results, { hermesHome: "/home/user/.hermes" });

    // Should not throw
    const parsed = v.parse(HermesSnapshotSchema, snapshot);
    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.system.os).toBe("linux");
    expect(parsed.system.arch).toBe("x64");
    expect(parsed.config.homeExists).toBe(true);
  });

  it("validates snapshot against HermesSnapshotSchema and throws on invalid structure", () => {
    // This test validates that the schema throws when given an obviously
    // wrong object shape at the snapshot level.
    expect(() =>
      v.parse(HermesSnapshotSchema, {
        schemaVersion: "1.0",
        collectedAt: "2026-01-01T00:00:00Z",
        profile: "default",
        // Missing all area fields - should fail validation
      }),
    ).toThrow();
  });

  it("handles mixed collector statuses correctly", () => {
    const results = emptyResults();
    results.system = makeResult("system", { os: "linux" }, { status: "collected" });
    results.config = makeResult("config", {}, { status: "failed", errors: ["YAML parse error"] });
    results.mcp = makeResult("mcp", {}, { status: "skipped" });
    results.memory = makeResult("memory", {}, { status: "partial", warnings: ["memory dir missing"] });

    const snapshot = buildSnapshot(results);

    expect(snapshot.system.status).toBe("collected");
    expect(snapshot.config.status).toBe("failed");
    expect(snapshot.mcp.status).toBe("skipped");
    expect(snapshot.memory.status).toBe("partial");
    
    expect(snapshot.config.errors).toContain("YAML parse error");
  });

  it("aggregates warnings from all areas into collectionWarnings", () => {
    const results = emptyResults();
    results.system = makeResult("system", {}, { warnings: ["A"] });
    results.install = makeResult("install", {}, { warnings: ["B"] });
    results.config = makeResult("config", {}, { warnings: ["C"] });
    results.dashboard = makeResult("dashboard", {}, { warnings: ["D"] });
    results.providers = makeResult("providers", {}, { warnings: ["E"] });
    results.mcp = makeResult("mcp", {}, { warnings: ["F"] });
    results.memory = makeResult("memory", {}, { warnings: ["G"] });
    results.skills = makeResult("skills", {}, { warnings: ["H"] });
    results.plugins = makeResult("plugins", {}, { warnings: ["I"] });
    results.logs = makeResult("logs", {}, { warnings: ["J"] });
    results.security = makeResult("security", {}, { warnings: ["K"] });

    const snapshot = buildSnapshot(results);

    expect(snapshot.collectionWarnings).toHaveLength(11);
    expect(snapshot.collectionWarnings).toEqual([
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K",
    ]);
  });

  it("builds a valid snapshot with realistic data", () => {
    const results: CollectorResults = {
      system: makeResult("system", {
        os: "linux",
        arch: "x64",
        nodeVersion: "v26.2.0",
        shell: "/bin/bash",
        path: ["/usr/bin", "/usr/local/bin"],
        docker: "Docker version 27.0.0",
        git: "git version 2.45.0",
      }, { warnings: ["git not found"] }),
      install: makeResult("install", {
        executablePath: "<HOME>/.nvm/versions/node/v26.2.0/bin/hermes",
        onPath: true,
        versionString: "hermes version 1.2.3",
        versionExitCode: 0,
        installMethod: "npm",
        permissionOk: true,
      }),
      config: makeResult("config", {
        homePath: "<HOME>/.hermes",
        homeExists: true,
        configPath: "<HOME>/.hermes/config.yaml",
        configExists: true,
        configValid: true,
        parseError: null,
        profiles: ["default", "work"],
        sections: { providers: true, mcpServers: true, dashboard: true },
        schemaErrors: [],
      }),
      dashboard: makeResult("dashboard", {
        url: "http://127.0.0.1:8080",
        reachable: false,
        statusCode: null,
        responseTimeMs: null,
        bindAddress: "127.0.0.1",
        isLocalhost: true,
        authRequired: true,
        tls: false,
        certValid: null,
        probed: true,
      }, { warnings: ["dashboard timed out"] }),
      providers: makeResult("providers", {
        defaultModel: "claude-sonnet",
        modelsConfigured: 2,
        providers: [
          { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: true },
          { name: "openai", requiredEnv: ["OPENAI_API_KEY"], envSet: false },
        ],
        localEndpoints: [],
        keyChecks: [
          { provider: "anthropic", formatOk: true },
          { provider: "openai", formatOk: false },
        ],
      }, { warnings: ["OPENAI_API_KEY not set"] }),
      mcp: makeResult("mcp", {
        servers: [
          {
            name: "fs",
            command: "node server.js",
            executableFound: true,
            transport: "stdio",
            transportValid: true,
            expectedEnv: [{ key: "FS_TOKEN", set: true }],
            toolsFilter: null,
          },
          {
            name: "bogus",
            command: "nonexistent",
            executableFound: false,
            transport: "stdio",
            transportValid: true,
            expectedEnv: [],
            toolsFilter: null,
          },
        ],
      }, { warnings: ["bogus: command not found"] }),
      memory: makeResult("memory", {
        memoryDir: "<HOME>/.hermes/memory",
        fileCount: 3,
        readable: true,
        files: [
          { name: "notes.md", sizeBytes: 2048, large: false },
          { name: "large.md", sizeBytes: 1048576, large: true },
        ],
        totalSizeBytes: 1050624,
        limitBytes: 5242880,
        usagePercent: 20.04,
        externalProvider: null,
        externalOk: null,
      }),
      skills: makeResult("skills", {
        skillsDir: "<HOME>/.hermes/skills",
        skills: [
          { dir: "<HOME>/.hermes/skills/alpha", name: "alpha", hasSkillMd: true },
          { dir: "<HOME>/.hermes/skills/beta", name: null, hasSkillMd: true },
        ],
        brokenRefs: [{ sourceSkill: "alpha", referencedPath: "./nope.md", reason: "not found" }],
        duplicates: [],
        largeFiles: [],
      }),
      plugins: makeResult("plugins", {
        plugins: [
          { name: "installed", path: "<HOME>/.hermes/plugins/installed", exists: true, enabled: true, manifestFound: true, manifestValid: true, parseError: null, dependencies: [], requiresHermes: ">=1.0", compatible: true },
        ],
      }),
      logs: makeResult("logs", {
        logFiles: [{ path: "<HOME>/.hermes/logs/hermes.log", readable: true, sizeBytes: 5000, linesRead: 100 }],
        logFile: "<HOME>/.hermes/logs/hermes.log",
        errorCount: 3,
        recentErrors: [
          { timestamp: "2026-05-31T10:00:00Z", message: "401 unauthorized", type: "auth" },
          { timestamp: "2026-05-31T10:01:00Z", message: "rate limit exceeded", type: "rate_limit" },
        ],
        errorTypes: { auth: 1, model: 0, mcp: 0, permission: 0, rate_limit: 1, network: 1, unknown: 0 },
        maxLinesRead: 500,
      }),
      security: makeResult("security", {
        publicBinding: false,
        bindAddress: "127.0.0.1",
        secretLeaks: [
          { location: ".env", secretType: "openai_key", maskedValue: "[REDACTED:OPENAI_KEY]" },
        ],
        terminalBackend: null,
        shellRestricted: false,
        sandboxEnabled: false,
        permissionIssues: [
          { path: "<HOME>/.hermes/config.yaml", currentMode: "644", suggestedMode: "600" },
        ],
        envExposure: false,
        exposedVars: [],
        dynamicExecBlocks: [],
      }),
    };

    const snapshot = buildSnapshot(results, {
      profile: "default",
      hermesHome: "/home/user/.hermes",
    });

    // Validate against schema
    const parsed = v.parse(HermesSnapshotSchema, snapshot);

    // Verify some key values
    expect(parsed.system.os).toBe("linux");
    expect(parsed.install.installMethod).toBe("npm");
    expect(parsed.config.configValid).toBe(true);
    expect(parsed.dashboard.isLocalhost).toBe(true);
    expect(parsed.providers.defaultModel).toBe("claude-sonnet");
    expect(parsed.mcp.servers).toHaveLength(2);
    expect(parsed.memory.fileCount).toBe(3);
    expect(parsed.skills.skills).toHaveLength(2);
    expect(parsed.plugins.plugins).toHaveLength(1);
    expect(parsed.logs.errorCount).toBe(3);
    expect(parsed.security.publicBinding).toBe(false);

    // Redaction summary should detect the markers
    expect(parsed.redaction.redacted).toBe(true);
    expect(parsed.redaction.homePathRedactions).toBeGreaterThan(0);
    expect(parsed.redaction.patterns).toContain("openai_key");

    // Collection warnings aggregated
    expect(parsed.collectionWarnings.length).toBeGreaterThan(0);
  });
});
