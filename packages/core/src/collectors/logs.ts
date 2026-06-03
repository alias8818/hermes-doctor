import * as path from "node:path";

import type { CollectorResult } from "../schemas/collector.js";
import { listDir, readTextFile, statSafe } from "../utils/fs.js";
import type { CollectorContext } from "./context.js";
import type { LogsData } from "./data.js";
import { addEvidence, finalize, newAccumulator, runArea } from "./result.js";

const EMPTY: LogsData = {};
const MAX_RECENT_ERRORS = 20;

type ErrorType = keyof NonNullable<LogsData["errorTypes"]>;
type RecentError = NonNullable<LogsData["recentErrors"]>[number];

const ERROR_LINE = /\b(error|exception|fatal|failed|failure|panic)\b/i;
const TIMESTAMP =
  /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/;

// HTTP status codes only count as auth/rate-limit errors in HTTP response context
const HTTP_STATUS_KEYWORDS =
  /\b(?:status|code|http|response|returned|got|received)\b[:\s=]*/i;

const CLASSIFIERS: Array<{ type: ErrorType; pattern: RegExp }> = [
  {
    type: "auth",
    pattern: /\bunauthor|\binvalid (?:api )?key\b|\bauthenticat|\bforbidden|not authorized/i,
  },
  { type: "rate_limit", pattern: /rate.?limit|too many requests|\bquota\b/i },
  { type: "mcp", pattern: /\bmcp\b|tool server|stdio server|server-[a-z]/i },
  { type: "permission", pattern: /permission|eacces|access denied|read-?only|operation not permitted/i },
  { type: "network", pattern: /econnrefused|etimedout|enotfound|network|fetch failed|socket|dns/i },
  { type: "model", pattern: /\bmodel\b|completion|context (?:length|window)|token limit|max tokens/i },
];

// Extra pass for HTTP status codes: 401/403/429 only count when preceded by HTTP context
const HTTP_AUTH_PATTERN = new RegExp(
  HTTP_STATUS_KEYWORDS.source + "(401|403)\\b",
  "i",
);
const HTTP_RATELIMIT_PATTERN = new RegExp(
  HTTP_STATUS_KEYWORDS.source + "429\\b",
  "i",
);

export function classify(line: string): ErrorType {
  // Check HTTP status code patterns first (require context)
  if (HTTP_AUTH_PATTERN.test(line)) return "auth";
  if (HTTP_RATELIMIT_PATTERN.test(line)) return "rate_limit";
  for (const { type, pattern } of CLASSIFIERS) {
    if (pattern.test(line)) return type;
  }
  return "unknown";
}

function lastLines(content: string, limit: number): string[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.slice(-limit);
}

export async function collectLogs(
  ctx: CollectorContext,
): Promise<CollectorResult<LogsData>> {
  return runArea("logs", EMPTY, ctx.redaction, async () => {
    const acc = newAccumulator();
    const logsDir = ctx.paths.logsDir;

    addEvidence(acc, "Logs dir", logsDir);

    const entries = await listDir(logsDir);
    if (entries === null) {
      acc.warnings.push(`logs directory not found: ${logsDir}`);
      const maxLinesRead = ctx.maxLogLines ?? 500;
      const data: LogsData = {
        logFiles: [],
        logFile: null,
        errorCount: 0,
        recentErrors: [],
        errorTypes: emptyCounts(),
        maxLinesRead,
      };
      return finalize("logs", "skipped", data, acc, ctx.redaction);
    }

    const logNames = entries
      .filter((entry) => entry.isFile && /\.log$|\.log\.\d+$|\.txt$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort();

    if (logNames.length === 0) {
      acc.warnings.push("no log files found");
      const maxLinesRead = ctx.maxLogLines ?? 500;
      const data: LogsData = {
        logFiles: [],
        logFile: null,
        errorCount: 0,
        recentErrors: [],
        errorTypes: emptyCounts(),
        maxLinesRead,
      };
      return finalize("logs", "partial", data, acc, ctx.redaction);
    }

    const maxLinesRead = ctx.maxLogLines ?? 500;
    const logFiles: NonNullable<LogsData["logFiles"]> = [];
    const errorTypes = emptyCounts();
    const recentErrors: RecentError[] = [];
    let errorCount = 0;
    let remaining = maxLinesRead;

    const maxLogFileBytes = ctx.thresholds.hugeFileBytes ?? 104_857_600; // 100 MB default

    for (const name of logNames) {
      const filePath = path.join(logsDir, name);
      const stat = await statSafe(filePath);

      // Skip files that are too large to safely read into memory
      if (stat !== null && stat.size > maxLogFileBytes) {
        logFiles.push({
          path: filePath,
          readable: false,
          sizeBytes: stat.size,
          linesRead: 0,
        });
        acc.warnings.push(
          `log file exceeds size limit (${(stat.size / 1_048_576).toFixed(1)} MB > ${(maxLogFileBytes / 1_048_576).toFixed(0)} MB) and was skipped: ${name}`,
        );
        continue;
      }

      const read = await readTextFile(filePath);
      if (!read.ok || read.content === null) {
        logFiles.push({
          path: filePath,
          readable: false,
          sizeBytes: stat?.size ?? 0,
          linesRead: 0,
        });
        acc.warnings.push(`log file not readable: ${name}`);
        continue;
      }

      const lines = lastLines(read.content, remaining);
      remaining = Math.max(0, remaining - lines.length);
      const logFileEntry: NonNullable<NonNullable<LogsData["logFiles"]>[0]> = {
        path: filePath,
        readable: true,
        sizeBytes: stat?.size ?? read.sizeBytes,
        linesRead: lines.length,
      };

      // Include snippet if requested
      if (ctx.includeLogSnippets) {
        const snippetLines = lines.slice(-20);
        logFileEntry.snippet = snippetLines.join("\n");
      }

      logFiles.push(logFileEntry);

      for (const line of lines) {
        if (!ERROR_LINE.test(line)) continue;
        errorCount += 1;
        const type = classify(line);
        errorTypes[type] = (errorTypes[type] ?? 0) + 1;
        if (recentErrors.length < MAX_RECENT_ERRORS) {
          const ts = line.match(TIMESTAMP)?.[1] ?? null;
          recentErrors.push({
            timestamp: ts,
            message: line.slice(0, 500),
            type,
          });
        }
      }

      if (remaining === 0) break;
    }

    addEvidence(
      acc,
      "Errors",
      `${errorCount} error line(s) across ${logFiles.length} file(s)`,
    );

    const data: LogsData = {
      logFiles,
      logFile: logFiles[0]?.path ?? null,
      errorCount,
      recentErrors,
      errorTypes,
      maxLinesRead,
    };

    return finalize("logs", "collected", data, acc, ctx.redaction);
  });
}

function emptyCounts(): NonNullable<LogsData["errorTypes"]> {
  return {
    auth: 0,
    model: 0,
    mcp: 0,
    permission: 0,
    rate_limit: 0,
    network: 0,
    unknown: 0,
  };
}
