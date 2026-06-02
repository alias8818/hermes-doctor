/**
 * Configurable diagnostic thresholds for Hermes Doctor checks.
 *
 * Each threshold has a sensible default so existing behavior is preserved
 * when no override is provided via CLI flags or programmatic API.
 */

export interface Thresholds {
  /** Memory usage warning threshold as a percentage (0-100). Default: 80 */
  memoryWarnPercent: number;
  /** Memory usage critical/exceeded threshold as a percentage (0-100). Default: 100 */
  memoryCriticalPercent: number;
  /** File size in bytes above which a memory file is considered "huge". Default: 100 MB */
  hugeFileBytes: number;
  /** Total error count above which a crash loop is suspected. Default: 50 */
  crashLoopErrorCount: number;
  /** Recent error count above which a crash loop is suspected. Default: 20 */
  crashLoopRecentErrors: number;
  /** File size in bytes above which a memory file is marked "large". Default: 256 KB */
  largeFileBytes: number;
  /** File size in bytes above which a SKILL.md file is flagged as large. Default: 512 KB */
  skillsLargeFileBytes: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  memoryWarnPercent: 80,
  memoryCriticalPercent: 100,
  hugeFileBytes: 100 * 1024 * 1024,
  crashLoopErrorCount: 50,
  crashLoopRecentErrors: 20,
  largeFileBytes: 256 * 1024,
  skillsLargeFileBytes: 512 * 1024,
};

/**
 * Merge partial user-supplied thresholds with the defaults.
 * Any field that is `undefined` or `null` falls back to the default.
 */
export function mergeThresholds(
  partial: Partial<Thresholds> | undefined | null,
): Thresholds {
  if (!partial) return { ...DEFAULT_THRESHOLDS };
  return {
    memoryWarnPercent: partial.memoryWarnPercent ?? DEFAULT_THRESHOLDS.memoryWarnPercent,
    memoryCriticalPercent: partial.memoryCriticalPercent ?? DEFAULT_THRESHOLDS.memoryCriticalPercent,
    hugeFileBytes: partial.hugeFileBytes ?? DEFAULT_THRESHOLDS.hugeFileBytes,
    crashLoopErrorCount: partial.crashLoopErrorCount ?? DEFAULT_THRESHOLDS.crashLoopErrorCount,
    crashLoopRecentErrors: partial.crashLoopRecentErrors ?? DEFAULT_THRESHOLDS.crashLoopRecentErrors,
    largeFileBytes: partial.largeFileBytes ?? DEFAULT_THRESHOLDS.largeFileBytes,
    skillsLargeFileBytes: partial.skillsLargeFileBytes ?? DEFAULT_THRESHOLDS.skillsLargeFileBytes,
  };
}
