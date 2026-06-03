import { describe, expect, it } from "vitest";

import { renderConsole } from "../console-renderer.js";
import { buildReport } from "@hermes-doctor/core";
import type { DoctorFinding } from "@hermes-doctor/core";

function makeReport(overrides?: {
  findings?: DoctorFinding[];
  profile?: string;
}): ReturnType<typeof buildReport> {
  const findings: DoctorFinding[] = overrides?.findings ?? [
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
      id: "mcp-command-missing",
      area: "mcp",
      status: "broken",
      severity: 3,
      title: "MCP command not found",
      message: "Command bogus is not available on PATH",
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
      id: "dashboard-public",
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
  ];

  return buildReport(findings, { profile: overrides?.profile ?? "default" });
}

describe("console renderer", () => {
  it("renders summary with severity section headings", () => {
    const report = makeReport();
    const output = renderConsole(report);

    expect(output).toContain("Summary");
    expect(output).toMatch(/1\s+Info/);
    expect(output).toMatch(/1\s+Warnings/);
    expect(output).toMatch(/1\s+Broken/);
    expect(output).toMatch(/1\s+Risks/);
    expect(output).toContain("Total: 4");
  });

  it("includes finding titles and messages", () => {
    const report = makeReport();
    const output = renderConsole(report);

    expect(output).toContain("System Information");
    expect(output).toContain("MCP command not found");
    expect(output).toContain("Dashboard publicly bound");
    expect(output).toContain("Recent errors found");
  });

  it("includes Evidence: sections", () => {
    const report = makeReport();
    const output = renderConsole(report);

    expect(output).toContain("Evidence:");
    expect(output).toContain("os");
    expect(output).toContain("public_binding");
  });

  it("includes Fix: sections", () => {
    const report = makeReport();
    const output = renderConsole(report);

    expect(output).toContain("Fix:");
    expect(output).toContain("Install the MCP server");
  });

  it('includes "redacted for sharing" note', () => {
    const report = makeReport();
    const output = renderConsole(report);

    expect(output).toContain("redacted for sharing");
  });

  it("uses colored status indicators when FORCE_COLOR is set", () => {
    process.env.FORCE_COLOR = "1";
    const report = makeReport();
    const output = renderConsole(report);

    expect(output).toContain("\x1b[32m");
    expect(output).toContain("\x1b[33m");
    expect(output).toContain("\x1b[31m");

    delete process.env.FORCE_COLOR;
  });

  it("no stack traces in non-verbose output (VAL-REPORT-007)", () => {
    const report = makeReport();
    const output = renderConsole(report);

    expect(output).not.toMatch(/at .*:\d+:\d+/);
    expect(output).not.toContain("node_modules");
  });

  it("zero findings shows summary with zeros", () => {
    const report = buildReport([]);
    const output = renderConsole(report);

    expect(output).toContain("Summary");
    expect(output).toContain("Total: 0");
  });

  it("shows Flue Insights (experimental) section when flueInsights present", () => {
    const report = makeReport({ findings: [] });
    const reportWithFlue = {
      ...report,
      flueInsights: {
        enabled: true,
        experimental: true,
        generatedAt: new Date().toISOString(),
        insights: [],
        warnings: [],
      },
    };
    const output = renderConsole(reportWithFlue as unknown as ReturnType<typeof buildReport>);
    expect(output).toContain("Flue Insights (experimental)");
    expect(output).toContain("No Flue insights generated.");
  });

  it("shows Flue insight text when insights present", () => {
    const report = makeReport({ findings: [] });
    const reportWithFlue = {
      ...report,
      flueInsights: {
        enabled: true,
        experimental: true,
        generatedAt: new Date().toISOString(),
        insights: [
          { findingId: "test-finding", insight: "This is an AI insight" },
        ],
        warnings: [],
      },
    };
    const output = renderConsole(reportWithFlue as unknown as ReturnType<typeof buildReport>);
    expect(output).toContain("Flue Insights (experimental)");
    expect(output).toContain("test-finding");
    expect(output).toContain("This is an AI insight");
  });

  it("shows Flue warnings when present", () => {
    const report = makeReport({ findings: [] });
    const reportWithFlue = {
      ...report,
      flueInsights: {
        enabled: true,
        experimental: true,
        generatedAt: new Date().toISOString(),
        insights: [],
        warnings: ["Flue API key not configured"],
      },
    };
    const output = renderConsole(reportWithFlue as unknown as ReturnType<typeof buildReport>);
    expect(output).toContain("Flue Insights (experimental)");
    expect(output).toContain("Flue API key not configured");
  });

  it("default report has no Flue section", () => {
    const report = makeReport();
    const output = renderConsole(report);
    expect(output).not.toContain("Flue Insights");
  });

  it("strips ANSI escape sequences from evidence values (#34)", () => {
    const findings: DoctorFinding[] = [
      {
        id: "ansi-test",
        area: "security",
        status: "warning",
        severity: 2,
        title: "Test \x1b[31mRed Title\x1b[0m",
        message: "Message with \x1b[32mgreen\x1b[0m text",
        evidence: {
          key1: "value with \x1b[31mred\x1b[0m text",
          key2: "normal value",
        },
        fixes: [],
        details: "Details with \x1b[33myellow\x1b[0m text",
      },
    ];
    const report = buildReport(findings);
    const output = renderConsole(report);

    // ANSI sequences should be stripped from title, message, details and evidence
    expect(output).toContain("Test Red Title");
    expect(output).not.toContain("\x1b[31m");
    expect(output).toContain("Message with green text");
    expect(output).toContain("value with red text");
    expect(output).toContain("normal value");
    expect(output).toContain("Details with yellow text");
  });

  it("strips ANSI from array evidence label and detail (#34)", () => {
    const findings: DoctorFinding[] = [
      {
        id: "ansi-array",
        area: "security",
        status: "info",
        severity: 0,
        title: "Array evidence",
        message: "test",
        evidence: [
          { label: "\x1b[31mlabel\x1b[0m", detail: "\x1b[32mdetail\x1b[0m", source: "test" },
        ],
        fixes: [],
        details: null,
      },
    ];
    const report = buildReport(findings);
    const output = renderConsole(report);

    expect(output).toContain("label");
    expect(output).toContain("detail");
    expect(output).not.toContain("\x1b[31m");
    expect(output).not.toContain("\x1b[32m");
  });
});
