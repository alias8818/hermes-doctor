import type { DoctorReport, HermesSnapshot } from "./schemas/index.js";

/**
 * WorkflowRunner interface.
 *
 * Defines the contract for running a diagnostic workflow against a
 * HermesSnapshot and producing a DoctorReport.
 *
 * The default implementation is DeterministicWorkflowRunner, which
 * delegates to the existing checks and report builder. A Flue-enhanced
 * implementation lives in packages/flue-workflows.
 */
export interface WorkflowRunner {
  /**
   * Run a diagnostic workflow against a snapshot and produce a report.
   * Must always return a valid DoctorReport — never throw.
   */
  runDoctor(snapshot: HermesSnapshot): Promise<DoctorReport>;
}
