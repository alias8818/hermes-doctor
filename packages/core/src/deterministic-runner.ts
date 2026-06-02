import { runAllChecks } from "./checks/index.js";
import { buildReport } from "./report/index.js";
import type { DoctorReport, HermesSnapshot } from "./schemas/index.js";
import type { WorkflowRunner } from "./workflow-runner.js";

/**
 * DeterministicWorkflowRunner
 *
 * The default WorkflowRunner that delegates to existing checks and
 * report builder. Always works, no external dependencies.
 *
 * This is the "no --flue" path — it never imports @flue/runtime.
 */
export class DeterministicWorkflowRunner implements WorkflowRunner {
  async runDoctor(snapshot: HermesSnapshot): Promise<DoctorReport> {
    const findings = runAllChecks(snapshot);
    const report = buildReport(findings, {
      profile: snapshot.profile,
      hermesHome: snapshot.hermesHome ?? null,
      collectedAt: snapshot.collectedAt,
      redaction: snapshot.redaction,
      flueEnabled: false,
    });
    return report;
  }
}
