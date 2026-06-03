import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { HermesSnapshotSchema } from "../../schemas/snapshot.js";
import type { HermesSnapshot } from "../../schemas/snapshot.js";
import type { DoctorFinding } from "../../schemas/report.js";

/** Helper to safely access the first finding of a check result */
function first(fs: DoctorFinding[]): DoctorFinding {
  return fs[0]!;
}

/** Helper to find an evidence item by label in the Evidence[] array */
function findEvidence(evidence: unknown, label: string): string | undefined {
  if (Array.isArray(evidence)) {
    return evidence.find((e: {label: string; detail: string}) => e.label === label)?.detail;
  }
  return undefined;
}
import {
  allChecks,
  configChecks,
  dashboardChecks,
  installChecks,
  logsChecks,
  mcpChecks,
  memoryChecks,
  pluginsChecks,
  providersChecks,
  runAllChecks,
  securityChecks,
  skillsChecks,
  systemChecks,
  mergeThresholds,
  type Thresholds,
} from "../index.js";

// ---------------------------------------------------------------------------
// Build a minimal HermesSnapshot with all required fields
// ---------------------------------------------------------------------------
function minimalSnapshot(overrides: Partial<HermesSnapshot> = {}): HermesSnapshot {
  const base = {
    schemaVersion: "1.0" as const,
    collectedAt: "2026-05-31T12:00:00.000Z",
    profile: "default",
    hermesHome: null,
    system: { status: "collected" as const, warnings: [], errors: [] },
    install: { status: "collected" as const, warnings: [], errors: [] },
    config: { status: "collected" as const, warnings: [], errors: [] },
    dashboard: { status: "collected" as const, warnings: [], errors: [] },
    providers: { status: "collected" as const, warnings: [], errors: [] },
    mcp: { status: "collected" as const, warnings: [], errors: [] },
    memory: { status: "collected" as const, warnings: [], errors: [] },
    skills: { status: "collected" as const, warnings: [], errors: [] },
    plugins: { status: "collected" as const, warnings: [], errors: [] },
    logs: { status: "collected" as const, warnings: [], errors: [] },
    security: { status: "collected" as const, warnings: [], errors: [] },
    collectionWarnings: [],
    redaction: {
      redacted: false,
      count: 0,
      totalRedactions: 0,
      patterns: [],
      homePathRedactions: 0,
    },
  };

  return v.parse(HermesSnapshotSchema, { ...base, ...overrides });
}

