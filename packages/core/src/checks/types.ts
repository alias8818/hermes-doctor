import type { DoctorFinding, FindingArea, HermesSnapshot } from "../schemas/index.js";

/**
 * A deterministic check that consumes HermesSnapshot data and produces zero or more DoctorFindings.
 */
export type Check = {
  id: string;
  area: FindingArea;
  title: string;
  run: (snapshot: HermesSnapshot) => DoctorFinding[];
};

/**
 * Helper to create a single DoctorFinding with proper typing.
 *
 * `evidence` can be either a Record<string, unknown> (legacy format) or
 * Evidence[] (structured format). All checks are being migrated to use
 * structured Evidence[] for the evidence field.
 */
export function finding(
  id: string,
  area: FindingArea,
  status: DoctorFinding["status"],
  severity: DoctorFinding["severity"],
  title: string,
  message: string,
  evidence: Record<string, unknown> | Array<{ label: string; detail: string; source?: string; confidence?: "low" | "medium" | "high"; redacted?: boolean }> = {},
  fixes: DoctorFinding["fixes"] = [],
  details?: string | null,
): DoctorFinding {
  return {
    id,
    area,
    status,
    severity,
    title,
    message,
    details: details ?? null,
    evidence,
    fixes,
  };
}

/**
 * Helper to build a structured Evidence item.
 */
export function evidence(
  label: string,
  detail: string,
  source?: "file" | "config" | "command" | "log" | "dashboard-api" | "derived",
  confidence?: "low" | "medium" | "high",
  redacted?: boolean,
): { label: string; detail: string; source?: string; confidence?: "low" | "medium" | "high"; redacted?: boolean } {
  return {
    label,
    detail,
    ...(source !== undefined ? { source } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(redacted !== undefined ? { redacted } : {}),
  };
}

/**
 * Options for building a FixAction with safety fields.
 */
export interface FixOptions {
  command?: string;
  description?: string;
  url?: string;
  risk?: "low" | "medium" | "high";
  requiresConfirmation?: boolean;
  manualSteps?: string[];
  rollback?: string;
}

/**
 * Helper to build a FixAction.
 *
 * Accepts new safety fields: risk, requiresConfirmation, manualSteps, rollback.
 * All safety fields are optional — existing code continues to work unchanged.
 */
export function fix(
  title: string,
  command?: string,
  description?: string,
  url?: string,
): DoctorFinding["fixes"][number];

export function fix(
  title: string,
  options?: FixOptions,
): DoctorFinding["fixes"][number];

export function fix(
  title: string,
  commandOrOptions?: string | FixOptions,
  description?: string,
  url?: string,
): DoctorFinding["fixes"][number] {
  if (commandOrOptions !== undefined && typeof commandOrOptions === "object") {
    // New overload: fix("title", { command, description, url, risk, ... })
    const opts = commandOrOptions as FixOptions;
    return {
      title,
      ...(opts.command !== undefined ? { command: opts.command } : {}),
      ...(opts.description !== undefined ? { description: opts.description } : {}),
      ...(opts.url !== undefined ? { url: opts.url } : {}),
      ...(opts.risk !== undefined ? { risk: opts.risk } : {}),
      ...(opts.requiresConfirmation !== undefined ? { requiresConfirmation: opts.requiresConfirmation } : {}),
      ...(opts.manualSteps !== undefined ? { manualSteps: opts.manualSteps } : {}),
      ...(opts.rollback !== undefined ? { rollback: opts.rollback } : {}),
    };
  }

  // Legacy overload: fix("title", "command", "description", "url")
  return {
    title,
    ...(commandOrOptions !== undefined ? { command: commandOrOptions as string } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(url !== undefined ? { url } : {}),
  };
}
