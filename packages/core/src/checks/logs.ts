import type { HermesSnapshot } from "../schemas/snapshot.js";
import { safeFileMode, safePath } from "../utils/shell-safe.js";
import { evidence, finding, fix, type Check } from "./types.js";

/**
 * Check: Recent errors summarized.
 * VAL-LOGS-001: Recent errors summarized
 */
export const recentErrorsCheck: Check = {
  id: "logs-recent-errors",
  area: "logs",
  title: "Recent Errors Summary",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const logs = snapshot.logs;
    const errorCount = logs.errorCount ?? 0;
    const recentErrors = logs.recentErrors ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("error_count", String(errorCount), "log"),
      evidence("log_file", logs.logFile ?? "(not found)", "file"),
      evidence("recent_errors", JSON.stringify(
        recentErrors.map((e) => ({
          timestamp: e.timestamp,
          message: e.message,
        })),
      ), "log"),
    ];

    if (!logs.logFile && errorCount === 0) {
      return [
        finding(
          "logs-recent-errors",
          "logs",
          "ok",
          0,
          "No Log File",
          "No Hermes log file was found",
          ev,
        ),
      ];
    }

    if (errorCount === 0) {
      return [
        finding(
          "logs-recent-errors",
          "logs",
          "ok",
          0,
          "No Recent Errors",
          "No errors found in Hermes logs",
          ev,
        ),
      ];
    }

    // Determine if it's a crash loop (many errors in a short time)
    const isCrashLoop = errorCount > 50 || recentErrors.length > 20;

    return [
      finding(
        "logs-recent-errors",
        "logs",
        isCrashLoop ? "broken" : "warning",
        isCrashLoop ? 3 : 1,
        isCrashLoop ? "High Error Rate Detected" : "Recent Errors Found",
        `${errorCount} error(s) found in logs. ${recentErrors.length > 0 ? `Most recent: ${recentErrors[recentErrors.length - 1]?.message ?? "N/A"}` : ""}`,
        ev,
        [
          fix("View the full error log", {
            command: `less ${safePath(logs.logFile ?? "~/.hermes/logs/hermes.log")}`,
            risk: "low",
          }),
          fix("Search for common issues", {
            command: `grep -i "error\\|fatal\\|exception" ${safePath(logs.logFile ?? "~/.hermes/logs/hermes.log")}`,
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Errors classified by type.
 * VAL-LOGS-002: Errors classified by type
 */
export const errorClassificationCheck: Check = {
  id: "logs-error-classification",
  area: "logs",
  title: "Error Classification",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const logs = snapshot.logs;
    const errorTypes = logs.errorTypes;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("error_types", JSON.stringify(errorTypes ?? {}), "log"),
    ];

    if (!errorTypes) {
      return [
        finding(
          "logs-error-classification",
          "logs",
          "info",
          0,
          "No Error Classification",
          "No error type data available",
          ev,
        ),
      ];
    }

    const totalByType = Object.values(errorTypes as Record<string, number>).reduce((a, b) => a + b, 0);

    if (totalByType === 0) {
      return [
        finding(
          "logs-error-classification",
          "logs",
          "ok",
          0,
          "No Errors to Classify",
          "No errors found in logs",
          ev,
        ),
      ];
    }

    const typeEntries = Object.entries(errorTypes as Record<string, number>)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${type}: ${count}`);

    return [
      finding(
        "logs-error-classification",
        "logs",
        totalByType > 0 ? "warning" : "ok",
        1,
        "Error Classification",
        `${totalByType} error(s) classified: ${typeEntries.join(", ")}`,
        ev,
      ),
    ];
  },
};

/**
 * Check: Log file readability verified.
 * VAL-LOGS-003: Log file readability verified
 */
export const logReadabilityCheck: Check = {
  id: "logs-readability",
  area: "logs",
  title: "Log File Readability",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const logs = snapshot.logs;
    const logFiles = logs.logFiles ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("log_files", JSON.stringify(
        logFiles.map((f) => ({
          path: f.path,
          readable: f.readable,
          size_bytes: f.sizeBytes,
        })),
      ), "file"),
    ];

    if (logFiles.length === 0) {
      return [
        finding(
          "logs-readability",
          "logs",
          "info",
          0,
          "No Log Files",
          "No Hermes log files found",
          ev,
        ),
      ];
    }

    const unreadable = logFiles.filter((f) => !f.readable);

    if (unreadable.length === 0) {
      return [
        finding(
          "logs-readability",
          "logs",
          "ok",
          0,
          "Log Files Readable",
          `All ${logFiles.length} log file(s) are readable`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "logs-readability",
        "logs",
        "broken",
        3,
        "Unreadable Log Files",
        `${unreadable.length} log file(s) are not readable: ${unreadable.map((f) => f.path).join(", ")}`,
        ev,
        unreadable.map((f) =>
          fix(`Fix permissions for ${f.path}`, {
            command: `chmod ${safeFileMode("644")} ${safePath(f.path)}`,
            risk: "medium",
            requiresConfirmation: true,
            manualSteps: [
              `Run: chmod 644 ${f.path}`,
              "This makes the log file readable by the user",
            ],
            rollback: `chmod ${safeFileMode("600")} ${safePath(f.path)}`,
          }),
        ),
      ),
    ];
  },
};

/**
 * Check: Rate-limit errors detected.
 * VAL-LOGS-004: Rate limit errors detected
 */
export const rateLimitCheck: Check = {
  id: "logs-rate-limit",
  area: "logs",
  title: "Rate Limit Errors",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const logs = snapshot.logs;
    const errorTypes = logs.errorTypes;
    const rateLimitCount = errorTypes?.rate_limit ?? 0;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("error_types", JSON.stringify(errorTypes ?? {}), "log"),
      evidence("rate_limit_count", String(rateLimitCount), "log"),
    ];

    if (rateLimitCount === 0) {
      return [
        finding(
          "logs-rate-limit",
          "logs",
          "ok",
          0,
          "No Rate Limit Errors",
          "No rate limit errors (HTTP 429) detected in logs",
          ev,
        ),
      ];
    }

    return [
      finding(
        "logs-rate-limit",
        "logs",
        "warning",
          2,
        "Rate Limit Errors Detected",
        `${rateLimitCount} rate limit error(s) found in logs. Consider reducing concurrent requests or adding retry logic.`,
        ev,
        [
          fix("Reduce concurrency", {
            command: "Check your config for concurrent request settings and reduce them",
            risk: "low",
          }),
          fix("Add retry logic", {
            command: "Consider configuring retry with exponential backoff for rate-limited operations",
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/** All logs checks */
export const logsChecks: Check[] = [
  recentErrorsCheck,
  errorClassificationCheck,
  logReadabilityCheck,
  rateLimitCheck,
];