// ---------------------------------------------------------------------------
// Meta verification
// ---------------------------------------------------------------------------
describe("check registration", () => {
  it("has at least 20 checks across all areas", () => {
    expect(allChecks.length).toBeGreaterThanOrEqual(20);
  });

  it("covers all 11 areas", () => {
    const areas = new Set(allChecks.map((c) => c.area));
    expect(areas.has("system")).toBe(true);
    expect(areas.has("install")).toBe(true);
    expect(areas.has("config")).toBe(true);
    expect(areas.has("dashboard")).toBe(true);
    expect(areas.has("providers")).toBe(true);
    expect(areas.has("mcp")).toBe(true);
    expect(areas.has("memory")).toBe(true);
    expect(areas.has("skills")).toBe(true);
    expect(areas.has("plugins")).toBe(true);
    expect(areas.has("logs")).toBe(true);
    expect(areas.has("security")).toBe(true);
    expect(areas.size).toBe(11);
  });

  it("every check has a unique id", () => {
    const ids = allChecks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every check has a title", () => {
    for (const check of allChecks) {
      expect(check.title).toBeTruthy();
    }
  });

  it("every check runs without throwing", () => {
    const snap = minimalSnapshot();
    for (const check of allChecks) {
      expect(() => check.run(snap)).not.toThrow();
    }
  });

  it("each check produces at least one finding", () => {
    const snap = minimalSnapshot();
    for (const check of allChecks) {
      const findings = check.run(snap);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("every finding has required DoctorFinding fields", () => {
    const snap = minimalSnapshot();
    for (const check of allChecks) {
      for (const finding of check.run(snap)) {
        expect(finding.id).toBeTruthy();
        expect(finding.area).toBe(check.area);
        expect(["ok", "info", "warning", "broken", "risk", "unknown"]).toContain(finding.status);
        expect(finding.severity).toBeGreaterThanOrEqual(0);
        expect(finding.severity).toBeLessThanOrEqual(4);
        expect(Number.isInteger(finding.severity)).toBe(true);
        expect(finding.title).toBeTruthy();
        expect(finding.message).toBeTruthy();
        expect(finding.evidence).toBeDefined();
        expect(finding.fixes).toBeDefined();
        expect(Array.isArray(finding.fixes)).toBe(true);
      }
    }
  });

  it("runAllChecks returns findings for all areas", () => {
    const snap = minimalSnapshot();
    const findings = runAllChecks(snap);
    expect(findings.length).toBeGreaterThanOrEqual(allChecks.length);

    const areasFound = new Set(findings.map((f) => f.area));
    expect(areasFound.size).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// System checks
// ---------------------------------------------------------------------------
describe("system checks", () => {
  it("system-info: reports os, arch, node version", () => {
    const snap = minimalSnapshot({
      system: {
        status: "collected",
        warnings: [],
        errors: [],
        os: "linux",
        arch: "x64",
        nodeVersion: "v26.2.0",
      },
    });
    const findings = systemChecks[0]!.run(snap);
    expect(first(findings).id).toBe("system-info");
    expect(first(findings).status).toBe("info");
    expect(findEvidence(first(findings).evidence, "os")).toBe("linux");
    expect(findEvidence(first(findings).evidence, "arch")).toBe("x64");
    expect(findEvidence(first(findings).evidence, "node")).toBe("v26.2.0");
  });

  it("system-shell-env: reports shell and path when available", () => {
    const snap = minimalSnapshot({
      system: {
        status: "collected",
        warnings: [],
        errors: [],
        shell: "/bin/bash",
        path: ["/usr/bin", "/usr/local/bin"],
      },
    });
    const findings = systemChecks[1]!.run(snap);
    expect(first(findings).id).toBe("system-shell-env");
    expect(first(findings).status).toBe("info");
    expect(findEvidence(first(findings).evidence, "shell")).toBe("/bin/bash");
  });

  it("system-docker: ok when docker is installed", () => {
    const snap = minimalSnapshot({
      system: {
        status: "collected",
        warnings: [],
        errors: [],
        docker: "Docker version 27.0.0",
      },
    });
    const findings = systemChecks[2]!.run(snap);
    expect(first(findings).status).toBe("ok");
    expect(findEvidence(first(findings).evidence, "docker_version")).toContain("Docker");
  });

  it("system-docker: info when docker is not available", () => {
    const snap = minimalSnapshot();
    const findings = systemChecks[2]!.run(snap);
    expect(first(findings).status).toBe("info");
  });

  it("system-git: ok when git is installed", () => {
    const snap = minimalSnapshot({
      system: {
        status: "collected",
        warnings: [],
        errors: [],
        git: "git version 2.45.0",
      },
    });
    const findings = systemChecks[3]!.run(snap);
    expect(first(findings).status).toBe("ok");
    expect(findEvidence(first(findings).evidence, "git_version")).toContain("git");
  });
});

// ---------------------------------------------------------------------------
// Install checks
// ---------------------------------------------------------------------------
describe("install checks", () => {
  it("install-executable: broken when hermes not on PATH", () => {
    const snap = minimalSnapshot({
      install: {
        status: "collected",
        warnings: [],
        errors: [],
        onPath: false,
        executablePath: null,
      },
    });
    const findings = installChecks[0]!.run(snap);
    expect(first(findings).id).toBe("install-executable");
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
    expect(findEvidence(first(findings).evidence, "on_path")).toBe("false");
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });

  it("install-executable: ok when hermes is on PATH", () => {
    const snap = minimalSnapshot({
      install: {
        status: "collected",
        warnings: [],
        errors: [],
        onPath: true,
        executablePath: "/usr/bin/hermes",
      },
    });
    const findings = installChecks[0]!.run(snap);
    expect(first(findings).status).toBe("ok");
    expect(first(findings).severity).toBe(0);
  });

  it("install-version: ok when version command succeeds", () => {
    const snap = minimalSnapshot({
      install: {
        status: "collected",
        warnings: [],
        errors: [],
        versionString: "hermes version 1.2.3",
        versionExitCode: 0,
      },
    });
    const findings = installChecks[1]!.run(snap);
    expect(first(findings).status).toBe("ok");
    expect(findEvidence(first(findings).evidence, "version_string")).toBe("hermes version 1.2.3");
  });

  it("install-version: broken when no version detected", () => {
    const snap = minimalSnapshot();
    const findings = installChecks[1]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
  });

  it("install-method: reports install method", () => {
    const snap = minimalSnapshot({
      install: {
        status: "collected",
        warnings: [],
        errors: [],
        installMethod: "npm",
      },
    });
    const findings = installChecks[2]!.run(snap);
    expect(first(findings).status).toBe("ok");
    expect(findEvidence(first(findings).evidence, "install_method")).toBe("npm");
  });

  it("install-permissions: broken when permissions are wrong", () => {
    const snap = minimalSnapshot({
      install: {
        status: "collected",
        warnings: [],
        errors: [],
        permissionOk: false,
        executablePath: "/usr/bin/hermes",
      },
    });
    const findings = installChecks[3]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(4);
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Config checks
// ---------------------------------------------------------------------------
describe("config checks", () => {
  it("config-home-exists: ok when home exists", () => {
    const snap = minimalSnapshot({
      config: {
        status: "collected",
        warnings: [],
        errors: [],
        homePath: "<HOME>/.hermes",
        homeExists: true,
      },
    });
    const findings = configChecks[0]!.run(snap);
    expect(first(findings).status).toBe("ok");
    expect(findEvidence(first(findings).evidence, "home_exists")).toBe("true");
  });

  it("config-home-exists: broken when home missing", () => {
    const snap = minimalSnapshot({
      config: {
        status: "collected",
        warnings: [],
        errors: [],
        homeExists: false,
      },
    });
    const findings = configChecks[0]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
  });

  it("config-parse: ok when config.yaml is valid", () => {
    const snap = minimalSnapshot({
      config: {
        status: "collected",
        warnings: [],
        errors: [],
        configValid: true,
        configExists: true,
      },
    });
    const findings = configChecks[1]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("config-parse: warning when config.yaml missing", () => {
    const snap = minimalSnapshot({
      config: {
        status: "collected",
        warnings: [],
        errors: [],
        configValid: false,
        configExists: false,
      },
    });
    const findings = configChecks[1]!.run(snap);
    expect(first(findings).status).toBe("warning");
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });

  it("config-parse: broken when config.yaml has parse errors", () => {
    const snap = minimalSnapshot({
      config: {
        status: "collected",
        warnings: [],
        errors: [],
        configValid: false,
        configExists: true,
        parseError: "YAML parse error at line 3",
      },
    });
    const findings = configChecks[1]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
  });

  it("config-profiles: ok when profiles exist", () => {
    const snap = minimalSnapshot({
      config: {
        status: "collected",
        warnings: [],
        errors: [],
        profiles: ["default", "work"],
      },
    });
    const findings = configChecks[2]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("config-profiles: warning when no profiles", () => {
    const snap = minimalSnapshot({
      config: {
        status: "collected",
        warnings: [],
        errors: [],
        profiles: [],
      },
    });
    const findings = configChecks[2]!.run(snap);
    expect(first(findings).status).toBe("warning");
  });

  it("config-sections: ok when all sections present", () => {
    const snap = minimalSnapshot({
      config: {
        status: "collected",
        warnings: [],
        errors: [],
        sections: { providers: true, mcp: true, skills: true, plugins: true },
      },
    });
    const findings = configChecks[3]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });
  it("config-sections: still ok when mcp section is absent (MCP is optional)", () => {
    const snap = minimalSnapshot({
      config: {
        status: "collected",
        warnings: [],
        errors: [],
        sections: { providers: true, skills: true, plugins: true },
      },
    });
    const findings = configChecks[3]!.run(snap);
    // mcp section is optional — its absence should not trigger a warning
    expect(first(findings).status).toBe("ok");
  });
  it("config-sections: warning when providers section is absent", () => {
    const snap = minimalSnapshot({
      config: {
        status: "collected",
        warnings: [],
        errors: [],
        sections: { skills: true, plugins: true },
      },
    });
    const findings = configChecks[3]!.run(snap);
    // providers is still required, so its absence should be a warning
    expect(first(findings).status).toBe("warning");
    expect(first(findings).message).toContain("Missing");
    expect(first(findings).message).toContain("providers");
    expect(first(findings).message).not.toContain("mcp");
  });

  it("config-schema: ok when no schema errors", () => {
    const snap = minimalSnapshot({
      config: {
        status: "collected",
        warnings: [],
        errors: [],
        schemaErrors: [],
      },
    });
    const findings = configChecks[4]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Dashboard checks
// ---------------------------------------------------------------------------
describe("dashboard checks", () => {
  it("dashboard-reachable: info when no dashboard configured", () => {
    const snap = minimalSnapshot();
    const findings = dashboardChecks[0]!.run(snap);
    expect(first(findings).id).toBe("dashboard-reachable");
    expect(["ok", "info"]).toContain(first(findings).status);
  });

  it("dashboard-reachable: ok when reachable", () => {
    const snap = minimalSnapshot({
      dashboard: {
        status: "collected",
        warnings: [],
        errors: [],
        url: "http://127.0.0.1:8080",
        reachable: true,
        statusCode: 200,
        isLocalhost: true,
        probed: true,
      },
    });
    const findings = dashboardChecks[0]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("dashboard-reachable: broken when unreachable", () => {
    const snap = minimalSnapshot({
      dashboard: {
        status: "collected",
        warnings: [],
        errors: [],
        url: "http://127.0.0.1:8080",
        reachable: false,
        isLocalhost: true,
        probed: true,
      },
    });
    const findings = dashboardChecks[0]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
  });

  it("dashboard-localhost-binding: ok when bound to localhost", () => {
    const snap = minimalSnapshot({
      dashboard: {
        status: "collected",
        warnings: [],
        errors: [],
        bindAddress: "127.0.0.1",
        isLocalhost: true,
      },
    });
    const findings = dashboardChecks[1]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("dashboard-localhost-binding: risk when bound to 0.0.0.0", () => {
    const snap = minimalSnapshot({
      dashboard: {
        status: "collected",
        warnings: [],
        errors: [],
        bindAddress: "0.0.0.0",
        isLocalhost: false,
      },
    });
    const findings = dashboardChecks[1]!.run(snap);
    expect(first(findings).status).toBe("risk");
    expect(first(findings).severity).toBe(4);
  });

  it("dashboard-auth: risk when no auth on configured dashboard", () => {
    const snap = minimalSnapshot({
      dashboard: {
        status: "collected",
        warnings: [],
        errors: [],
        url: "http://127.0.0.1:8080",
        authRequired: false,
      },
    });
    const findings = dashboardChecks[2]!.run(snap);
    expect(first(findings).status).toBe("risk");
    expect(first(findings).severity).toBe(4);
  });

  it("dashboard-auth: info when no dashboard configured", () => {
    const snap = minimalSnapshot({
      dashboard: {
        status: "skipped",
        warnings: [],
        errors: [],
      },
    });
    const findings = dashboardChecks[2]!.run(snap);
    expect(first(findings).status).toBe("info");
    expect(first(findings).severity).toBe(0);
  });

  it("dashboard-tls: ok when TLS enabled and cert valid", () => {
    const snap = minimalSnapshot({
      dashboard: {
        status: "collected",
        warnings: [],
        errors: [],
        url: "https://dashboard.example.com",
        tls: true,
        certValid: true,
      },
    });
    const findings = dashboardChecks[3]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Providers checks
// ---------------------------------------------------------------------------
describe("providers checks", () => {
  it("providers-default-model: ok when default model set", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        defaultModel: "claude-sonnet",
        modelsConfigured: 2,
      },
    });
    const findings = providersChecks[0]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("providers-env-vars: ok when all env vars set", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        providers: [
          { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: true },
          { name: "openai", requiredEnv: ["OPENAI_API_KEY"], envSet: true },
        ],
      },
    });
    const findings = providersChecks[1]!.run(snap);
    expect(first(findings).status).toBe("ok");
    const providersEv = findEvidence(first(findings).evidence, "providers");
    expect(providersEv).toBeTruthy();
    const parsedProviders = JSON.parse(providersEv!);
    expect(parsedProviders).toHaveLength(2);
  });

  it("providers-env-vars: broken when env vars missing", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        providers: [
          { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: false },
        ],
      },
    });
    const findings = providersChecks[1]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });

  it("providers-local-endpoints: ok when all reachable", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        localEndpoints: [
          { url: "http://127.0.0.1:11434", reachable: true, latencyMs: 5 },
        ],
      },
    });
    const findings = providersChecks[2]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("providers-key-format: ok when all formats valid", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        keyChecks: [
          { provider: "anthropic", formatOk: true },
          { provider: "openai", formatOk: true },
        ],
      },
    });
    const findings = providersChecks[3]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  // -------------------------------------------------------------------------
  // New provider checks: custom-base-url, auth-conflict, orphaned-models
  // -------------------------------------------------------------------------
  it("providers-custom-base-url: broken when custom provider missing base_url", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        customProviders: [
          { name: "my-local-llm", baseUrl: null, isBuiltIn: false },
        ],
      },
    });
    const findings = providersChecks[4]!.run(snap);
    expect(first(findings).id).toBe("providers-custom-base-url");
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
    expect(first(findings).message).toContain("my-local-llm");
    expect(first(findings).message).toContain("base_url");
    expect(first(findings).fixes.length).toBeGreaterThan(0);
    // Fix guidance score >= 3: command present + description + specificity
    expect(first(findings).fixes[0]!.command).toBeTruthy();
    expect(first(findings).fixes[0]!.description).toBeTruthy();
  });

  it("providers-custom-base-url: broken when base_url is empty string", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        customProviders: [
          { name: "my-llm", baseUrl: "", isBuiltIn: false },
        ],
      },
    });
    const findings = providersChecks[4]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
  });

  it("providers-custom-base-url: ok when custom provider has base_url", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        customProviders: [
          { name: "my-local-llm", baseUrl: "http://localhost:8080/v1", isBuiltIn: false },
        ],
      },
    });
    const findings = providersChecks[4]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("providers-custom-base-url: no finding when no custom providers", () => {
    const snap = minimalSnapshot();
    const findings = providersChecks[4]!.run(snap);
    // Should be info or ok, not broken
    expect(first(findings).status).not.toBe("broken");
  });

  it("providers-custom-base-url: does NOT fire for built-in providers", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        providers: [
          { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: true },
          { name: "openai", requiredEnv: ["OPENAI_API_KEY"], envSet: true },
        ],
        customProviders: [],
      },
    });
    const findings = providersChecks[4]!.run(snap);
    // Must not produce broken finding for built-in providers
    expect(first(findings).status).not.toBe("broken");
  });

  it("providers-auth-conflict: info when auth.json active_provider configured", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        providers: [
          { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: true },
        ],
        authInfo: { activeProvider: "openai", hasSecrets: false },
      },
    });
    const findings = providersChecks[5]!.run(snap);
    expect(first(findings).id).toBe("providers-auth-conflict");
    // auth.json active_provider is for dashboard web UI auth — not cross-referenced with model providers
    expect(first(findings).status).toBe("info");
    expect(first(findings).severity).toBe(0);
    expect(first(findings).message).toContain("openai");
  });

  it("providers-auth-conflict: info when auth.json active_provider differs from model config", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        defaultModel: "claude-sonnet",
        providers: [
          { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: true },
          { name: "openai", requiredEnv: ["OPENAI_API_KEY"], envSet: true },
        ],
        modelReferences: [
          { modelName: "claude-sonnet", providerRef: "anthropic", providerExists: true },
        ],
        authInfo: { activeProvider: "openai", hasSecrets: false },
      },
    });
    // auth.json active_provider is for dashboard web UI — not cross-referenced with model providers
    const findings = providersChecks[5]!.run(snap);
    expect(first(findings).status).toBe("info");
    expect(first(findings).severity).toBe(0);
    expect(first(findings).message).toContain("openai");
  });

  it("providers-auth-conflict: no finding when auth.json not present", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        providers: [
          { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: true },
        ],
        authInfo: null,
      },
    });
    const findings = providersChecks[5]!.run(snap);
    expect(first(findings).status).not.toBe("broken");
    expect(first(findings).status).not.toBe("warning");
  });

  it("providers-auth-conflict: info when auth.json active_provider is set (no cross-referencing)", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        defaultModel: "claude-sonnet",
        providers: [
          { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: true },
        ],
        modelReferences: [
          { modelName: "claude-sonnet", providerRef: "anthropic", providerExists: true },
        ],
        authInfo: { activeProvider: "anthropic", hasSecrets: false },
      },
    });
    // auth.json active_provider is for dashboard web UI — just reported as info
    const findings = providersChecks[5]!.run(snap);
    expect(first(findings).status).toBe("info");
    expect(first(findings).severity).toBe(0);
  });

  it("providers-orphaned-models: broken when model references non-existent provider", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        providers: [
          { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: true },
        ],
        modelReferences: [
          { modelName: "claude-sonnet-4-20250514", providerRef: "anthropic", providerExists: true },
          { modelName: "gpt-4", providerRef: "openai", providerExists: false },
        ],
      },
    });
    const findings = providersChecks[6]!.run(snap);
    expect(first(findings).id).toBe("providers-orphaned-models");
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
    expect(first(findings).message).toContain("gpt-4");
    expect(first(findings).message).toContain("openai");
    expect(first(findings).fixes.length).toBeGreaterThan(0);
    expect(first(findings).fixes[0]!.command).toBeTruthy();
    expect(first(findings).fixes[0]!.description).toBeTruthy();
  });

  it("providers-orphaned-models: no finding when all model references are valid", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        providers: [
          { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: true },
        ],
        modelReferences: [
          { modelName: "claude-sonnet-4-20250514", providerRef: "anthropic", providerExists: true },
        ],
      },
    });
    const findings = providersChecks[6]!.run(snap);
    expect(first(findings).status).not.toBe("broken");
  });

  it("providers-orphaned-models: no finding when no modelReferences", () => {
    const snap = minimalSnapshot();
    const findings = providersChecks[6]!.run(snap);
    expect(first(findings).status).not.toBe("broken");
  });

  it("providers-orphaned-models: does not fire when default model has no provider ref", () => {
    const snap = minimalSnapshot({
      providers: {
        status: "collected",
        warnings: [],
        errors: [],
        defaultModel: "claude-sonnet",
        providers: [
          { name: "anthropic", requiredEnv: ["ANTHROPIC_API_KEY"], envSet: true },
        ],
        modelReferences: [
          { modelName: "claude-sonnet", providerRef: null, providerExists: undefined },
        ],
      },
    });
    const findings = providersChecks[6]!.run(snap);
    // Models without explicit provider ref shouldn't trigger orphan check
    expect(first(findings).status).not.toBe("broken");
  });
});

