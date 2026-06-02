import * as os from "node:os";
import * as path from "node:path";

import fg from "fast-glob";

import { REDACTION_PATTERNS } from "../redaction/index.js";
import type { CollectorResult } from "../schemas/collector.js";
import {
  asBoolean,
  asRecord,
  asString,
  loadHermesConfig,
  pick,
} from "../utils/config.js";
import { readTextFile, statSafe } from "../utils/fs.js";
import type { CollectorContext } from "./context.js";
import type { SecurityData } from "./data.js";
import { isPublicBindAddress, parseHost } from "./probe.js";
import { addEvidence, finalize, newAccumulator, runArea } from "./result.js";

const EMPTY: SecurityData = {};

type SecretLeak = NonNullable<SecurityData["secretLeaks"]>[number];
type PermissionIssue = NonNullable<SecurityData["permissionIssues"]>[number];
type DynamicExecBlock = NonNullable<SecurityData["dynamicExecBlocks"]>[number];

const SECRET_FILES = ["config.yaml", ".env", "auth.json", "credentials.json"];

const DYNAMIC_EXEC_PATTERNS: Array<{ label: string; pattern: RegExp; risk: string }> = [
  { label: "shell substitution", pattern: /\$\([^)]+\)/, risk: "high" },
  { label: "backtick execution", pattern: /`[^`]+`/, risk: "high" },
  { label: "eval", pattern: /\beval\s*\(/, risk: "high" },
  { label: "exec", pattern: /\b(?:os\.system|subprocess|child_process|exec(?:Sync)?)\b/, risk: "medium" },
];

function maskSecret(value: string): string {
  const length = Math.min(12, Math.max(6, value.length));
  return "*".repeat(length);
}

function findLeaks(content: string, location: string): SecretLeak[] {
  const leaks: SecretLeak[] = [];
  for (const { type, regex } of REDACTION_PATTERNS) {
    const matcher = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(content)) !== null) {
      leaks.push({
        location,
        secretType: type,
        maskedValue: maskSecret(match[0]),
      });
      if (match.index === matcher.lastIndex) matcher.lastIndex += 1;
    }
  }
  return leaks;
}

function findDynamicExec(content: string, location: string): DynamicExecBlock[] {
  const blocks: DynamicExecBlock[] = [];
  for (const { label, pattern, risk } of DYNAMIC_EXEC_PATTERNS) {
    if (pattern.test(content)) {
      blocks.push({ location, pattern: label, riskLevel: risk });
    }
  }
  return blocks;
}

export async function collectSecurity(
  ctx: CollectorContext,
): Promise<CollectorResult<SecurityData>> {
  return runArea("security", EMPTY, ctx.redaction, async () => {
    const acc = newAccumulator();
    const config = await loadHermesConfig(ctx.paths.config);
    const security = asRecord(pick(config.parsed, "security"));
    const dashboard =
      asRecord(pick(config.parsed, "dashboard", "ui", "server")) ?? null;

    const bindAddress =
      asString(pick(dashboard, "bind", "bind_address", "host", "hostname")) ??
      (asString(pick(dashboard, "url")) !== null
        ? parseHost(asString(pick(dashboard, "url")) ?? "")
        : null);
    const publicBinding = isPublicBindAddress(bindAddress);
    if (publicBinding) {
      addEvidence(acc, "Bind address", bindAddress ?? "unknown", "config.yaml");
    }

    const secretLeaks: SecretLeak[] = [];
    const dynamicExecBlocks: DynamicExecBlock[] = [];

    if (config.raw) {
      secretLeaks.push(...findLeaks(config.raw, "config.yaml"));
      dynamicExecBlocks.push(...findDynamicExec(config.raw, "config.yaml"));
    }

    const envRead = await readTextFile(ctx.paths.envFile);
    if (envRead.ok && envRead.content) {
      secretLeaks.push(...findLeaks(envRead.content, ".env"));
    }

    // Scan skill SKILL.md files for secrets
    const skillMdFiles = await fg(["**/SKILL.md"], {
      cwd: ctx.paths.skillsDir,
      onlyFiles: true,
      dot: true,
      suppressErrors: true,
    });
    for (const rel of skillMdFiles) {
      const absPath = path.join(ctx.paths.skillsDir, rel);
      const readResult = await readTextFile(absPath);
      if (readResult.ok && readResult.content) {
        secretLeaks.push(...findLeaks(readResult.content, absPath));
      }
    }

    // Scan plugin manifest files for secrets
    const pluginManifests = await fg(["**/{plugin.json,manifest.json,package.json}"], {
      cwd: ctx.paths.pluginsDir,
      onlyFiles: true,
      dot: true,
      suppressErrors: true,
    });
    for (const rel of pluginManifests) {
      const absPath = path.join(ctx.paths.pluginsDir, rel);
      const readResult = await readTextFile(absPath);
      if (readResult.ok && readResult.content) {
        secretLeaks.push(...findLeaks(readResult.content, absPath));
      }
    }

    const envExposure = secretLeaks.some((leak) => leak.location === "config.yaml");

    const exposedVars = Object.entries(ctx.env)
      .filter(([, value]) =>
        typeof value === "string" &&
        REDACTION_PATTERNS.some((p) => new RegExp(p.regex.source, p.regex.flags.replace("g", "")).test(value)),
      )
      .map(([key]) => key);

    const permissionIssues = await checkPermissions(ctx, secretLeaks);

    if (secretLeaks.length > 0) {
      acc.warnings.push(`${secretLeaks.length} potential secret(s) detected in config/env`);
    }

    // Read terminal.backend from top-level config (Hermes v24) first,
    // fall back to security.terminal_backend (legacy) for backward compatibility
    const topLevelTerminal = asRecord(pick(config.parsed, "terminal"));
    const terminalBackend = asString(
      pick(topLevelTerminal, "backend"),
    ) ?? asString(
      pick(security, "terminal_backend", "terminalBackend", "terminal"),
    );

    const data: SecurityData = {
      publicBinding,
      bindAddress: bindAddress ?? null,
      secretLeaks,
      terminalBackend,
      shellRestricted:
        asBoolean(pick(security, "shell_restricted", "restrict_shell", "restricted_shell")) ?? false,
      sandboxEnabled:
        asBoolean(pick(security, "sandbox", "sandbox_enabled", "sandboxed")) ?? false,
      permissionIssues,
      envExposure,
      exposedVars,
      dynamicExecBlocks,
    };

    return finalize("security", "collected", data, acc, ctx.redaction);
  });
}

async function checkPermissions(
  ctx: CollectorContext,
  secretLeaks: SecretLeak[],
): Promise<PermissionIssue[]> {
  if (os.platform() === "win32") return [];
  const issues: PermissionIssue[] = [];
  const hasConfigSecret = secretLeaks.some((l) => l.location === "config.yaml");

  for (const file of SECRET_FILES) {
    const target = path.join(ctx.paths.home, file);
    const stat = await statSafe(target);
    if (!stat) continue;
    const mode = stat.mode & 0o777;
    const groupOrOther = mode & 0o077;
    const isSensitive =
      file === ".env" ||
      file === "auth.json" ||
      file === "credentials.json" ||
      (file === "config.yaml" && hasConfigSecret);
    if (isSensitive && groupOrOther !== 0) {
      issues.push({
        path: target,
        currentMode: mode.toString(8).padStart(3, "0"),
        suggestedMode: "600",
      });
    }
  }
  return issues;
}
