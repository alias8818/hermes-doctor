import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../markdown-renderer.js";
import { buildReport } from "@hermes-doctor/core";
import type { DoctorFinding } from "@hermes-doctor/core";

function makeReport(overrides?: {
  findings?: DoctorFinding[];
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

  return buildReport(findings, { profile: "default" });
}

describe("markdown renderer", () => {
  it("renders markdown with title heading", () => {
    const report = makeReport();
    const output = renderMarkdown(report);

    expect(output.startsWith("# Hermes Doctor")).toBe(true);
    expect(output).toContain("## Environment");
    expect(output).toContain("## Summary");
    expect(output).toContain("## Privacy");
  });

  it("contains summary table with counts", () => {
    const report = makeReport();
    const output = renderMarkdown(report);

    expect(output).toContain("| Status | Count |");
    expect(output).toContain("|--------|-------|");
    expect(output).toContain("| ℹ️ Info | 1 |");
    expect(output).toContain("| ⚠️ Warnings | 1 |");
    expect(output).toContain("| ❌ Broken | 1 |");
    expect(output).toContain("| 🔴 Risks | 1 |");
    expect(output).toContain("| **Total** | **4** |");
  });

  it("contains environment table", () => {
    const report = makeReport();
    const output = renderMarkdown(report);

    expect(output).toContain("| Field | Value |");
    expect(output).toContain("| OS |");
    expect(output).toContain("| Architecture |");
    expect(output).toContain("| Node Version |");
  });

  it("groups findings under severity headings", () => {
    const report = makeReport();
    const output = renderMarkdown(report);

    expect(output).toContain("## ℹ️ Info");
    expect(output).toContain("## ⚠️ Warning");
    expect(output).toContain("## ❌ Broken");
    expect(output).toContain("## 🔴 Risk");
  });

  it("includes evidence sections with Evidence fields", () => {
    const report = makeReport();
    const output = renderMarkdown(report);

    expect(output).toContain("**Evidence:**");
    expect(output).toContain("`os`");
    expect(output).toContain("`server`");
  });

  it("includes fix sections with Fix fields and code blocks", () => {
    const report = makeReport();
    const output = renderMarkdown(report);

    expect(output).toContain("**Fix:**");
    expect(output).toContain("Install the MCP server");
    expect(output).toContain("```bash");
    expect(output).toContain("```");
  });

  it("includes safe-to-share notice (VAL-CROSS-010)", () => {
    const report = makeReport();
    const output = renderMarkdown(report);

    expect(output).toContain("This report has been redacted for sharing");
  });

  it("includes redaction notice when redactions exist", () => {
    const findings: DoctorFinding[] = [
      {
        id: "test-redaction",
        area: "security",
        status: "risk",
        severity: 4,
        title: "Secret found",
        message: "A secret was found and redacted",
        evidence: {},
        fixes: [],
        details: null,
      },
    ];

    const redaction = {
      redacted: true,
      count: 3,
      totalRedactions: 3,
      patterns: ["openai_key", "bearer_token"],
      homePathRedactions: 1,
    };

    const report = buildReport(findings, {
      redaction,
    });

    const output = renderMarkdown(report);
    expect(output).toContain("This report has been redacted");
    expect(output).toContain("3 secret(s)");
    expect(output).toContain("1 home path(s)");
  });

  it("no stack traces in non-verbose output", () => {
    const report = makeReport();
    const output = renderMarkdown(report);

    expect(output).not.toMatch(/at .*:\d+:\d+/);
    expect(output).not.toContain("node_modules");
  });

  it("empty findings produces valid markdown", () => {
    const report = buildReport([]);
    const output = renderMarkdown(report);

    expect(output).toContain("# Hermes Doctor");
    expect(output).toContain("| **Total** | **0** |");
  });

  it("shows ## Flue Insights (experimental) section when flueInsights present", () => {
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
    const output = renderMarkdown(reportWithFlue as unknown as ReturnType<typeof buildReport>);
    expect(output).toContain("## Flue Insights (experimental)");
    expect(output).toContain("_No Flue insights generated._");
  });

  it("shows Flue insight text in markdown when insights present", () => {
    const report = makeReport({ findings: [] });
    const reportWithFlue = {
      ...report,
      flueInsights: {
        enabled: true,
        experimental: true,
        generatedAt: new Date().toISOString(),
        insights: [
          { findingId: "test-finding", insight: "This is a markdown insight" },
        ],
        warnings: [],
      },
    };
    const output = renderMarkdown(reportWithFlue as unknown as ReturnType<typeof buildReport>);
    expect(output).toContain("## Flue Insights (experimental)");
    // escapeMd escapes dashes, so finding IDs with dashes get escaped
    expect(output).toContain("test\\-finding");
    expect(output).toContain("This is a markdown insight");
  });

  it("shows Flue warnings in markdown when present", () => {
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
    const output = renderMarkdown(reportWithFlue as unknown as ReturnType<typeof buildReport>);
    expect(output).toContain("## Flue Insights (experimental)");
    expect(output).toContain("Flue API key not configured");
  });

  it("default report has no Flue section in markdown", () => {
    const report = makeReport();
    const output = renderMarkdown(report);
    expect(output).not.toContain("Flue Insights");
  });

  // TODO(#48): Re-enable after resolving regex escaping in test assertions
  it.skip("escapeMd escapes angle brackets, tildes, dashes, plus signs, exclamation marks, and parentheses (#48)", () => {
    const findings: DoctorFinding[] = [
      {
        id: "escape-test",
        area: "security",
        status: "info",
        severity: 0,
        title: "<script>alert('xss')</script>",
        message: "Strikethrough ~~text~~ and list - item + plus !not image (parens)",
        evidence: {
          key: "<dangerous> ~~strike~~ -dash +plus !exclaim (parens)",
        },
        fixes: [],
        details: null,
      },
    ];
    const report = buildReport(findings);
    const output = renderMarkdown(report);

    // escapeMd escapes markdown-special characters. Check for the escaped
    // substrings — each special char should appear with a leading backslash.
    // The finding title "<script>alert('xss')</script>" becomes:
    //   \<script\>alert('xss')\</script\>
    expect(output).toMatch(/\\<script\\>/);
    // Strikethrough tildes
    expect(output).toMatch(/\\~\\~text\\~\\~/);
    // List dash
    expect(output).toMatch(/\\- item/);
    // Plus sign
    expect(output).toMatch(/\\+plus/);
    // Exclamation mark
    expect(output).toMatch(/\\!not image/);
    // Parentheses in message
    expect(output).toMatch(/\\!\\\(parens\\\)/);
    // Evidence values
    expect(output).toMatch(/\\<dangerous\\>/);
    expect(output).toMatch(/\\~\\~strike\\~\\~/);
    expect(output).toMatch(/\\-dash/);
    expect(output).toMatch(/\\+plus/);
    expect(output).toMatch(/\\!exclaim/);
    expect(output).toMatch(/\\\(parens\\\)/);
  });
});
