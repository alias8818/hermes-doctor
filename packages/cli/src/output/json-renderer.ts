import * as v from "valibot";

import type { DoctorReport } from "@hermes-doctor/core";
import { DoctorReportSchema } from "@hermes-doctor/core";
import { redactDeep } from "@hermes-doctor/core";
import { mergeRedactionSummaries } from "@hermes-doctor/core";

export interface JsonRenderOptions {
  pretty?: boolean;
  verbose?: boolean;
}

/**
 * Render a DoctorReport to JSON.
 *
 * Applies a final redaction pass as defense-in-depth, then validates
 * against DoctorReportSchema before serializing.
 *
 * Returns the JSON string.
 */
export function renderJson(
  report: DoctorReport,
  options: JsonRenderOptions = {},
): string {
  // Apply final redaction pass (defense-in-depth)
  const { value: redactedValue, summary: redactionDelta } = redactDeep(report, {
    homeDir: report.hermesHome ?? undefined,
  });

  // Merge the renderer's redaction delta into the report's redaction summary
  const redactedReport = redactedValue as DoctorReport;
  const mergedRedaction = mergeRedactionSummaries(
    redactedReport.redaction,
    redactionDelta,
  );

  const finalReport: DoctorReport = {
    ...redactedReport,
    redaction: mergedRedaction,
  };

  // Validate against the schema
  const validated = v.parse(DoctorReportSchema, finalReport);

  // Serialize to JSON
  const space = options.pretty ? 2 : undefined;

  // If verbose, include extra metadata
  if (options.verbose) {
    const extras: Record<string, unknown> = {
      ...(validated as unknown as Record<string, unknown>),
      verbose: true,
      collectorTimings: {
        collectedAt: validated.generatedAt,
        findingCount: validated.summary.total,
      },
    };
    return JSON.stringify(extras, null, space);
  }

  return JSON.stringify(validated, null, space);
}
