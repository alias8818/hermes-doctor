import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { DeterministicWorkflowRunner } from "../deterministic-runner.js";
import { DoctorReportSchema } from "../schemas/report.js";
import type { HermesSnapshot } from "../schemas/snapshot.js";
import type { WorkflowRunner } from "../workflow-runner.js";

/**
 * Build a minimal HermesSnapshot for testing.
 * Uses all required fields with minimal data.
 */
function minimalSnapshot(): HermesSnapshot {
  return {
    schemaVersion: "1.0",
    collectedAt: "2026-05-31T12:00:00.000Z",
    profile: "default",
    hermesHome: null,
    system: { status: "collected", warnings: [], errors: [] },
    install: { status: "collected", warnings: [], errors: [] },
    config: { status: "collected", warnings: [], errors: [] },
    dashboard: { status: "collected", warnings: [], errors: [] },
    providers: { status: "collected", warnings: [], errors: [] },
    mcp: { status: "collected", warnings: [], errors: [] },
    memory: { status: "collected", warnings: [], errors: [] },
    skills: { status: "collected", warnings: [], errors: [] },
    plugins: { status: "collected", warnings: [], errors: [] },
    logs: { status: "collected", warnings: [], errors: [] },
    security: { status: "collected", warnings: [], errors: [] },
    collectionWarnings: [],
    redaction: {
      redacted: false,
      count: 0,
      totalRedactions: 0,
      patterns: [],
      homePathRedactions: 0,
    },
  };
}

describe("WorkflowRunner interface", () => {
  it("is defined and can be implemented", () => {
    const runner: WorkflowRunner = new DeterministicWorkflowRunner();
    expect(runner).toBeDefined();
    expect(typeof runner.runDoctor).toBe("function");
  });
});

describe("DeterministicWorkflowRunner", () => {
  it("produces a valid DoctorReport", async () => {
    const runner = new DeterministicWorkflowRunner();
    const snapshot = minimalSnapshot();
    const report = await runner.runDoctor(snapshot);

    // Validate against the schema
    expect(() => v.parse(DoctorReportSchema, report)).not.toThrow();

    // Check required fields
    expect(report.schemaVersion).toBe("1.0");
    expect(report.profile).toBe("default");
    expect(report.flueEnabled).toBe(false);
    expect(report.redactedForSharing).toBe(true);

    // Summary should be internally consistent
    expect(report.summary.ok + report.summary.info + report.summary.warnings +
      report.summary.broken + report.summary.risks + report.summary.unknown)
      .toBe(report.summary.total);

    // findings array length matches total
    expect(report.findings.length).toBe(report.summary.total);
  });

  it("produces deterministic reports (same input = same output, ignoring generatedAt)", async () => {
    const runner = new DeterministicWorkflowRunner();
    const snapshot = minimalSnapshot();

    const report1 = await runner.runDoctor(snapshot);
    const report2 = await runner.runDoctor(snapshot);

    // Strip timestamp-dependent fields
    const clean = (r: typeof report1) => ({
      ...r,
      generatedAt: "<STRIPPED>",
    });

    expect(clean(report1)).toEqual(clean(report2));
  });

  it("always returns the same number of findings for the same snapshot", async () => {
    const runner = new DeterministicWorkflowRunner();
    const snapshot = minimalSnapshot();

    const report1 = await runner.runDoctor(snapshot);
    const report2 = await runner.runDoctor(snapshot);

    expect(report1.findings.length).toBe(report2.findings.length);
    expect(report1.summary.total).toBe(report2.summary.total);
  });

  it("never throws", async () => {
    const runner = new DeterministicWorkflowRunner();
    const snapshot = minimalSnapshot();

    await expect(runner.runDoctor(snapshot)).resolves.not.toThrow();
  });

  it("marks flueEnabled as false", async () => {
    const runner = new DeterministicWorkflowRunner();
    const snapshot = minimalSnapshot();
    const report = await runner.runDoctor(snapshot);

    expect(report.flueEnabled).toBe(false);
  });
});
