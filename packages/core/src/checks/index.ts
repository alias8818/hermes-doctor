import type { CollectorStatus } from "../schemas/common.js";
import type { DoctorFinding, HermesSnapshot } from "../schemas/index.js";
import type { Check } from "./types.js";
import { configChecks } from "./config.js";
import { dashboardChecks } from "./dashboard.js";
import { installChecks } from "./install.js";
import { logsChecks } from "./logs.js";
import { mcpChecks } from "./mcp.js";
import { memoryChecks } from "./memory.js";
import { pluginsChecks } from "./plugins.js";
import { providersChecks } from "./providers.js";
import { securityChecks } from "./security.js";
import { skillsChecks } from "./skills.js";
import { systemChecks } from "./system.js";

export { finding, fix, evidence } from "./types.js";
export type { Check } from "./types.js";
export { mergeThresholds, type Thresholds } from "./thresholds.js";
export * from "./system.js";
export * from "./install.js";
export * from "./config.js";
export * from "./dashboard.js";
export * from "./providers.js";
export * from "./mcp.js";
export * from "./memory.js";
export * from "./skills.js";
export * from "./plugins.js";
export * from "./logs.js";
export * from "./security.js";

/**
 * All available checks, organized by area.
 */
export const allChecks: Check[] = [
  ...systemChecks,
  ...installChecks,
  ...configChecks,
  ...dashboardChecks,
  ...providersChecks,
  ...mcpChecks,
  ...memoryChecks,
  ...skillsChecks,
  ...pluginsChecks,
  ...logsChecks,
  ...securityChecks,
];

/**
 * Check registry by area for targeted check execution.
 */
export const checksByArea: Record<string, Check[]> = {
  system: systemChecks,
  install: installChecks,
  config: configChecks,
  dashboard: dashboardChecks,
  providers: providersChecks,
  mcp: mcpChecks,
  memory: memoryChecks,
  skills: skillsChecks,
  plugins: pluginsChecks,
  logs: logsChecks,
  security: securityChecks,
};

/**
 * Get the collector status for a given area from the snapshot.
 */
function areaStatus(snapshot: HermesSnapshot, area: string): CollectorStatus | undefined {
  const areaMap: Record<string, { status: CollectorStatus }> = {
    system: snapshot.system,
    install: snapshot.install,
    config: snapshot.config,
    dashboard: snapshot.dashboard,
    providers: snapshot.providers,
    mcp: snapshot.mcp,
    memory: snapshot.memory,
    skills: snapshot.skills,
    plugins: snapshot.plugins,
    logs: snapshot.logs,
    security: snapshot.security,
  };
  return areaMap[area]?.status;
}

/**
 * Produce a single synthetic finding for a collector that failed.
 */
function collectorFailedFinding(area: string): DoctorFinding {
  const areaName = area.charAt(0).toUpperCase() + area.slice(1);
  return {
    id: `${area}-collector-failed`,
    area: area as DoctorFinding["area"],
    status: "unknown",
    severity: 0,
    title: `${areaName} Collector Failed`,
    message: `The ${area} collector encountered an error. Findings for this area are unavailable.`,
    details: null,
    evidence: {},
    fixes: [],
  };
}

/**
 * Run all checks against a HermesSnapshot.
 * Returns a flat array of DoctorFindings, one per check.
 *
 * If an area's collector failed (status === "failed"), all checks for that
 * area are skipped and a single synthetic "collector failed" finding is emitted instead.
 *
 * Each check always produces at least one finding, so the result
 * count is always >= allChecks.length (even when all areas are empty).
 */
export function runAllChecks(snapshot: HermesSnapshot): DoctorFinding[] {
  const findings: DoctorFinding[] = [];
  const skippedAreas = new Set<string>();

  for (const check of allChecks) {
    // If this area's collector failed, skip all its checks
    if (areaStatus(snapshot, check.area) === "failed") {
      if (!skippedAreas.has(check.area)) {
        skippedAreas.add(check.area);
        findings.push(collectorFailedFinding(check.area));
      }
      continue;
    }

    try {
      const result = check.run(snapshot);
      findings.push(...result);
    } catch (error) {
      // If a check throws unexpectedly, produce a synthetic error finding
      findings.push({
        id: `${check.id}-error`,
        area: check.area,
        status: "unknown",
        severity: 0,
        title: `${check.title} — Check Error`,
        message: `The check encountered an unexpected error: ${(error as Error).message ?? String(error)}`,
        details: null,
        evidence: {},
        fixes: [],
      });
    }
  }
  return findings;
}

/**
 * Run checks for a specific area.
 * Returns findings for that area only.
 *
 * If the area's collector failed, checks are skipped and a synthetic
 * "collector failed" finding is returned instead.
 */
export function runAreaChecks(
  snapshot: HermesSnapshot,
  area: string,
): DoctorFinding[] {
  const areaChecks = checksByArea[area] ?? [];
  const findings: DoctorFinding[] = [];

  // If this area's collector failed, skip checks and return synthetic finding
  if (areaStatus(snapshot, area) === "failed") {
    return [collectorFailedFinding(area)];
  }

  for (const check of areaChecks) {
    try {
      const result = check.run(snapshot);
      findings.push(...result);
    } catch (error) {
      findings.push({
        id: `${check.id}-error`,
        area: check.area,
        status: "unknown",
        severity: 0,
        title: `${check.title} — Check Error`,
        message: `The check encountered an unexpected error: ${(error as Error).message ?? String(error)}`,
        details: null,
        evidence: {},
        fixes: [],
      });
    }
  }
  return findings;
}

/**
 * Count total checks available.
 */
export const TOTAL_CHECKS = allChecks.length;
