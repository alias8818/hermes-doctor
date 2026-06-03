import type { CollectorResult } from "../schemas/collector.js";
import { runCommand } from "../utils/exec.js";
import { getPlatformInfo } from "../utils/platform.js";
import { envForTrustedProbes } from "../utils/trusted-path.js";
import { findExecutable } from "../utils/which.js";
import type { CollectorContext } from "./context.js";
import type { SystemData } from "./data.js";
import { addEvidence, finalize, runArea } from "./result.js";

const EMPTY: SystemData = {};

export async function collectSystem(
  ctx: CollectorContext,
): Promise<CollectorResult<SystemData>> {
  return runArea("system", EMPTY, ctx.redaction, async (acc) => {
    const info = getPlatformInfo(ctx.env);

    addEvidence(acc, "OS", `${info.os} (${info.arch})`);
    addEvidence(acc, "Node.js", info.nodeVersion);

    const probeEnv = envForTrustedProbes(ctx.env);
    const docker = await detectVersion(ctx, "docker", probeEnv);
    if (docker) {
      addEvidence(acc, "Docker", docker);
    } else {
      acc.warnings.push("docker not detected on PATH");
    }

    const git = await detectVersion(ctx, "git", probeEnv);
    if (git) {
      addEvidence(acc, "Git", git);
    } else {
      acc.warnings.push("git not detected on PATH");
    }

    const data: SystemData = {
      os: info.os,
      arch: info.arch,
      nodeVersion: info.nodeVersion,
      shell: info.shell,
      path: info.path,
      docker,
      git,
    };

    return finalize("system", "collected", data, acc, ctx.redaction);
  });
}

async function detectVersion(
  ctx: CollectorContext,
  command: string,
  probeEnv: NodeJS.ProcessEnv,
): Promise<string | null> {
  const executable = await findExecutable(command, probeEnv);
  if (!executable) return null;
  const result = await runCommand(executable, {
    args: ["--version"],
    timeoutMs: ctx.commandTimeoutMs,
    env: probeEnv,
  });
  if (!result.found || result.exitCode !== 0) return null;
  const line = result.stdout.split(/\r?\n/)[0]?.trim();
  return line && line.length > 0 ? line : null;
}
