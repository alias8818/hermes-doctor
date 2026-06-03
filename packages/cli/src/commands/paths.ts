import * as fs from "node:fs";

import type { Command } from "commander";

import { resolveHermesHome, hermesPaths } from "@hermes-doctor/core";

interface PathsOptions {
  hermesHome?: string;
  profile?: string;
}

export function registerPathsCommand(program: Command): void {
  program
    .command("paths")
    .description("Print detected Hermes paths")
    .option("--hermes-home <path>", "Path to the Hermes home directory")
    .option("--profile <name>", "Hermes profile to scan")
    .action((options: PathsOptions) => {
      const home = resolveHermesHome({ hermesHome: options.hermesHome });

      // If --hermes-home was explicitly provided, validate the path like scan command (issue #65)
      if (options.hermesHome !== undefined) {
        try {
          fs.accessSync(home, fs.constants.F_OK);
        } catch {
          process.stderr.write(
            `Error: Hermes home path does not exist: ${home}
`,
          );
          process.exitCode = 1;
          return;
        }
        try {
          fs.accessSync(home, fs.constants.R_OK);
        } catch {
          process.stderr.write(
            `Error: Hermes home path is not readable: ${home}
`,
          );
          process.exitCode = 1;
          return;
        }
      }

      const profile = options.profile ?? process.env.HERMES_PROFILE ?? "default";
      const hp = hermesPaths(home);

      process.stdout.write(`Hermes Home:    ${home}\n`);
      process.stdout.write(`Config:         ${hp.config}\n`);
      process.stdout.write(`Env File:       ${hp.envFile}\n`);
      process.stdout.write(`Skills Dir:     ${hp.skillsDir}\n`);
      process.stdout.write(`Memory Dir:     ${hp.memoryDir}\n`);
      process.stdout.write(`Plugins Dir:    ${hp.pluginsDir}\n`);
      process.stdout.write(`Logs Dir:       ${hp.logsDir}\n`);
      process.stdout.write(`Profile:        ${profile}\n`);

      // Check which paths actually exist
      process.stdout.write(`\nAccessible paths:\n`);
      for (const [label, p] of Object.entries({
        "Home exists": home,
        "Config exists": hp.config,
        "Env file exists": hp.envFile,
        "Skills dir exists": hp.skillsDir,
        "Memory dir exists": hp.memoryDir,
        "Plugins dir exists": hp.pluginsDir,
        "Logs dir exists": hp.logsDir,
      })) {
        try {
          process.stdout.write(`  ${label}: ${fs.existsSync(p) ? "yes" : "no"}\n`);
        } catch {
          process.stdout.write(`  ${label}: error checking\n`);
        }
      }
    });
}
