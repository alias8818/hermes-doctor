import { execa } from "execa";

export const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;

export interface CommandResult {
  found: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  failed: boolean;
  error: string | null;
}

export interface RunCommandOptions {
  args?: string[];
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export async function runCommand(
  file: string,
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  const timeout = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  try {
    const result = await execa(file, options.args ?? [], {
      timeout,
      reject: false,
      cwd: options.cwd,
      env: options.env,
      stripFinalNewline: true,
      windowsHide: true,
    });

    const code: unknown = (result as { code?: unknown }).code;
    const notFound = code === "ENOENT";

    return {
      found: !notFound,
      exitCode: typeof result.exitCode === "number" ? result.exitCode : null,
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : "",
      timedOut: Boolean(result.timedOut),
      failed: Boolean(result.failed),
      error: result.failed ? (result.shortMessage ?? null) : null,
    };
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return {
      found: code !== "ENOENT",
      exitCode: null,
      stdout: "",
      stderr: "",
      timedOut: Boolean((error as { timedOut?: boolean }).timedOut),
      failed: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
