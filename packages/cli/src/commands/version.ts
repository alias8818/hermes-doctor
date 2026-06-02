import type { Command } from "commander";

import { VERSION } from "../version.js";

export function registerVersionCommand(program: Command): void {
  program
    .command("version")
    .description("Print the hermes-doctor version")
    .action(() => {
      process.stdout.write(`${VERSION}\n`);
    });
}
