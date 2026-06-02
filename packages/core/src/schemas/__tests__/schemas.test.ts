import { describe, expect, it } from "vitest";
import * as v from "valibot";

import {
  CollectorResultSchema,
  DoctorFindingSchema,
  DoctorReportSchema,
  EvidenceConfidenceSchema,
  EvidenceSchema,
  EvidenceSourceSchema,
  FINDING_AREAS,
  FindingAreaSchema,
  FixActionSchema,
  FlueInsightSchema,
  FlueInsightsSectionSchema,
  FlueResponseSchema,
  HermesSnapshotSchema,
  RedactionSummarySchema,
  SeveritySchema,
  SummarySchema,
  collectorResultSchema,
  normalizeEvidence,
  type CollectorResult,
  type DoctorReport,
  type HermesSnapshot,
} from "../index.js";

const AREA_KEYS = [
  "system",
  "install",
  "config",
  "dashboard",
  "providers",
  "mcp",
  "memory",
  "skills",
  "plugins",
  "logs",
  "security",
] as const;

function makeAreaStub() {
  return { status: "collected" as const, warnings: [], errors: [] };
}

function makeRedaction() {
  return {
    redacted: true,
    count: 0,
    totalRedactions: 0,
    patterns: [],
    homePathRedactions: 0,
  };
}

function makeSnapshot(): HermesSnapshot {
  return {
    schemaVersion: "1.0",
    collectedAt: new Date().toISOString(),
    profile: "default",
    hermesHome: "<HOME>/.hermes",
    system: makeAreaStub(),
    install: makeAreaStub(),
    config: makeAreaStub(),
    dashboard: makeAreaStub(),
    providers: makeAreaStub(),
    mcp: makeAreaStub(),
    memory: makeAreaStub(),
    skills: makeAreaStub(),
    plugins: makeAreaStub(),
    logs: makeAreaStub(),
    security: makeAreaStub(),
    collectionWarnings: [],
    redaction: makeRedaction(),
  };
}

function makeReport(): DoctorReport {
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    profile: "default",
    platform: { os: "linux", arch: "x64", nodeVersion: "v20.0.0" },
    summary: {
      ok: 1,
      info: 0,
      warnings: 0,
      broken: 0,
      risks: 0,
      unknown: 0,
      total: 1,
    },
    findings: [
      {
        id: "install.executable",
        area: "install",
        status: "ok",
        severity: 0,
        title: "Hermes executable found",
        message: "hermes is on PATH",
        evidence: { executable_path: "/usr/bin/hermes", on_path: true },
        fixes: [],
      },
    ],
    redaction: makeRedaction(),
    flueEnabled: false,
    redactedForSharing: true,
  } as DoctorReport;
}

describe("common schemas", () => {
  it("defines all 11 finding areas", () => {
    expect(FINDING_AREAS).toHaveLength(11);
    expect([...FINDING_AREAS].sort()).toEqual([...AREA_KEYS].sort());
  });

  it("accepts valid finding areas and rejects unknown ones", () => {
    for (const area of FINDING_AREAS) {
      expect(v.parse(FindingAreaSchema, area)).toBe(area);
    }
    expect(() => v.parse(FindingAreaSchema, "bogus")).toThrow();
  });

  it("constrains severity to integers 0-4", () => {
    for (const sev of [0, 1, 2, 3, 4]) {
      expect(v.parse(SeveritySchema, sev)).toBe(sev);
    }
    expect(() => v.parse(SeveritySchema, 5)).toThrow();
    expect(() => v.parse(SeveritySchema, -1)).toThrow();
    expect(() => v.parse(SeveritySchema, 1.5)).toThrow();
  });

  it("validates evidence and fix actions", () => {
    expect(() =>
      v.parse(EvidenceSchema, { label: "os", detail: "linux" }),
    ).not.toThrow();
    expect(() =>
      v.parse(FixActionSchema, { title: "Install", command: "npm i -g hermes" }),
    ).not.toThrow();
    expect(() => v.parse(EvidenceSchema, { label: "os" })).toThrow();
  });

  it("validates evidence with source, confidence, redacted fields", () => {
    expect(() =>
      v.parse(EvidenceSchema, {
        label: "test",
        detail: "desc",
        source: "config",
        confidence: "high",
        redacted: false,
      }),
    ).not.toThrow();
  });

  it("validates EvidenceSourceSchema picklist correctly", () => {
    for (const src of ["file", "config", "command", "log", "dashboard-api", "derived"] as const) {
      expect(v.parse(EvidenceSourceSchema, src)).toBe(src);
    }
    expect(() => v.parse(EvidenceSourceSchema, "invalid-source")).toThrow();
  });

  it("validates EvidenceConfidenceSchema picklist correctly", () => {
    for (const c of ["low", "medium", "high"] as const) {
      expect(v.parse(EvidenceConfidenceSchema, c)).toBe(c);
    }
    expect(() => v.parse(EvidenceConfidenceSchema, "very-high")).toThrow();
  });

  it("evidence backward compat: accepts arbitrary source strings", () => {
    expect(() =>
      v.parse(EvidenceSchema, { label: "x", detail: "y", source: "config.yaml" }),
    ).not.toThrow();
  });
});

