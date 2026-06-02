import {
  DeterministicWorkflowRunner,
  type DoctorFinding,
  type DoctorReport,
  type FlueInsightsSection,
  type HermesSnapshot,
  type WorkflowRunner,
} from "@hermes-doctor/core";

import { requestFlueInsights } from "./explain-finding.js";

/**
 * FlueWorkflowRunner — MS2 Real Flue Insights
 *
 * Builds a deterministic report from checks, then sends only the relevant
 * findings (broken, risk, top-3-warning) to Flue for AI-powered insights.
 *
 * The @flue/runtime import is DYNAMIC — it is only loaded when this runner
 * is instantiated. The default (DeterministicWorkflowRunner) never loads it.
 *
 * Graceful degradation behavior:
 * - If @flue/runtime fails to load → fall back to deterministic with warning
 * - If no FLUE_API_KEY or ANTHROPIC_API_KEY is set → fall back to deterministic with warning
 * - If Flue returns malformed JSON → fall back with warning
 * - If Flue times out → fall back with warning
 * - Flue NEVER mutates deterministic findings (status/severity/evidence/fixes)
 * - Never throw — always return a valid DoctorReport
 */
export class FlueWorkflowRunner implements WorkflowRunner {
  private readonly deterministicRunner: DeterministicWorkflowRunner;

  constructor() {
    this.deterministicRunner = new DeterministicWorkflowRunner();
  }

  async runDoctor(snapshot: HermesSnapshot): Promise<DoctorReport> {
    // Step 1: Build the deterministic base report
    const baseReport = await this.deterministicRunner.runDoctor(snapshot);

    // Step 2: Check if Flue is available
    const flueRuntime = await this.tryLoadFlueRuntime();
    if (!flueRuntime) {
      process.stderr.write(
        "Warning: Flue explanation layer requested but unavailable. " +
        "Running in deterministic mode. " +
        "Set the FLUE_API_KEY environment variable to enable Flue.\n",
      );
      return baseReport;
    }

    // Step 3: Filter findings — only broken, risk, and top-3-warning
    const filteredFindings = this.filterFindingsForFlue(baseReport.findings);

    // Step 4: Request Flue insights for the filtered findings
    const snapshotContext = [
      `Profile: ${snapshot.profile}`,
      `System: ${snapshot.system.os ?? "unknown"} ${snapshot.system.arch ?? ""}`,
      `Node: ${snapshot.system.nodeVersion ?? "unknown"}`,
      `Hermes install: ${snapshot.install.versionString ?? "unknown"}`,
    ].join(", ");

    const result = await requestFlueInsights(filteredFindings, {
      flueRuntime,
      snapshotContext,
      timeout: 30_000,
    });

    // Step 5: Build the flueInsights section
    const warnings: string[] = [];
    if (result.warning) {
      warnings.push(result.warning);
    }

    const flueInsights: FlueInsightsSection = {
      enabled: true,
      experimental: true,
      generatedAt: new Date().toISOString(),
      insights: result.response?.findings ?? [],
      warnings,
    };

    // Step 6: Return the report with flueInsights attached.
    // IMPORTANT: Flue never mutates deterministic findings. We pass through
    // the base report's findings unchanged. Insights are in flueInsights only.
    return {
      ...baseReport,
      flueEnabled: true,
      flueInsights,
    };
  }

  /**
   * Filter findings to only those relevant for Flue enrichment.
   *
   * Rules:
   * - broken findings: all included
   * - risk findings: all included
   * - warning findings: only top 3 by severity desc, then id order
   * - ok, info, unknown: excluded
   */
  private filterFindingsForFlue(
    findings: DoctorReport["findings"],
  ): DoctorReport["findings"] {
    const broken: DoctorFinding[] = [];
    const risk: DoctorFinding[] = [];
    const warnings: DoctorFinding[] = [];

    for (const f of findings) {
      switch (f.status) {
        case "broken":
          broken.push(f);
          break;
        case "risk":
          risk.push(f);
          break;
        case "warning":
          warnings.push(f);
          break;
        // ok, info, unknown — excluded
      }
    }

    // Sort warnings: by severity desc, then id ascending for determinism
    warnings.sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      return a.id.localeCompare(b.id);
    });

    const topWarnings = warnings.slice(0, 3);

    // Return in a consistent order: broken, risk, top warnings
    return [...broken, ...risk, ...topWarnings];
  }

  /**
   * Try to dynamically import @flue/runtime.
   * Returns the module if successful, or null if import failed.
   */
  private async tryLoadFlueRuntime(): Promise<typeof import("@flue/runtime") | null> {
    try {
      // Check for API key first
      const apiKey =
        process.env.FLUE_API_KEY ??
        process.env.ANTHROPIC_API_KEY ??
        "";
      if (!apiKey || apiKey.trim() === "") {
        return null;
      }

      // Dynamically import @flue/runtime
      const flueRuntime = await import("@flue/runtime");
      return flueRuntime;
    } catch {
      return null;
    }
  }
}
