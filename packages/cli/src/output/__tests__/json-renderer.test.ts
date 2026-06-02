import { describe, expect, it } from "vitest";
import * as v from "valibot";

import { renderJson } from "../json-renderer.js";
import { buildReport, DoctorReportSchema } from "@hermes-doctor/core";
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
  ];

  return buildReport(findings);
}

describe("json renderer", () => {
  it("produces valid JSON that parses", () => {
    const report = makeReport();
    const json = renderJson(report);

    const parsed = JSON.parse(json);
    expect(parsed).toBeDefined();
    expect(parsed.schemaVersion).toBe("1.0");
  });

  it("validates against DoctorReport schema (VAL-REPORT-004)", () => {
    const report = makeReport();
    const json = renderJson(report);

    const parsed = JSON.parse(json);
    const validated = v.parse(DoctorReportSchema, parsed);
    expect(validated.schemaVersion).toBe("1.0");
  });

  it("contains all required fields (VAL-REPORT-005)", () => {
    const report = makeReport();
    const json = renderJson(report);
    const parsed = JSON.parse(json);

    expect(typeof parsed.schemaVersion).toBe("string");
    expect(typeof parsed.generatedAt).toBe("string");
    expect(typeof parsed.profile).toBe("string");
    expect(parsed.platform).toBeDefined();
    expect(typeof parsed.platform.os).toBe("string");
    expect(typeof parsed.platform.arch).toBe("string");
    expect(typeof parsed.platform.nodeVersion).toBe("string");
    expect(parsed.summary).toBeDefined();
    expect(typeof parsed.summary.ok).toBe("number");
    expect(typeof parsed.summary.info).toBe("number");
    expect(typeof parsed.summary.warnings).toBe("number");
    expect(typeof parsed.summary.broken).toBe("number");
    expect(typeof parsed.summary.risks).toBe("number");
    expect(typeof parsed.summary.unknown).toBe("number");
    expect(typeof parsed.summary.total).toBe("number");
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(parsed.redaction).toBeDefined();
    expect(typeof parsed.redaction.redacted).toBe("boolean");
    expect(typeof parsed.redaction.count).toBe("number");
  });

  it("summary counts are accurate (VAL-REPORT-006)", () => {
    const report = makeReport();
    const json = renderJson(report);
    const parsed = JSON.parse(json);

    const s = parsed.summary;
    expect(s.ok + s.info + s.warnings + s.broken + s.risks + s.unknown).toBe(
      s.total,
    );
    expect(s.total).toBe(parsed.findings.length);
  });

  it("no stack traces in non-verbose output", () => {
    const report = makeReport();
    const json = renderJson(report);
    const parsed = JSON.parse(json);

    expect(parsed.stack).toBeUndefined();
    expect(parsed.stackTrace).toBeUndefined();
  });

  it("empty findings produces valid JSON with zero counts", () => {
    const report = buildReport([]);
    const json = renderJson(report);
    const parsed = JSON.parse(json);

    expect(parsed.summary.ok).toBe(0);
    expect(parsed.summary.total).toBe(0);
    expect(parsed.findings).toEqual([]);
  });

  it("includes flueInsights in JSON when --flue is used", () => {
    const report = makeReport();
    const reportWithFlue = {
      ...report,
      flueEnabled: true,
      flueInsights: {
        enabled: true,
        experimental: true,
        generatedAt: new Date().toISOString(),
        insights: [
          { findingId: "test-finding", insight: "AI insight text" },
        ],
        warnings: [],
      },
    };
    const json = renderJson(reportWithFlue as unknown as ReturnType<typeof buildReport>);
    const parsed = JSON.parse(json);

    expect(parsed.flueInsights).toBeDefined();
    expect(parsed.flueInsights.enabled).toBe(true);
    expect(parsed.flueInsights.experimental).toBe(true);
    expect(parsed.flueInsights.insights).toHaveLength(1);
    expect(parsed.flueInsights.insights[0].findingId).toBe("test-finding");
    expect(parsed.flueInsights.insights[0].insight).toBe("AI insight text");
    expect(parsed.flueEnabled).toBe(true);
  });

  it("JSON output has no flueInsights by default", () => {
    const report = makeReport();
    const json = renderJson(report);
    const parsed = JSON.parse(json);

    expect(parsed.flueInsights).toBeUndefined();
    expect(parsed.flueEnabled).toBe(false);
  });
});
