import * as os from "node:os";

import type { RedactionSummary } from "../schemas/index.js";
import {
  REDACTION_PATTERNS,
  STRICT_REDACTION_PATTERNS,
  type RedactionPattern,
  type RedactionPatternType,
} from "./patterns.js";

export interface RedactionOptions {
  homeDir?: string | string[];
  redactHomePaths?: boolean;
  strictRedaction?: boolean;
}

export interface RedactionResult {
  value: string;
  summary: RedactionSummary;
}

export interface DeepRedactionResult {
  value: unknown;
  summary: RedactionSummary;
}

const HOME_PLACEHOLDER = "<HOME>";

const GENERIC_HOME_PATTERNS: RegExp[] = [
  /\/home\/[^/\s:"']+/g,
  /\/Users\/[^/\s:"']+/g,
  /[A-Za-z]:\\Users\\[^\\/\s:"']+/g,
];

export function createRedactionSummary(): RedactionSummary {
  return {
    redacted: false,
    count: 0,
    totalRedactions: 0,
    patterns: [],
    homePathRedactions: 0,
  };
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expandReplacement(template: string, args: unknown[]): string {
  return template.replace(/\$(\d)/g, (_, digit: string) => {
    const group = args[Number(digit)];
    return typeof group === "string" ? group : "";
  });
}

function applyPattern(
  input: string,
  { regex, replacement }: RedactionPattern,
): { output: string; count: number } {
  let count = 0;
  const output = input.replace(regex, (...args: unknown[]) => {
    count += 1;
    return expandReplacement(replacement, args);
  });
  return { output, count };
}

function resolveHomeDirs(homeDir?: string | string[]): string[] {
  const dirs = new Set<string>();
  const home = os.homedir();
  if (home) {
    dirs.add(home);
  }
  if (typeof homeDir === "string") {
    if (homeDir) dirs.add(homeDir);
  } else if (Array.isArray(homeDir)) {
    for (const dir of homeDir) {
      if (dir) dirs.add(dir);
    }
  }
  return [...dirs].sort((a, b) => b.length - a.length);
}

function redactHomePaths(
  input: string,
  homeDir?: string | string[],
): { output: string; count: number } {
  let output = input;
  let count = 0;

  for (const dir of resolveHomeDirs(homeDir)) {
    const regex = new RegExp(escapeRegExp(dir), "g");
    output = output.replace(regex, () => {
      count += 1;
      return HOME_PLACEHOLDER;
    });
    // JSON.stringify escapes backslashes (Windows paths in evidence details).
    const jsonEscaped = dir.replace(/\\/g, "\\\\");
    if (jsonEscaped !== dir) {
      const jsonRegex = new RegExp(escapeRegExp(jsonEscaped), "g");
      output = output.replace(jsonRegex, () => {
        count += 1;
        return HOME_PLACEHOLDER;
      });
    }
  }

  for (const regex of GENERIC_HOME_PATTERNS) {
    output = output.replace(regex, () => {
      count += 1;
      return HOME_PLACEHOLDER;
    });
  }

  return { output, count };
}

export function redact(
  input: string,
  options: RedactionOptions = {},
): RedactionResult {
  const summary = createRedactionSummary();

  if (typeof input !== "string" || input.length === 0) {
    return { value: input, summary };
  }

  const matchedPatterns = new Set<RedactionPatternType>();
  let output = input;

  for (const pattern of REDACTION_PATTERNS) {
    const { output: next, count } = applyPattern(output, pattern);
    if (count > 0) {
      output = next;
      summary.totalRedactions += count;
      matchedPatterns.add(pattern.type);
    }
  }

  // Apply strict redaction patterns when enabled
  if (options.strictRedaction) {
    for (const pattern of STRICT_REDACTION_PATTERNS) {
      const { output: next, count } = applyPattern(output, pattern);
      if (count > 0) {
        output = next;
        summary.totalRedactions += count;
        matchedPatterns.add(pattern.type);
      }
    }
  }

  if (options.redactHomePaths !== false) {
    const { output: next, count } = redactHomePaths(output, options.homeDir);
    output = next;
    summary.homePathRedactions += count;
  }

  summary.count = summary.totalRedactions;
  summary.patterns = [...matchedPatterns].sort();
  summary.redacted =
    summary.totalRedactions > 0 || summary.homePathRedactions > 0;

  return { value: output, summary };
}

export function mergeRedactionSummaries(
  ...summaries: RedactionSummary[]
): RedactionSummary {
  const merged = createRedactionSummary();
  const patterns = new Set<string>();

  for (const summary of summaries) {
    merged.totalRedactions += summary.totalRedactions;
    merged.homePathRedactions += summary.homePathRedactions;
    for (const pattern of summary.patterns) {
      patterns.add(pattern);
    }
  }

  merged.count = merged.totalRedactions;
  merged.patterns = [...patterns].sort();
  merged.redacted =
    merged.totalRedactions > 0 || merged.homePathRedactions > 0;

  return merged;
}

export function redactDeep(
  value: unknown,
  options: RedactionOptions = {},
): DeepRedactionResult {
  const summaries: RedactionSummary[] = [];

  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      const { value: redacted, summary } = redact(node, options);
      summaries.push(summary);
      return redacted;
    }
    if (Array.isArray(node)) {
      return node.map(walk);
    }
    if (node !== null && typeof node === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node)) {
        result[key] = walk(child);
      }
      return result;
    }
    return node;
  };

  const redactedValue = walk(value);
  return { value: redactedValue, summary: mergeRedactionSummaries(...summaries) };
}