describe("normalizeEvidence", () => {
  it("converts legacy string[] to structured Evidence objects", () => {
    const result = normalizeEvidence(["foo", "bar"]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ label: "0: foo", detail: "foo" });
    expect(result[1]).toEqual({ label: "1: bar", detail: "bar" });
  });

  it("passes through pre-structured Evidence objects unchanged", () => {
    const input = [
      { label: "L", detail: "D", source: "log" },
    ];
    const result = normalizeEvidence(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ label: "L", detail: "D", source: "log" });
  });

  it("handles mixed string and object arrays", () => {
    const result = normalizeEvidence(["foo", { label: "L", detail: "D", source: "log" }]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ label: "0: foo", detail: "foo" });
    expect(result[1]).toEqual({ label: "L", detail: "D", source: "log" });
  });

  it("preserves optional fields on passthrough objects", () => {
    const input = [
      { label: "L", detail: "D", source: "config", confidence: "high", redacted: false },
    ];
    const result = normalizeEvidence(input);
    expect(result[0]).toEqual({ label: "L", detail: "D", source: "config", confidence: "high", redacted: false });
  });

  it("handles empty arrays", () => {
    expect(normalizeEvidence([])).toEqual([]);
  });

  it("backward compat: handles legacy string[] from existing findings", () => {
    const legacy = ["line 1", "line 2"];
    const result = normalizeEvidence(legacy);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("detail", "line 1");
    expect(result[1]).toHaveProperty("detail", "line 2");
  });
});

describe("CollectorResult", () => {
  it("validates a generic CollectorResult via the factory", () => {
    const schema = collectorResultSchema(
      v.object({ os: v.string(), arch: v.string() }),
    );
    const result: CollectorResult<{ os: string; arch: string }> = {
      area: "system",
      status: "collected",
      data: { os: "linux", arch: "x64" },
      evidence: [{ label: "os", detail: "linux" }],
      warnings: [],
      errors: [],
    };
    expect(() => v.parse(schema, result)).not.toThrow();
  });

  it("rejects results with an invalid status", () => {
    expect(() =>
      v.parse(CollectorResultSchema, {
        area: "system",
        status: "exploded",
        data: {},
        evidence: [],
        warnings: [],
        errors: [],
      }),
    ).toThrow();
  });

  it("accepts the four collector statuses", () => {
    for (const status of ["collected", "partial", "skipped", "failed"]) {
      expect(() =>
        v.parse(CollectorResultSchema, {
          area: "logs",
          status,
          data: null,
          evidence: [],
          warnings: [],
          errors: [],
        }),
      ).not.toThrow();
    }
  });
});

describe("HermesSnapshot", () => {
  it("validates a minimal snapshot with all 11 areas", () => {
    const snapshot = makeSnapshot();
    expect(() => v.parse(HermesSnapshotSchema, snapshot)).not.toThrow();
  });

  it("has an entry for each of the 11 areas", () => {
    const parsed = v.parse(HermesSnapshotSchema, makeSnapshot());
    for (const key of AREA_KEYS) {
      expect(parsed).toHaveProperty(key);
      expect(
        (parsed as unknown as Record<string, { status: string }>)[key]?.status,
      ).toBe("collected");
    }
  });

  it("tolerates a failed area sub-snapshot for resilience", () => {
    const snapshot = makeSnapshot();
    snapshot.config = { status: "failed", warnings: [], errors: ["boom"] };
    expect(() => v.parse(HermesSnapshotSchema, snapshot)).not.toThrow();
  });

  it("rejects a snapshot missing an area", () => {
    const snapshot = makeSnapshot() as Record<string, unknown>;
    delete snapshot.security;
    expect(() => v.parse(HermesSnapshotSchema, snapshot)).toThrow();
  });

  it("rejects an invalid schemaVersion", () => {
    const snapshot = makeSnapshot() as Record<string, unknown>;
    snapshot.schemaVersion = "2.0";
    expect(() => v.parse(HermesSnapshotSchema, snapshot)).toThrow();
  });
});

describe("DoctorFinding", () => {
  it("requires area, status, severity, evidence, and fixes support", () => {
    const finding = makeReport().findings[0];
    const parsed = v.parse(DoctorFindingSchema, finding);
    expect(parsed.area).toBe("install");
    expect(parsed.status).toBe("ok");
    expect(parsed.severity).toBe(0);
    expect(parsed.evidence).toMatchObject({ on_path: true });
    expect(Array.isArray(parsed.fixes)).toBe(true);
  });

  it("rejects an out-of-range severity", () => {
    const finding = makeReport().findings[0];
    expect(() =>
      v.parse(DoctorFindingSchema, { ...finding, severity: 9 }),
    ).toThrow();
  });

  it("always carries evidence and fixes after parsing", () => {
    const finding = makeReport().findings[0] as Record<string, unknown>;
    const { evidence, fixes, ...withoutEvidenceAndFixes } = finding;
    void evidence;
    void fixes;
    const parsed = v.parse(DoctorFindingSchema, withoutEvidenceAndFixes);
    expect(parsed.evidence).toBeDefined();
    expect(parsed.fixes).toBeDefined();
  });

  it("defaults fixes to an empty array when omitted", () => {
    const finding = makeReport().findings[0] as Record<string, unknown>;
    const { fixes, ...withoutFixes } = finding;
    void fixes;
    const parsed = v.parse(DoctorFindingSchema, withoutFixes);
    expect(parsed.fixes).toEqual([]);
  });

  it("defaults evidence to an empty collection when omitted", () => {
    const finding = makeReport().findings[0] as Record<string, unknown>;
    const { evidence, ...withoutEvidence } = finding;
    void evidence;
    const parsed = v.parse(DoctorFindingSchema, withoutEvidence);
    expect(parsed.evidence).toEqual({});
  });
});

