import * as v from "valibot";

export const FINDING_AREAS = [
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

export const FindingAreaSchema = v.picklist(FINDING_AREAS);
export type FindingArea = v.InferOutput<typeof FindingAreaSchema>;

export const FindingStatusSchema = v.picklist([
  "ok",
  "info",
  "warning",
  "broken",
  "risk",
  "unknown",
]);
export type FindingStatus = v.InferOutput<typeof FindingStatusSchema>;

export const CollectorStatusSchema = v.picklist([
  "collected",
  "partial",
  "skipped",
  "failed",
]);
export type CollectorStatus = v.InferOutput<typeof CollectorStatusSchema>;

export const SeveritySchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(4),
);
export type Severity = v.InferOutput<typeof SeveritySchema>;

export const EVIDENCE_SOURCES = [
  "file",
  "config",
  "command",
  "log",
  "dashboard-api",
  "derived",
] as const;

export const EvidenceSourceSchema = v.picklist(EVIDENCE_SOURCES);
export type EvidenceSource = v.InferOutput<typeof EvidenceSourceSchema>;

export const EVIDENCE_CONFIDENCE = ["low", "medium", "high"] as const;

export const EvidenceConfidenceSchema = v.picklist(EVIDENCE_CONFIDENCE);
export type EvidenceConfidence = v.InferOutput<typeof EvidenceConfidenceSchema>;

export const EvidenceSchema = v.object({
  label: v.string(),
  detail: v.string(),
  source: v.optional(v.string()),
  confidence: v.optional(EvidenceConfidenceSchema),
  redacted: v.optional(v.boolean()),
});
export type Evidence = v.InferOutput<typeof EvidenceSchema>;

/**
 * Normalize legacy evidence formats into structured Evidence[].
 *
 * - `string[]` input: each string becomes an Evidence object with `label` set
 *   to the index-prefixed text (e.g., "0: foo") and `detail` set to the string content.
 * - Pre-structured `Evidence[]` input: passed through unchanged (identity passthrough).
 * - Mixed arrays: string entries converted, object entries passed through.
 *
 * This adapter provides backward compatibility so renderers can always consume
 * normalized Evidence[] regardless of the original format.
 */
export function normalizeEvidence(legacy: unknown[]): Evidence[] {
  return legacy.map((item, index) => {
    if (typeof item === "string") {
      return { label: `${index}: ${item}`, detail: item };
    }
    // Already a structured Evidence object (or compatible shape)
    if (item !== null && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      return {
        label: typeof obj.label === "string" ? obj.label : `${index}`,
        detail: typeof obj.detail === "string" ? obj.detail : "",
        source: obj.source as EvidenceSource | undefined,
        confidence: obj.confidence as EvidenceConfidence | undefined,
        redacted: typeof obj.redacted === "boolean" ? obj.redacted : undefined,
      } satisfies Evidence;
    }
    // Fallback for any other type
    return { label: `${index}`, detail: String(item) };
  });
}

export const FIX_RISK_LEVELS = ["low", "medium", "high"] as const;

export const FixRiskSchema = v.picklist(FIX_RISK_LEVELS);
export type FixRisk = v.InferOutput<typeof FixRiskSchema>;

export const FixActionSchema = v.object({
  title: v.string(),
  command: v.optional(v.string()),
  url: v.optional(v.string()),
  description: v.optional(v.string()),
  risk: v.optional(FixRiskSchema),
  requiresConfirmation: v.optional(v.boolean()),
  manualSteps: v.optional(v.array(v.string())),
  rollback: v.optional(v.string()),
});
export type FixAction = v.InferOutput<typeof FixActionSchema>;
