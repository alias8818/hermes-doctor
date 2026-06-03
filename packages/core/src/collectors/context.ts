import * as path from "node:path";

import { mergeThresholds, type Thresholds } from "../checks/thresholds.js";
import type { RedactionOptions } from "../redaction/index.js";
import {
  hermesPaths,
  resolveHermesHome,
  type HermesPaths,
} from "../utils/paths.js";

export const DEFAULT_DASHBOARD_TIMEOUT_MS = 1500;

export interface CollectorContext {
  hermesHome: string;
  paths: HermesPaths;
  profile: string;
  env: NodeJS.ProcessEnv;
  redaction: RedactionOptions;
  commandTimeoutMs: number;
  dashboardTimeoutMs: number;
  thresholds: Thresholds;
  now: () => Date;
  includeLogSnippets: boolean;
  maxLogLines: number;
  strictRedaction: boolean;
}

export interface CreateCollectorContextOptions {
  hermesHome?: string | null;
  profile?: string;
  env?: NodeJS.ProcessEnv;
  redaction?: RedactionOptions;
  commandTimeoutMs?: number;
  dashboardTimeoutMs?: number;
  thresholds?: Partial<Thresholds>;
  now?: () => Date;
  includeLogSnippets?: boolean;
  maxLogLines?: number;
  strictRedaction?: boolean;
}

export function createCollectorContext(
  options: CreateCollectorContextOptions = {},
): CollectorContext {
  const env = options.env ?? process.env;
  const home = resolveHermesHome({ hermesHome: options.hermesHome, env });
  const strictRedaction = options.strictRedaction ?? false;
  const baseRedaction = options.redaction ?? { homeDir: home };

  // Prepend the Hermes home bin/ directory to PATH so that the install
  // collector can discover the hermes binary without including untrusted
  // PATH entries.  System commands (docker, git) are still resolved from
  // trusted system directories by envForTrustedProbes.
  const delim = process.platform === "win32" ? ";" : ":";
  const hermesBin = path.join(home, "bin");
  const safeEnv = {
    ...env,
    PATH: [hermesBin, env.PATH ?? ""].join(delim),
  };

  return {
    hermesHome: home,
    paths: hermesPaths(home),
    profile: options.profile ?? env.HERMES_PROFILE ?? "default",
    env: safeEnv,
    redaction: { ...baseRedaction, strictRedaction },
    commandTimeoutMs: options.commandTimeoutMs ?? 10_000,
    dashboardTimeoutMs:
      options.dashboardTimeoutMs ?? DEFAULT_DASHBOARD_TIMEOUT_MS,
    thresholds: mergeThresholds(options.thresholds),
    now: options.now ?? (() => new Date()),
    includeLogSnippets: options.includeLogSnippets ?? false,
    maxLogLines: options.maxLogLines ?? 500,
    strictRedaction,
  };
}