describe("DoctorReport", () => {
  it("validates a complete report", () => {
    expect(() => v.parse(DoctorReportSchema, makeReport())).not.toThrow();
  });

  it("validates summary and redaction sub-schemas", () => {
    const report = makeReport();
    expect(() => v.parse(SummarySchema, report.summary)).not.toThrow();
    expect(() => v.parse(RedactionSummarySchema, report.redaction)).not.toThrow();
  });

  it("requires the redaction summary fields", () => {
    expect(() =>
      v.parse(RedactionSummarySchema, { redacted: true }),
    ).toThrow();
  });

  it("validates a report without flueInsights (optional field)", () => {
    const report = makeReport();
    expect(report.flueInsights).toBeUndefined();
    expect(() => v.parse(DoctorReportSchema, report)).not.toThrow();
  });

  it("validates a report with well-formed flueInsights", () => {
    const report: DoctorReport = {
      ...makeReport(),
      flueInsights: {
        enabled: true,
        experimental: true,
        generatedAt: new Date().toISOString(),
        insights: [],
        warnings: [],
      },
    };
    expect(() => v.parse(DoctorReportSchema, report)).not.toThrow();
  });

  it("rejects a report with flueInsights missing required fields", () => {
    const report = {
      ...makeReport(),
      flueInsights: {
        enabled: true,
        // missing experimental
        insights: [],
        warnings: [],
      },
    };
    expect(() => v.parse(DoctorReportSchema, report)).toThrow();
  });

  it("rejects flueInsights with experimental set to false", () => {
    const report = {
      ...makeReport(),
      flueInsights: {
        enabled: true,
        experimental: false,
        insights: [],
        warnings: [],
      },
    };
    expect(() => v.parse(DoctorReportSchema, report)).toThrow();
  });
});

describe("FlueInsightSchema", () => {
  it("validates a well-formed FlueInsight object", () => {
    const insight = { findingId: "test-check", insight: "This is an AI insight" };
    expect(() => v.parse(FlueInsightSchema, insight)).not.toThrow();
  });

  it("rejects a FlueInsight missing findingId", () => {
    expect(() => v.parse(FlueInsightSchema, { insight: "test" })).toThrow();
  });

  it("rejects a FlueInsight missing insight field", () => {
    expect(() => v.parse(FlueInsightSchema, { findingId: "test" })).toThrow();
  });
});

describe("FlueInsightsSectionSchema", () => {
  it("validates a complete FlueInsightsSection", () => {
    const section = {
      enabled: true,
      experimental: true,
      generatedAt: new Date().toISOString(),
      insights: [{ findingId: "test", insight: "test insight" }],
      warnings: ["Flue API key not configured"],
    };
    expect(() => v.parse(FlueInsightsSectionSchema, section)).not.toThrow();
  });

  it("validates a minimal FlueInsightsSection without generatedAt", () => {
    const section = {
      enabled: true,
      experimental: true,
      insights: [],
      warnings: [],
    };
    expect(() => v.parse(FlueInsightsSectionSchema, section)).not.toThrow();
  });

  it("validates FlueInsight is exported from @hermes-doctor/core", () => {
    // This verifies FlueInsightSchema is importable
    expect(FlueInsightSchema).toBeDefined();
  });
});

describe("FlueResponseSchema", () => {
  it("validates a well-formed FlueResponse with findings", () => {
    const response = {
      findings: [
        { findingId: "check-1", insight: "This is an AI insight for check-1" },
        { findingId: "check-2", insight: "This is an AI insight for check-2" },
      ],
    };
    expect(() => v.parse(FlueResponseSchema, response)).not.toThrow();
  });

  it("rejects a FlueResponse missing required fields", () => {
    expect(() => v.parse(FlueResponseSchema, {})).toThrow();
    expect(() => v.parse(FlueResponseSchema, { findings: [] })).not.toThrow();
  });

  it("rejects a FlueResponse with invalid finding items", () => {
    expect(() =>
      v.parse(FlueResponseSchema, {
        findings: [{ findingId: "test" }], // missing insight
      }),
    ).toThrow();
    expect(() =>
      v.parse(FlueResponseSchema, {
        findings: [{ insight: "test" }], // missing findingId
      }),
    ).toThrow();
  });

  it("validates FlueResponse is exported from @hermes-doctor/core", () => {
    expect(FlueResponseSchema).toBeDefined();
  });
});
