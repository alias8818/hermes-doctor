import { redact, redactDeep, type RedactionOptions } from "../redaction/index.js";
import type { CollectorResult } from "../schemas/collector.js";
import type {
  CollectorStatus,
  Evidence,
  FindingArea,
} from "../schemas/common.js";
import { errorMessage } from "../utils/fs.js";

export interface CollectorAccumulator {
  evidence: Evidence[];
  warnings: string[];
  errors: string[];
}

export function newAccumulator(): CollectorAccumulator {
  return { evidence: [], warnings: [], errors: [] };
}

export function addEvidence(
  acc: CollectorAccumulator,
  label: string,
  detail: string,
  source?: string,
): void {
  acc.evidence.push(source === undefined ? { label, detail } : { label, detail, source });
}

function redactEvidence(
  evidence: Evidence[],
  options: RedactionOptions,
): Evidence[] {
  return evidence.map((entry) => {
    const next: Evidence = {
      label: redact(entry.label, options).value,
      detail: redact(entry.detail, options).value,
    };
    if (entry.source !== undefined) {
      next.source = redact(entry.source, options).value;
    }
    if (entry.confidence !== undefined) {
      next.confidence = entry.confidence;
    }
    if (entry.redacted !== undefined) {
      next.redacted = entry.redacted;
    }
    return next;
  });
}

export function finalize<T>(
  area: FindingArea,
  status: CollectorStatus,
  data: T,
  acc: CollectorAccumulator,
  options: RedactionOptions,
): CollectorResult<T> {
  return {
    area,
    status,
    data: redactDeep(data, options).value as T,
    evidence: redactEvidence(acc.evidence, options),
    warnings: acc.warnings.map((warning) => redact(warning, options).value),
    errors: acc.errors.map((error) => redact(error, options).value),
  };
}

export async function runArea<T>(
  area: FindingArea,
  emptyData: T,
  options: RedactionOptions,
  fn: (acc: CollectorAccumulator) => Promise<CollectorResult<T>>,
): Promise<CollectorResult<T>> {
  const start = Date.now();
  const acc = newAccumulator();
  try {
    const result = await fn(acc);
    if (result.durationMs === undefined) {
      result.durationMs = Date.now() - start;
    }
    return result;
  } catch (error) {
    acc.errors.push(errorMessage(error));
    const result = finalize(area, "failed", emptyData, acc, options);
    result.durationMs = Date.now() - start;
    return result;
  }
}
