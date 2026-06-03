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

    // Discover hermes in the scanned home (read-only — never execute from here)
    const homeBinHermes = path.join(ctx.hermesHome, "bin", "hermes");
    const homeBinStat = await statSafe(homeBinHermes);

    // Resolve hermes from trusted system directories only
    const sysProbeEnv = envForTrustedProbes(ctx.env);
    const systemHermes = await findExecutable("hermes", sysProbeEnv);

    // Execute only if found in a trusted system directory (not the scanned home)
    let executablePath: string | null = null;
    let versionString: string | null = null;
    let versionExitCode: number | null = null;

    if (systemHermes !== null) {
      executablePath = systemHermes;
      addEvidence(acc, "Executable", executablePath, "trusted system PATH");

      const version = await runCommand(executablePath, {
        args: ["--version"],
        timeoutMs: ctx.commandTimeoutMs,
        env: sysProbeEnv,
      });

      versionString =
        version.found && version.stdout.trim().length > 0
          ? version.stdout.split(/\r?\n/)[0]?.trim() ?? null
          : null;

      if (version.timedOut) {
        acc.warnings.push("hermes --version timed out");
      } else if (version.failed) {
        acc.warnings.push("hermes --version exited non-zero");
      }

      if (versionString) {
        addEvidence(acc, "Version", versionString);
      }

      versionExitCode = version.exitCode;
    } else if (homeBinStat !== null) {
      // Hermes found in the scanned home's bin/ directory — do NOT execute
      // attacker-controlled binaries. Record the location for transparency
      // but skip version detection.
      executablePath = homeBinHermes;
      addEvidence(acc, "Executable", executablePath, "scanned installation bin/");
      acc.warnings.push(
        "hermes found in scanned installation — skipping version probe for safety. " +
        "Install hermes to a system PATH directory (/usr/local/bin, /usr/bin) " +
        "for full install diagnostics.",
      );
      versionString = null;
      versionExitCode = null;
    } else {
      acc.warnings.push("hermes executable not found on trusted system PATH " +
        "and not found in installation bin/");
    }

    const onPath = executablePath !== null;

    // Permission check: home bin was already statted; system path needs a stat
    const permissionOk =
      executablePath === homeBinHermes
        ? homeBinStat !== null
        : (await statSafe(executablePath!)) !== null;

    if (!onPath) {
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

    const installMethod = inferInstallMethod(executablePath);

    const data: InstallData = {
      executablePath,
      onPath: true,
      versionString,
      versionExitCode,
      installMethod,
      permissionOk,
    };

    return finalize("install", "collected", data, acc, ctx.redaction);
  });
}