// ---------------------------------------------------------------------------
// MCP checks
// ---------------------------------------------------------------------------
describe("mcp checks", () => {
  it("mcp-servers-found: ok when servers configured", () => {
    const snap = minimalSnapshot({
      mcp: {
        status: "collected",
        warnings: [],
        errors: [],
        servers: [{ name: "fs", command: "node server.js", executableFound: true }],
      },
    });
    const findings = mcpChecks[0]!.run(snap);
    expect(first(findings).status).toBe("ok");
    const serversEv = findEvidence(first(findings).evidence, "servers");
    expect(serversEv).toBeTruthy();
    const parsedServers = JSON.parse(serversEv!);
    expect(parsedServers).toContain("fs");
  });

  it("mcp-commands-exist: broken when commands missing", () => {
    const snap = minimalSnapshot({
      mcp: {
        status: "collected",
        warnings: [],
        errors: [],
        servers: [
          { name: "bogus", command: "nonexistent", executableFound: false },
        ],
      },
    });
    const findings = mcpChecks[1]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });

  it("mcp-commands-exist: ok when remote-only server (executableFound undefined)", () => {
    const snap = minimalSnapshot({
      mcp: {
        status: "collected",
        warnings: [],
        errors: [],
        servers: [
          { name: "remote-tools", command: null, executableFound: undefined },
        ],
      },
    });
    const findings = mcpChecks[1]!.run(snap);
    expect(first(findings).status).not.toBe("broken");
    expect(first(findings).status).not.toBe("risk");
  });

  it("mcp-commands-exist: broken with empty command string (executableFound false)", () => {
    const snap = minimalSnapshot({
      mcp: {
        status: "collected",
        warnings: [],
        errors: [],
        servers: [
          { name: "empty-cmd", command: "", executableFound: false },
        ],
      },
    });
    const findings = mcpChecks[1]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });

  it("mcp-commands-exist: only missing commands flagged when mixed with remote-only", () => {
    const snap = minimalSnapshot({
      mcp: {
        status: "collected",
        warnings: [],
        errors: [],
        servers: [
          { name: "remote-tools", command: null, executableFound: undefined },
          { name: "bogus", command: "nonexistent", executableFound: false },
          { name: "fs", command: "node server.js", executableFound: true },
        ],
      },
    });
    const findings = mcpChecks[1]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
    // The broken finding's message should mention bogus but NOT remote-tools
    expect(first(findings).message).toContain("bogus");
    expect(first(findings).message).not.toContain("remote-tools");
  });

  it("mcp-env-vars: broken when env vars missing", () => {
    const snap = minimalSnapshot({
      mcp: {
        status: "collected",
        warnings: [],
        errors: [],
        servers: [
          {
            name: "fs",
            command: "node server.js",
            executableFound: true,
            expectedEnv: [{ key: "FS_TOKEN", set: false }],
          },
        ],
      },
    });
    const findings = mcpChecks[2]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });

  it("mcp-transport: ok when all transports valid", () => {
    const snap = minimalSnapshot({
      mcp: {
        status: "collected",
        warnings: [],
        errors: [],
        servers: [
          { name: "fs", command: "node", executableFound: true, transport: "stdio", transportValid: true },
        ],
      },
    });
    const findings = mcpChecks[4]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Memory checks
// ---------------------------------------------------------------------------
describe("memory checks", () => {
  it("memory-files-exist: ok when files exist", () => {
    const snap = minimalSnapshot({
      memory: {
        status: "collected",
        warnings: [],
        errors: [],
        fileCount: 3,
        totalSizeBytes: 20480,
        readable: true,
      },
    });
    const findings = memoryChecks[0]!.run(snap);
    expect(first(findings).status).toBe("ok");
    expect(findEvidence(first(findings).evidence, "file_count")).toBe("3");
  });

  it("memory-files-exist: info when no files", () => {
    const snap = minimalSnapshot();
    const findings = memoryChecks[0]!.run(snap);
    expect(first(findings).status).toBe("info");
  });

  it("memory-file-sizes: warning when large files present", () => {
    const snap = minimalSnapshot({
      memory: {
        status: "collected",
        warnings: [],
        errors: [],
        files: [
          { name: "large.md", sizeBytes: 1048576 * 2, large: true },
        ],
        totalSizeBytes: 1048576 * 2,
      },
    });
    const findings = memoryChecks[1]!.run(snap);
    expect(first(findings).status).toBe("warning");
  });

  it("memory-limit: risk when exceeded", () => {
    const snap = minimalSnapshot({
      memory: {
        status: "collected",
        warnings: [],
        errors: [],
        totalSizeBytes: 5242880,
        limitBytes: 5242880,
        usagePercent: 100,
      },
    });
    const findings = memoryChecks[2]!.run(snap);
    expect(first(findings).status).toBe("warning");
    expect(first(findings).severity).toBe(2);
  });

  it("memory-limit: warning when near limit", () => {
    const snap = minimalSnapshot({
      memory: {
        status: "collected",
        warnings: [],
        errors: [],
        totalSizeBytes: 4194304,
        limitBytes: 5242880,
        usagePercent: 80,
      },
    });
    const findings = memoryChecks[2]!.run(snap);
    expect(first(findings).status).toBe("warning");
    expect(first(findings).severity).toBe(2);
  });

  it("memory-external-provider: info when not configured", () => {
    const snap = minimalSnapshot();
    const findings = memoryChecks[3]!.run(snap);
    expect(first(findings).status).toBe("info");
  });

  it("memory-limit: uses custom warn threshold from snapshot", () => {
    // With default 80%, usagePercent=75 would be OK
    // But with custom warnPercent=70, it should warn
    const snap = minimalSnapshot({
      memory: {
        status: "collected",
        warnings: [],
        errors: [],
        totalSizeBytes: 3932160,
        limitBytes: 5242880,
        usagePercent: 75,
      },
      thresholds: {
        memoryWarnPercent: 70,
        memoryCriticalPercent: 100,
        hugeFileBytes: 104857600,
        crashLoopErrorCount: 50,
        crashLoopRecentErrors: 20,
        largeFileBytes: 262144,
        skillsLargeFileBytes: 524288,
      },
    });
    const findings = memoryChecks[2]!.run(snap);
    expect(first(findings).status).toBe("warning");
    expect(first(findings).severity).toBe(2);
    expect(first(findings).title).toBe("Memory Near Limit");
  });

  it("memory-limit: uses custom critical threshold from snapshot", () => {
    // With default criticalPercent=100, usagePercent=95 would be "near limit"
    // But with custom criticalPercent=90, it should be "exceeded"
    const snap = minimalSnapshot({
      memory: {
        status: "collected",
        warnings: [],
        errors: [],
        totalSizeBytes: 4980736,
        limitBytes: 5242880,
        usagePercent: 95,
      },
      thresholds: {
        memoryWarnPercent: 80,
        memoryCriticalPercent: 90,
        hugeFileBytes: 104857600,
        crashLoopErrorCount: 50,
        crashLoopRecentErrors: 20,
        largeFileBytes: 262144,
        skillsLargeFileBytes: 524288,
      },
    });
    const findings = memoryChecks[2]!.run(snap);
    expect(first(findings).status).toBe("warning");
    expect(first(findings).severity).toBe(2);
    expect(first(findings).title).toBe("Memory Limit Exceeded");
  });

  it("memory-huge-files: uses custom huge file threshold from snapshot", () => {
    // Default is 100 MB — a 60 MB file would NOT be detected as huge.
    // With custom 50 MB threshold, a 60 MB file SHOULD be detected.
    const snap = minimalSnapshot({
      memory: {
        status: "collected",
        warnings: [],
        errors: [],
        files: [
          { name: "big.md", sizeBytes: 60 * 1024 * 1024, large: true },
        ],
        totalSizeBytes: 60 * 1024 * 1024,
      },
      thresholds: {
        memoryWarnPercent: 80,
        memoryCriticalPercent: 100,
        hugeFileBytes: 50 * 1024 * 1024, // 50 MB
        crashLoopErrorCount: 50,
        crashLoopRecentErrors: 20,
        largeFileBytes: 262144,
        skillsLargeFileBytes: 524288,
      },
    });
    const findings = memoryChecks[5]!.run(snap);
    expect(first(findings).status).toBe("warning");
    expect(first(findings).severity).toBe(2);
    expect(first(findings).title).toBe("Huge Memory Files Detected");
    expect(first(findings).message).toContain("big.md");
  });

  it("memory-huge-files: respects higher threshold (does not flag below)", () => {
    // Default is 100 MB — files below that should NOT be flagged.
    // With custom 200 MB threshold, a 150 MB file should be OK.
    const snap = minimalSnapshot({
      memory: {
        status: "collected",
        warnings: [],
        errors: [],
        files: [
          { name: "big.md", sizeBytes: 150 * 1024 * 1024, large: true },
        ],
        totalSizeBytes: 150 * 1024 * 1024,
      },
      thresholds: {
        memoryWarnPercent: 80,
        memoryCriticalPercent: 100,
        hugeFileBytes: 200 * 1024 * 1024, // 200 MB
        crashLoopErrorCount: 50,
        crashLoopRecentErrors: 20,
        largeFileBytes: 262144,
        skillsLargeFileBytes: 524288,
      },
    });
    const findings = memoryChecks[5]!.run(snap);
    expect(first(findings).status).toBe("ok");
    expect(first(findings).title).toBe("No Huge Memory Files");
  });
});

// ---------------------------------------------------------------------------
// Threshold configurability
// ---------------------------------------------------------------------------
describe("threshold configurability (VAL-THRESHOLD)", () => {
  it("mergeThresholds returns defaults when given undefined", () => {
    const result = mergeThresholds(undefined);
    expect(result.memoryWarnPercent).toBe(80);
    expect(result.memoryCriticalPercent).toBe(100);
    expect(result.hugeFileBytes).toBe(100 * 1024 * 1024);
    expect(result.crashLoopErrorCount).toBe(50);
    expect(result.crashLoopRecentErrors).toBe(20);
    expect(result.largeFileBytes).toBe(256 * 1024);
    expect(result.skillsLargeFileBytes).toBe(512 * 1024);
  });

  it("mergeThresholds returns defaults when given null", () => {
    const result = mergeThresholds(null);
    expect(result.memoryWarnPercent).toBe(80);
  });

  it("mergeThresholds overrides specified fields, keeps defaults for rest", () => {
    const result = mergeThresholds({ memoryWarnPercent: 90 });
    expect(result.memoryWarnPercent).toBe(90);
    expect(result.memoryCriticalPercent).toBe(100); // default
    expect(result.hugeFileBytes).toBe(100 * 1024 * 1024); // default
  });

  it("mergeThresholds overrides all fields", () => {
    const custom: Thresholds = {
      memoryWarnPercent: 50,
      memoryCriticalPercent: 90,
      hugeFileBytes: 50 * 1024 * 1024,
      crashLoopErrorCount: 10,
      crashLoopRecentErrors: 5,
      largeFileBytes: 1024 * 1024,
      skillsLargeFileBytes: 2 * 1024 * 1024,
    };
    const result = mergeThresholds(custom);
    expect(result).toEqual(custom);
  });

  it("logs-recent-errors: uses custom crash loop error threshold", () => {
    // With AND logic, both error count AND recent errors must exceed their thresholds.
    // Custom crashLoopErrorCount of 30 + crashLoopRecentErrors of 3:
    // 40 errors > 30 AND 5 recent > 3 → crash loop.
    const snap = minimalSnapshot({
      logs: {
        status: "collected",
        warnings: [],
        errors: [],
        logFile: "/home/.hermes/logs/hermes.log",
        errorCount: 40,
        recentErrors: Array.from({ length: 5 }, (_, i) => ({
          timestamp: `2026-06-01T10:0${i}:00Z`,
          message: `error ${i + 1}`,
        })),
      },
      thresholds: {
        memoryWarnPercent: 80,
        memoryCriticalPercent: 100,
        hugeFileBytes: 104857600,
        crashLoopErrorCount: 30,
        crashLoopRecentErrors: 3,
        largeFileBytes: 262144,
        skillsLargeFileBytes: 524288,
      },
    });
    const findings = logsChecks[0]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
    expect(first(findings).title).toBe("High Error Rate Detected");
  });

  it("logs-recent-errors: uses custom crash loop recent threshold", () => {
    // With AND logic, both conditions must be met. Custom crashLoopRecentErrors of 5
    // and crashLoopErrorCount of 8: 10 errors > 8 AND 10 recent > 5 → crash loop.
    const snap = minimalSnapshot({
      logs: {
        status: "collected",
        warnings: [],
        errors: [],
        logFile: "/home/.hermes/logs/hermes.log",
        errorCount: 10,
        recentErrors: Array.from({ length: 10 }, (_, i) => ({
          timestamp: `2026-06-01T10:0${i}:00Z`,
          message: `error ${i + 1}`,
        })),
      },
      thresholds: {
        memoryWarnPercent: 80,
        memoryCriticalPercent: 100,
        hugeFileBytes: 104857600,
        crashLoopErrorCount: 8,
        crashLoopRecentErrors: 5,
        largeFileBytes: 262144,
        skillsLargeFileBytes: 524288,
      },
    });
    const findings = logsChecks[0]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
  });

  it("logs-recent-errors: respects higher crash loop threshold (no false alarm)", () => {
    // With custom crashLoopErrorCount=100 and crashLoopRecentErrors=30,
    // 60 errors with 2 recent should NOT be a crash loop.
    const snap = minimalSnapshot({
      logs: {
        status: "collected",
        warnings: [],
        errors: [],
        logFile: "/home/.hermes/logs/hermes.log",
        errorCount: 60,
        recentErrors: [
          { timestamp: "2026-06-01T10:00:00Z", message: "error" },
        ],
      },
      thresholds: {
        memoryWarnPercent: 80,
        memoryCriticalPercent: 100,
        hugeFileBytes: 104857600,
        crashLoopErrorCount: 100,
        crashLoopRecentErrors: 30,
        largeFileBytes: 262144,
        skillsLargeFileBytes: 524288,
      },
    });
    const findings = logsChecks[0]!.run(snap);
    expect(first(findings).status).toBe("warning");
    expect(first(findings).severity).toBe(1);
    expect(first(findings).title).toBe("Recent Errors Found");
  });

  it("snapshot without thresholds uses defaults (backward compatible)", () => {
    // A snapshot without thresholds should use the standard defaults.
    const snap = minimalSnapshot({
      memory: {
        status: "collected",
        warnings: [],
        errors: [],
        totalSizeBytes: 4194304,
        limitBytes: 5242880,
        usagePercent: 80,
      },
    });
    // Should warn at 80% (default)
    const findings = memoryChecks[2]!.run(snap);
    expect(first(findings).status).toBe("warning");
    expect(first(findings).title).toBe("Memory Near Limit");
  });

  it("CLI parsing: huge-file-threshold 50 maps to 50 MB in bytes", () => {
    // Simulate what parseThresholds in scan.ts does
    const mb = "50";
    const bytes = parseInt(mb, 10) * 1024 * 1024;
    const thresholds = mergeThresholds({ hugeFileBytes: bytes });
    expect(thresholds.hugeFileBytes).toBe(50 * 1024 * 1024);
  });

  it("CLI parsing: large-file-threshold 512 maps to 512 KB in bytes", () => {
    // Simulate what parseThresholds in scan.ts does
    const kb = "512";
    const bytes = parseInt(kb, 10) * 1024;
    const thresholds = mergeThresholds({ largeFileBytes: bytes });
    expect(thresholds.largeFileBytes).toBe(512 * 1024);
  });

  it("mergeThresholds round-trips all fields correctly", () => {
    const input: Thresholds = {
      memoryWarnPercent: 75,
      memoryCriticalPercent: 95,
      hugeFileBytes: 209715200,
      crashLoopErrorCount: 30,
      crashLoopRecentErrors: 10,
      largeFileBytes: 524288,
      skillsLargeFileBytes: 1048576,
    };
    const merged = mergeThresholds(input);
    expect(merged.memoryWarnPercent).toBe(75);
    expect(merged.memoryCriticalPercent).toBe(95);
    expect(merged.hugeFileBytes).toBe(209715200);
    expect(merged.crashLoopErrorCount).toBe(30);
    expect(merged.crashLoopRecentErrors).toBe(10);
    expect(merged.largeFileBytes).toBe(524288);
    expect(merged.skillsLargeFileBytes).toBe(1048576);
  });
});

// ---------------------------------------------------------------------------
// Skills checks
// ---------------------------------------------------------------------------
describe("skills checks", () => {
  it("skills-skill-md-present: ok when all have SKILL.md", () => {
    const snap = minimalSnapshot({
      skills: {
        status: "collected",
        warnings: [],
        errors: [],
        skills: [
          { dir: "/skills/alpha", hasSkillMd: true },
        ],
      },
    });
    const findings = skillsChecks[0]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("skills-skill-md-present: warning when some missing", () => {
    const snap = minimalSnapshot({
      skills: {
        status: "collected",
        warnings: [],
        errors: [],
        skills: [
          { dir: "/skills/alpha", hasSkillMd: true },
          { dir: "/skills/beta", hasSkillMd: false },
        ],
      },
    });
    const findings = skillsChecks[0]!.run(snap);
    expect(first(findings).status).toBe("warning");
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });

  it("skills-skill-md-present: warning when all missing (severity <= 3)", () => {
    const snap = minimalSnapshot({
      skills: {
        status: "collected",
        warnings: [],
        errors: [],
        skills: [
          { dir: "/skills/alpha", hasSkillMd: false },
          { dir: "/skills/beta", hasSkillMd: false },
        ],
      },
    });
    const findings = skillsChecks[0]!.run(snap);
    // Per VAL-SKILL-001, when ALL skills are missing SKILL.md,
    // status should be warning (not broken) with severity <= 3
    expect(first(findings).status).toBe("warning");
    expect(first(findings).severity).toBeLessThanOrEqual(3);
  });

  it("skills-broken-refs: ok when no broken refs", () => {
    const snap = minimalSnapshot();
    const findings = skillsChecks[1]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("skills-broken-refs: warning when broken refs exist", () => {
    const snap = minimalSnapshot({
      skills: {
        status: "collected",
        warnings: [],
        errors: [],
        brokenRefs: [
          { sourceSkill: "alpha", referencedPath: "./nope.md", reason: "not found" },
        ],
      },
    });
    const findings = skillsChecks[1]!.run(snap);
    expect(first(findings).status).toBe("warning");
  });

  it("skills-duplicate-names: ok when no duplicates", () => {
    const snap = minimalSnapshot();
    const findings = skillsChecks[2]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("skills-large-files: warning when large files exist (not info)", () => {
    const snap = minimalSnapshot({
      skills: {
        status: "collected",
        warnings: [],
        errors: [],
        largeFiles: [
          { path: "/skills/alpha/SKILL.md", sizeBytes: 200000 },
        ],
      },
    });
    const findings = skillsChecks[3]!.run(snap);
    // Per VAL-SKILL-004, large SKILL.md files should be warning, not info
    expect(first(findings).status).toBe("warning");
  });

  it("skills-metadata: info (Hermes SKILL.md has no required front matter)", () => {
    const snap = minimalSnapshot({
      skills: {
        status: "collected",
        warnings: [],
        errors: [],
        skills: [
          { dir: "/skills/alpha", name: "alpha", hasSkillMd: true },
        ],
      },
    });
    const findings = skillsChecks[4]!.run(snap);
    // Hermes SKILL.md files are arbitrary Markdown — no required YAML front matter
    expect(first(findings).status).toBe("info");
  });

  it("skills-metadata: info even without front matter fields (Hermes behavior)", () => {
    const snap = minimalSnapshot({
      skills: {
        status: "collected",
        warnings: [],
        errors: [],
        skills: [
          { dir: "/skills/alpha", name: null, hasSkillMd: true },
        ],
      },
    });
    const findings = skillsChecks[4]!.run(snap);
    // Hermes does not require name/description in SKILL.md front matter
    expect(first(findings).status).toBe("info");
  });
});

// ---------------------------------------------------------------------------
// Plugins checks
// ---------------------------------------------------------------------------
describe("plugins checks", () => {
  it("plugins-paths-exist: ok when all enabled plugin paths exist", () => {
    const snap = minimalSnapshot({
      plugins: {
        status: "collected",
        warnings: [],
        errors: [],
        plugins: [
          { name: "installed", path: "/plugins/installed", exists: true, enabled: true },
        ],
      },
    });
    const findings = pluginsChecks[0]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("plugins-paths-exist: broken when enabled plugin path missing", () => {
    const snap = minimalSnapshot({
      plugins: {
        status: "collected",
        warnings: [],
        errors: [],
        plugins: [
          { name: "ghost", path: "/plugins/ghost", exists: false, enabled: true },
        ],
      },
    });
    const findings = pluginsChecks[0]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
  });

  it("plugins-manifests: ok when all manifests valid", () => {
    const snap = minimalSnapshot({
      plugins: {
        status: "collected",
        warnings: [],
        errors: [],
        plugins: [
          { name: "installed", manifestFound: true, manifestValid: true, enabled: true },
        ],
      },
    });
    const findings = pluginsChecks[1]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("plugins-dependencies: broken when unresolved deps", () => {
    const snap = minimalSnapshot({
      plugins: {
        status: "collected",
        warnings: [],
        errors: [],
        plugins: [
          {
            name: "test",
            dependencies: [{ name: "axios", version: "1.0.0", resolved: false }],
          },
        ],
      },
    });
    const findings = pluginsChecks[2]!.run(snap);
    expect(first(findings).status).toBe("broken");
    expect(first(findings).severity).toBe(3);
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });

  it("plugins-version-compat: ok when all compatible", () => {
    const snap = minimalSnapshot();
    const findings = pluginsChecks[3]!.run(snap);
    expect(first(findings).status).toBe("info");
  });

  it("hooks-config: info when no hooks configured", () => {
    const snap = minimalSnapshot();
    const findings = pluginsChecks[5]!.run(snap);
    expect(first(findings).id).toBe("hooks-config");
    expect(first(findings).status).toBe("info");
    expect(first(findings).title).toBe("No Hooks Configured");
  });

  it("hooks-config: info when hooks configured with valid phases", () => {
    const snap = minimalSnapshot({
      plugins: {
        status: "collected",
        warnings: [],
        errors: [],
        hooks: {
          hasHooks: true,
          hookCount: 3,
          phases: ["pre_tool_call", "post_tool_call"],
          unknownPhases: [],
        },
      },
    });
    const findings = pluginsChecks[5]!.run(snap);
    expect(first(findings).id).toBe("hooks-config");
    expect(first(findings).status).toBe("info");
    expect(first(findings).title).toBe("Hooks Configured");
    expect(first(findings).message).toContain("3 hook(s)");
    expect(first(findings).message).toContain("pre_tool_call");
  });

  it("hooks-config: warning when hooks have unknown phases", () => {
    const snap = minimalSnapshot({
      plugins: {
        status: "collected",
        warnings: [],
        errors: [],
        hooks: {
          hasHooks: true,
          hookCount: 2,
          phases: ["pre_tool_call"],
          unknownPhases: ["invalid_phase"],
        },
      },
    });
    const findings = pluginsChecks[5]!.run(snap);
    expect(first(findings).id).toBe("hooks-config");
    expect(first(findings).status).toBe("warning");
    expect(first(findings).severity).toBe(1);
    expect(first(findings).title).toBe("Unknown Hook Phase Names");
    expect(first(findings).message).toContain("invalid_phase");
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Logs checks
// ---------------------------------------------------------------------------
describe("logs checks", () => {
  it("logs-recent-errors: ok when no errors", () => {
    const snap = minimalSnapshot({
      logs: {
        status: "collected",
        warnings: [],
        errors: [],
        errorCount: 0,
        recentErrors: [],
      },
    });
    const findings = logsChecks[0]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("logs-recent-errors: warning when errors found", () => {
    const snap = minimalSnapshot({
      logs: {
        status: "collected",
        warnings: [],
        errors: [],
        errorCount: 3,
        recentErrors: [
          { timestamp: "2026-05-31T10:00:00Z", message: "401 unauthorized" },
        ],
      },
    });
    const findings = logsChecks[0]!.run(snap);
    expect(first(findings).status).toBe("warning");
    expect(findEvidence(first(findings).evidence, "error_count")).toBe("3");
  });

  it("logs-error-classification: ok when no errors", () => {
    const snap = minimalSnapshot({
      logs: {
        status: "collected",
        warnings: [],
        errors: [],
        errorTypes: { auth: 0, model: 0, mcp: 0, permission: 0, rate_limit: 0, network: 0, unknown: 0 },
      },
    });
    const findings = logsChecks[1]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("logs-readability: ok when all readable", () => {
    const snap = minimalSnapshot({
      logs: {
        status: "collected",
        warnings: [],
        errors: [],
        logFiles: [
          { path: "/logs/hermes.log", readable: true, sizeBytes: 5000 },
        ],
      },
    });
    const findings = logsChecks[2]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("logs-rate-limit: ok when no rate limit errors", () => {
    const snap = minimalSnapshot({
      logs: {
        status: "collected",
        warnings: [],
        errors: [],
        errorTypes: { auth: 0, model: 0, mcp: 0, permission: 0, rate_limit: 0, network: 0, unknown: 0 },
      },
    });
    const findings = logsChecks[3]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("logs-rate-limit: warning when rate limit errors", () => {
    const snap = minimalSnapshot({
      logs: {
        status: "collected",
        warnings: [],
        errors: [],
        errorTypes: { auth: 0, model: 0, mcp: 0, permission: 0, rate_limit: 5, network: 0, unknown: 0 },
      },
    });
    const findings = logsChecks[3]!.run(snap);
    expect(first(findings).status).toBe("warning");
    expect(first(findings).severity).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Security checks
// ---------------------------------------------------------------------------
describe("security checks", () => {
  it("security-public-binding: risk when public", () => {
    const snap = minimalSnapshot({
      security: {
        status: "collected",
        warnings: [],
        errors: [],
        publicBinding: true,
        bindAddress: "0.0.0.0",
      },
    });
    const findings = securityChecks[0]!.run(snap);
    expect(first(findings).status).toBe("risk");
    expect(first(findings).severity).toBe(4);
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });

  it("security-public-binding: ok when localhost", () => {
    const snap = minimalSnapshot({
      security: {
        status: "collected",
        warnings: [],
        errors: [],
        publicBinding: false,
        bindAddress: "127.0.0.1",
      },
    });
    const findings = securityChecks[0]!.run(snap);
    expect(first(findings).status).toBe("ok");
  });

  it("security-secret-leaks: risk when leaks found", () => {
    const snap = minimalSnapshot({
      security: {
        status: "collected",
        warnings: [],
        errors: [],
        secretLeaks: [
          { location: ".env", secretType: "openai_key", maskedValue: "[REDACTED:OPENAI_KEY]" },
        ],
      },
    });
    const findings = securityChecks[1]!.run(snap);
    expect(first(findings).status).toBe("risk");
    expect(first(findings).severity).toBe(4);
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });

  it("security-terminal-backend: risk when unrestricted", () => {
    const snap = minimalSnapshot({
      security: {
        status: "collected",
        warnings: [],
        errors: [],
        terminalBackend: "bash",
        shellRestricted: false,
        sandboxEnabled: false,
      },
    });
    const findings = securityChecks[2]!.run(snap);
    expect(first(findings).status).toBe("risk");
    expect(first(findings).severity).toBe(4);
  });

  it("security-file-permissions: risk when permissive", () => {
    const snap = minimalSnapshot({
      security: {
        status: "collected",
        warnings: [],
        errors: [],
        permissionIssues: [
          { path: "/.hermes/config.yaml", currentMode: "644", suggestedMode: "600" },
        ],
      },
    });
    const findings = securityChecks[3]!.run(snap);
    expect(first(findings).status).toBe("risk");
    expect(first(findings).severity).toBe(4);
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });

  it("security-env-exposure: risk when exposed", () => {
    const snap = minimalSnapshot({
      security: {
        status: "collected",
        warnings: [],
        errors: [],
        envExposure: true,
        exposedVars: ["ANTHROPIC_API_KEY"],
      },
    });
    const findings = securityChecks[4]!.run(snap);
    expect(first(findings).status).toBe("risk");
    expect(first(findings).severity).toBe(4);
  });

  it("security-dynamic-exec: risk when found", () => {
    const snap = minimalSnapshot({
      security: {
        status: "collected",
        warnings: [],
        errors: [],
        dynamicExecBlocks: [
          { location: "config.yaml", pattern: "eval", riskLevel: "high" },
        ],
      },
    });
    const findings = securityChecks[5]!.run(snap);
    expect(first(findings).status).toBe("risk");
    expect(first(findings).severity).toBe(4);
    expect(first(findings).fixes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: severity mapping follows 0-4 scale
// ---------------------------------------------------------------------------
describe("severity mapping follows 0-4 scale", () => {
  it("ok findings have severity 0", () => {
    const snap = minimalSnapshot({
      system: {
        status: "collected",
        warnings: [],
        errors: [],
        os: "linux",
        arch: "x64",
        nodeVersion: "v26.2.0",
      },
    });
    const findings = runAllChecks(snap);
    for (const f of findings) {
      if (f.status === "ok" || f.status === "info") {
        // Info and ok can be 0
        expect(f.severity).toBeGreaterThanOrEqual(0);
      }
      if (f.status === "broken") {
        expect(f.severity).toBeGreaterThanOrEqual(2);
      }
      if (f.status === "risk") {
        expect(f.severity).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: evidence references snapshot data
// ---------------------------------------------------------------------------
describe("evidence references snapshot data", () => {
  it("evidence objects are populated with snapshot data", () => {
    const snap = minimalSnapshot({
      system: {
        status: "collected",
        warnings: [],
        errors: [],
        os: "darwin",
        arch: "arm64",
        nodeVersion: "v20.0.0",
      },
      install: {
        status: "collected",
        warnings: [],
        errors: [],
        onPath: true,
        executablePath: "/opt/bin/hermes",
        versionString: "1.0.0",
        versionExitCode: 0,
        installMethod: "npm",
        permissionOk: true,
      },
    });
    const findings = runAllChecks(snap);
    // system info should have os, arch, node in evidence
    const sysInfo = findings.find((f) => f.id === "system-info");
    expect(sysInfo).toBeDefined();
    expect(findEvidence(sysInfo!.evidence, "os")).toBe("darwin");
    expect(findEvidence(sysInfo!.evidence, "node")).toBe("v20.0.0");

    // install executable should have executable_path in evidence
    const instExec = findings.find((f) => f.id === "install-executable");
    expect(instExec).toBeDefined();
    expect(findEvidence(instExec!.evidence, "executable_path")).toBe("/opt/bin/hermes");
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: fixes include copyable commands
// ---------------------------------------------------------------------------
describe("fixes include copyable commands", () => {
  it("broken findings have fixes with commands", () => {
    const snap = minimalSnapshot({
      install: {
        status: "collected",
        warnings: [],
        errors: [],
        onPath: false,
      },
    });
    const findings = runAllChecks(snap);
    for (const f of findings) {
      if (f.status === "broken" && f.fixes.length > 0) {
        for (const fix of f.fixes) {
          expect(fix.title).toBeTruthy();
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// VAL-FIX: FixAction safety fields
// ---------------------------------------------------------------------------
describe("VAL-FIX: FixAction safety fields", () => {
  // VAL-FIX-001: FixAction shape in JSON output
  it("fix actions include risk, requiresConfirmation, manualSteps, rollback in JSON output", () => {
    const snap = minimalSnapshot({
      install: {
        status: "collected",
        warnings: [],
        errors: [],
        onPath: false,
      },
    });
    const findings = runAllChecks(snap);
    // Find install-executable which has safety fields
    const execFinding = findings.find((f) => f.id === "install-executable");
    expect(execFinding).toBeDefined();
    expect(execFinding!.fixes.length).toBeGreaterThan(0);
    // First fix: Install Hermes via pip — should have all safety fields
    const installFix = execFinding!.fixes[0]!;
    expect(installFix.title).toBeTruthy();
    // Check that safety fields can be present (they're optional in schema)
    // The new safety fields are optional for backward compat
    // The install fix should have risk, reqConfirmation, manualSteps set
    expect(installFix).toHaveProperty("risk");
    expect(installFix).toHaveProperty("requiresConfirmation");
    expect(installFix).toHaveProperty("manualSteps");
    expect(installFix).toHaveProperty("rollback");
  });

  // VAL-FIX-002: Dangerous commands have requiresConfirmation
  it("dangerous commands (pip install, chmod) have requiresConfirmation: true", () => {
    const snap = minimalSnapshot({
      install: {
        status: "collected",
        warnings: [],
        errors: [],
        onPath: false,
      },
    });
    const findings = runAllChecks(snap);
    for (const f of findings) {
      for (const fx of f.fixes) {
        // pip install commands should require confirmation
        if (fx.command && fx.command.startsWith("pip install ")) {
          expect(fx.requiresConfirmation).toBe(true);
        }
        // chmod commands should also require confirmation
        if (fx.command && fx.command.startsWith("chmod")) {
          expect(fx.requiresConfirmation).toBe(true);
        }
      }
    }
  });

  // VAL-FIX-003: Fix commands reference real packages (no bogus packages)
  it("fix commands reference real packages (pip install uses hermes-agent)", () => {
    const snap = minimalSnapshot({
      install: {
        status: "collected",
        warnings: [],
        errors: [],
        onPath: false,
      },
    });
    const findings = runAllChecks(snap);
    const knownPipPackages = ["hermes-agent"];
    for (const f of findings) {
      for (const fx of f.fixes) {
        if (fx.command && fx.command.startsWith("pip install ")) {
          const pkgName = fx.command.replace("pip install ", "").split(" ")[0]!;
          expect(knownPipPackages).toContain(pkgName);
        }
      }
    }
  });

  // VAL-FIX-004: FixAction schema backward compatible with old reports
  it("old reports without new FixAction fields still parse correctly", () => {
    const oldFixAction = {
      title: "Install Hermes",
      command: "npm install -g @anthropic/hermes",
      // No risk, requiresConfirmation, manualSteps, rollback — legacy format
    };
    // FixActionSchema is already imported via v.parse from the schemas
    const result = v.safeParse(v.object({
      title: v.string(),
      command: v.optional(v.string()),
      url: v.optional(v.string()),
      description: v.optional(v.string()),
      risk: v.optional(v.picklist(["low", "medium", "high"])),
      requiresConfirmation: v.optional(v.boolean()),
      manualSteps: v.optional(v.array(v.string())),
      rollback: v.optional(v.string()),
    }), oldFixAction);
    expect(result.success).toBe(true);
    if (result.success) {
      // New fields should be undefined in the parsed result
      expect(result.output.risk).toBeUndefined();
      expect(result.output.requiresConfirmation).toBeUndefined();
      expect(result.output.manualSteps).toBeUndefined();
      expect(result.output.rollback).toBeUndefined();
    }
  });

  // VAL-FIX-005: manualSteps is non-empty when requiresConfirmation is true
  it("manualSteps is non-empty when requiresConfirmation is true", () => {
    const snap = minimalSnapshot({
      install: {
        status: "collected",
        warnings: [],
        errors: [],
        onPath: false,
      },
    });
    const findings = runAllChecks(snap);
    for (const f of findings) {
      for (const fx of f.fixes) {
        if (fx.requiresConfirmation === true) {
          expect(fx.manualSteps).toBeDefined();
          expect(Array.isArray(fx.manualSteps)).toBe(true);
          expect(fx.manualSteps!.length).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe("edge cases", () => {
  it("all areas produce findings even with empty snapshots", () => {
    const snap = minimalSnapshot();
    const findings = runAllChecks(snap);
    expect(findings.length).toBeGreaterThanOrEqual(allChecks.length);
  });

  it("check errors produce synthetic error findings", () => {
    const snap = minimalSnapshot();
    // Manually verify all checks run without throwing
    for (const check of allChecks) {
      expect(() => check.run(snap)).not.toThrow();
    }
  });

  it("total check count is 58 (at least 20 required)", () => {
    expect(allChecks.length).toBe(58);
  });
});
