import * as path from "node:path";

import type { CollectorResult } from "../schemas/collector.js";
import { runCommand } from "../utils/exec.js";
import { statSafe } from "../utils/fs.js";
import { envForTrustedProbes } from "../utils/trusted-path.js";
import { findExecutable } from "../utils/which.js";
import type { CollectorContext } from "./context.js";
import type { InstallData } from "./data.js";
import { addEvidence, finalize, newAccumulator, runArea } from "./result.js";

const EMPTY: InstallData = { installMethod: "unknown" };

function inferInstallMethod(
  executablePath: string | null,
): InstallData["installMethod"] {
  if (!executablePath) return "unknown";
  const lower = executablePath.toLowerCase();
  if (lower.includes("node_modules") || lower.includes("npm") || lower.includes("pnpm")) {
    return "npm";
  }
  if (lower.includes("pipx") || lower.includes("site-packages") || lower.includes("python")) {
    return "pip";
  }
  return "binary";
}

export async function collectInstall(
  ctx: CollectorContext,
): Promise<CollectorResult<InstallData>> {
  return runArea("install", EMPTY, ctx.redaction, async () => {
    const acc = newAccumulator();

    const probeEnv = envForTrustedProbes(ctx.env, [path.join(ctx.hermesHome, "bin")]);
    const executablePath = await findExecutable("hermes", probeEnv);
    const onPath = executablePath !== null;

    if (!onPath) {
      acc.warnings.push("hermes executable not found on PATH");
      const data: InstallData = {
        executablePath: null,
        onPath: false,
        versionString: null,
        versionExitCode: null,
        installMethod: "unknown",
        permissionOk: false,
      };
      return finalize("install", "collected", data, acc, ctx.redaction);
    }

    addEvidence(acc, "Executable", executablePath, "PATH");

    const stat = await statSafe(executablePath);
    const permissionOk = stat !== null;

    const version = await runCommand(executablePath, {
      args: ["--version"],
      timeoutMs: ctx.commandTimeoutMs,
      env: probeEnv,
    });

    const versionString =
      version.found && version.stdout.trim().length > 0
        ? version.stdout.split(/\r?\n/)[0]?.trim() ?? null
        : null;

    if (versionString) {
      addEvidence(acc, "Version", versionString);
    } else if (version.timedOut) {
      acc.warnings.push("hermes --version timed out");
    } else if (version.failed) {
      acc.warnings.push("hermes --version exited non-zero");
    }

    const data: InstallData = {
      executablePath,
      onPath: true,
      versionString,
      versionExitCode: version.exitCode,
      installMethod: inferInstallMethod(executablePath),
      permissionOk,
    };

    return finalize("install", "collected", data, acc, ctx.redaction);
  });
}
