import * as v from "valibot";

import {
  CollectorStatusSchema,
  EvidenceSchema,
  FindingAreaSchema,
  type CollectorStatus,
  type Evidence,
  type FindingArea,
} from "./common.js";

export interface CollectorResult<T> {
  area: FindingArea;
  status: CollectorStatus;
  data: T;
  evidence: Evidence[];
  warnings: string[];
  errors: string[];
  durationMs?: number;
}

export function collectorResultSchema<
  const TSchema extends v.GenericSchema,
>(dataSchema: TSchema) {
  return v.object({
    area: FindingAreaSchema,
    status: CollectorStatusSchema,
    data: dataSchema,
    evidence: v.array(EvidenceSchema),
    warnings: v.array(v.string()),
    errors: v.array(v.string()),
    durationMs: v.optional(v.number()),
  });
}

export const CollectorResultSchema = collectorResultSchema(v.unknown());
