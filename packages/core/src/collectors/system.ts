import type { CollectorResult } from "../schemas/collector.js";
import { runCommand } from "../utils/exec.js";
import { getPlatformInfo } from "../utils/platform.js";
import type { CollectorContext } from "./context.js";
import type { SystemData } from "./data.js";
import { addEvidence, finalize, newAccumulator, runArea } from "./result.js";

const EMPTY: SystemData = {};

export async function collectSystem(
  ctx: CollectorContext,
): Promise<CollectorResult<SystemData>> {
  return runArea("system", EMPTY, ctx.redaction, async () => {
    const acc = newAccumulator();
    const info = getPlatformInfo(ctx.env);

    addEvidence(acc, "OS", `${info.os} (${info.arch})`);
    addEvidence(acc, "Node.js", info.nodeVersion);

    const docker = await detectVersion(ctx, "docker");
    if (docker) {
      addEvidence(acc, "Docker", docker);
    } else {
      acc.warnings.push("docker not detected on PATH");
    }

    const git = await detectVersion(ctx, "git");
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
): Promise<string | null> {
  const result = await runCommand(command, {
    args: ["--version"],
    timeoutMs: ctx.commandTimeoutMs,
    env: ctx.env,
  });
  if (!result.found || result.exitCode !== 0) return null;
  const line = result.stdout.split(/\r?\n/)[0]?.trim();
  return line && line.length > 0 ? line : null;
}
