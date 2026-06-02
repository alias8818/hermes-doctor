import { describe, expect, it } from "vitest";

import { buildReport } from "../builder.js";
import type { DoctorFinding } from "../../schemas/report.js";
import * as v from "valibot";
import { DoctorReportSchema } from "../../schemas/report.js";
import { createRedactionSummary } from "../../redaction/redact.js";

function makeFindings(): DoctorFinding[] {
  return [
    {
      id: "system-info",
      area: "system",
      status: "info",
      severity: 0,
      title: "System Information",
      message: "OS: linux, Arch: x64, Node: v26.2.0",
      evidence: { os: "linux", arch: "x64", node: "v26.2.0" },
      fixes: [],
      details: null,
    },
    {
      id: "install-executable",
      area: "install",
      status: "ok",
      severity: 0,
      title: "Hermes executable found",
      message: "hermes is on PATH at /usr/bin/hermes",
      evidence: { executable_path: "/usr/bin/hermes", on_path: true },
      fixes: [],
      details: null,
    },
    {
      id: "mcp-command-missing",
      area: "mcp",
      status: "broken",
      severity: 3,
      title: "MCP command not found",
      message: "Command 'bogus' is not available on PATH",
      evidence: { server: "fs", command: "bogus", executable_found: false },
      fixes: [
        {
          title: "Install the MCP server",
          command: "pip install hermes-agent",
        },
      ],
      details: null,
    },
    {
      id: "dashboard-public-binding",
      area: "security",
      status: "risk",
      severity: 4,
      title: "Dashboard publicly bound",
      message: "Dashboard is bound to 0.0.0.0",
      evidence: { public_binding: true, bind_address: "0.0.0.0" },
      fixes: [
        {
          title: "Bind to localhost",
          command: "set HERMES_DASHBOARD_BIND=127.0.0.1",
        },
      ],
      details: null,
    },
    {
      id: "logs-warning",
      area: "logs",
      status: "warning",
      severity: 1,
      title: "Recent errors found",
      message: "3 errors in log file",
      evidence: { error_count: 3 },
      fixes: [],
      details: null,
    },
    {
      id: "unknown-finding",
      area: "config",
      status: "unknown",
      severity: 0,
      title: "Unknown status",
      message: "Something unexpected happened",
      evidence: {},
      fixes: [],
      details: null,
    },
    {
      id: "additional-info",
      area: "providers",
      status: "info",
      severity: 0,
      title: "Provider Info",
      message: "2 providers configured",
      evidence: { count: 2 },
      fixes: [],
      details: null,
    },
  ];
}

describe("buildReport", () => {
  it("produces a valid DoctorReport", () => {
    const findings = makeFindings();
    const report = buildReport(findings);

    // Should validate against schema
    const parsed = v.parse(DoctorReportSchema, report);
    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.findings.length).toBe(7);
  });

  it("computes summary counts correctly", () => {
    const findings = makeFindings();
    const report = buildReport(findings);

    expect(report.summary.ok).toBe(1);
    expect(report.summary.info).toBe(2);
    expect(report.summary.warnings).toBe(1);
    expect(report.summary.broken).toBe(1);
    expect(report.summary.risks).toBe(1);
    expect(report.summary.unknown).toBe(1);
    expect(report.summary.total).toBe(7);
  });

  it("summary counts satisfy ok + info + warnings + broken + risks + unknown = total", () => {
    const findings = makeFindings();
    const report = buildReport(findings);
    const s = report.summary;
    expect(s.ok + s.info + s.warnings + s.broken + s.risks + s.unknown).toBe(
      s.total,
    );
  });

  it("total equals findings array length", () => {
    const findings = makeFindings();
    const report = buildReport(findings);
    expect(report.summary.total).toBe(report.findings.length);
  });

  it("includes platform info", () => {
    const findings = makeFindings();
    const report = buildReport(findings);

    expect(report.platform.os).toBeTruthy();
    expect(report.platform.arch).toBeTruthy();
    expect(report.platform.nodeVersion).toBeTruthy();
  });

  it("includes profile from options", () => {
    const findings = makeFindings();
    const report = buildReport(findings, { profile: "work" });

    expect(report.profile).toBe("work");
  });

  it("includes hermesHome from options", () => {
    const findings = makeFindings();
    const report = buildReport(findings, {
      hermesHome: "<HOME>/.hermes",
    });

    expect(report.hermesHome).toBe("<HOME>/.hermes");
  });

  it("accepts redaction summary from options", () => {
    const findings = makeFindings();
    const redactionSummary = createRedactionSummary();
    redactionSummary.totalRedactions = 5;
    redactionSummary.patterns = ["openai_key"];
    redactionSummary.redacted = true;

    const report = buildReport(findings, { redaction: redactionSummary });

    expect(report.redaction.totalRedactions).toBe(5);
    expect(report.redaction.patterns).toContain("openai_key");
    expect(report.redaction.redacted).toBe(true);
  });

  it("defaults flueEnabled to false", () => {
    const findings = makeFindings();
    const report = buildReport(findings);

    expect(report.flueEnabled).toBe(false);
  });

  it("sets redactedForSharing to true", () => {
    const findings = makeFindings();
    const report = buildReport(findings);

    expect(report.redactedForSharing).toBe(true);
  });

  it("handles empty findings array", () => {
    const report = buildReport([]);

    expect(report.summary.ok).toBe(0);
    expect(report.summary.info).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.summary.broken).toBe(0);
    expect(report.summary.risks).toBe(0);
    expect(report.summary.unknown).toBe(0);
    expect(report.summary.total).toBe(0);
    expect(report.findings).toEqual([]);
  });

  it("generates a valid ISO 8601 timestamp", () => {
    const report = buildReport([]);
    const ts = new Date(report.generatedAt);
    expect(ts.toISOString()).toBe(report.generatedAt);
  });
});

describe("DoctorReport validation (VAL-REPORT-005)", () => {
  it("has required fields with correct types", () => {
    const findings = makeFindings();
    const report = buildReport(findings);

    expect(typeof report.schemaVersion).toBe("string");
    expect(report.schemaVersion.length).toBeGreaterThan(0);

    expect(typeof report.generatedAt).toBe("string");

    expect(typeof report.profile).toBe("string");

    expect(report.platform).toBeDefined();
    expect(typeof report.platform.os).toBe("string");
    expect(typeof report.platform.arch).toBe("string");
    expect(typeof report.platform.nodeVersion).toBe("string");

    expect(report.summary).toBeDefined();
    expect(typeof report.summary.ok).toBe("number");
    expect(typeof report.summary.info).toBe("number");
    expect(typeof report.summary.warnings).toBe("number");
    expect(typeof report.summary.broken).toBe("number");
    expect(typeof report.summary.risks).toBe("number");
    expect(typeof report.summary.unknown).toBe("number");
    expect(typeof report.summary.total).toBe("number");

    expect(Array.isArray(report.findings)).toBe(true);

    expect(report.redaction).toBeDefined();
    expect(typeof report.redaction.redacted).toBe("boolean");
    expect(typeof report.redaction.count).toBe("number");
  });

  it("findings array is present even when empty", () => {
    const report = buildReport([]);
    expect(report.findings).toEqual([]);
  });

  it("summary.total equals findings.length when empty", () => {
    const report = buildReport([]);
    expect(report.summary.total).toBe(0);
    expect(report.findings.length).toBe(0);
  });
});
