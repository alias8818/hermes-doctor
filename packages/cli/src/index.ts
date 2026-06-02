#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildProgram } from "./program.js";

export { buildProgram } from "./program.js";
export { VERSION } from "./version.js";

const isDirectRun =
  process.argv[1] !== undefined &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (isDirectRun) {
  const rawArgs = process.argv.slice(2);
  // `pnpm dev -- <args>` forwards a literal `--` separator; drop it so flags parse.
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  const program = buildProgram();

  if (args.length === 0) {
    // Bare invocation: run a scan against the default Hermes home
    program.parseAsync(["scan"], { from: "user" }).catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
  } else {
    // If the first argument is an option flag that isn't a known program-level
    // option (--help, -h, --version, -V), assume it's meant for the scan
    // subcommand and prepend "scan". This allows:
    //   hermes-doctor --hermes-home /path   →   hermes-doctor scan --hermes-home /path
    //   hermes-doctor --format json         →   hermes-doctor scan --format json
    // While preserving normal command dispatch:
    //   hermes-doctor scan --hermes-home /path   → unchanged
    //   hermes-doctor --help                     → unchanged
    const first = args[0]!;
    const isKnownProgramOption = first === "--help" || first === "-h" || first === "--version" || first === "-V";
    if (first.startsWith("-") && !isKnownProgramOption) {
      program.parseAsync(["scan", ...args], { from: "user" }).catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      });
    } else {
      program.parseAsync(args, { from: "user" }).catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      });
    }
  }
}
