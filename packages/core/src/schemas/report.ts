import * as v from "valibot";

import {
  EvidenceSchema,
  FindingAreaSchema,
  FindingStatusSchema,
  FixActionSchema,
  SeveritySchema,
} from "./common.js";
import { RedactionSummarySchema } from "./snapshot.js";
import { FlueInsightsSectionSchema } from "./flue.js";

/**
 * Evidence field accepts either structured Evidence[] (new format for migrated checks)
 * or Record<string, unknown> (legacy format for backward compatibility).
 */
export const EvidenceFieldSchema = v.union([
  v.array(EvidenceSchema),
  v.record(v.string(), v.unknown()),
]);
export type EvidenceField = v.InferOutput<typeof EvidenceFieldSchema>;

export const DoctorFindingSchema = v.object({
  id: v.string(),
  area: FindingAreaSchema,
  status: FindingStatusSchema,
  severity: SeveritySchema,
  title: v.string(),
  message: v.string(),
  details: v.optional(v.nullable(v.string())),
  evidence: v.optional(EvidenceFieldSchema, () => ({})),
  fixes: v.optional(v.array(FixActionSchema), () => []),
  explanation: v.optional(v.nullable(v.string())),
});
export type DoctorFinding = v.InferOutput<typeof DoctorFindingSchema>;

export const SummarySchema = v.object({
  ok: v.number(),
  info: v.number(),
  warnings: v.number(),
  broken: v.number(),
  risks: v.number(),
  unknown: v.number(),
  total: v.number(),
});
export type Summary = v.InferOutput<typeof SummarySchema>;

export const PlatformSchema = v.object({
  os: v.string(),
  arch: v.string(),
  nodeVersion: v.string(),
});
export type Platform = v.InferOutput<typeof PlatformSchema>;

export const DoctorReportSchema = v.object({
  schemaVersion: v.string(),
  generatedAt: v.string(),
  profile: v.string(),
  hermesHome: v.optional(v.nullable(v.string())),
  platform: PlatformSchema,
  summary: SummarySchema,
  findings: v.array(DoctorFindingSchema),
  redaction: RedactionSummarySchema,
  flueEnabled: v.optional(v.boolean(), false),
  redactedForSharing: v.optional(v.boolean(), true),
  flueInsights: v.optional(FlueInsightsSectionSchema),
});
export type DoctorReport = v.InferOutput<typeof DoctorReportSchema>;
