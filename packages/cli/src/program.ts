import { Command } from "commander";

import { registerExportCommand } from "./commands/export.js";
import { registerPathsCommand } from "./commands/paths.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerVersionCommand } from "./commands/version.js";
import { VERSION } from "./version.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("hermes-doctor")
    .description("Local-first diagnostic CLI for the Hermes Agent")
    .version(VERSION, "-V, --version", "Print the hermes-doctor version");

  registerExportCommand(program);
  registerPathsCommand(program);
  registerScanCommand(program);
  registerVersionCommand(program);

  return program;
}
