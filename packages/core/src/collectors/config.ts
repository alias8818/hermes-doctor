import type { CollectorResult } from "../schemas/collector.js";
import {
  asArray,
  asRecord,
  asString,
  loadHermesConfig,
} from "../utils/config.js";
import { statSafe } from "../utils/fs.js";
import type { CollectorContext } from "./context.js";
import type { ConfigData } from "./data.js";
import { addEvidence, finalize, newAccumulator, runArea } from "./result.js";

const EMPTY: ConfigData = {};

const KNOWN_SECTIONS: Record<string, string[]> = {
  providers: ["providers", "models"],
  mcp: ["mcp"],
  mcp_servers: ["mcp_servers", "mcpServers"],
  dashboard: ["dashboard", "ui", "server"],
  memory: ["memory"],
  skills: ["skills"],
  plugins: ["plugins"],
  security: ["security"],
};

function detectSections(
  parsed: Record<string, unknown>,
): Record<string, boolean> {
  const sections: Record<string, boolean> = {};
  for (const [section, aliases] of Object.entries(KNOWN_SECTIONS)) {
    sections[section] = aliases.some(
      (alias) => alias in parsed && parsed[alias] !== undefined && parsed[alias] !== null,
    );
  }
  return sections;
}

function detectProfiles(
  parsed: Record<string, unknown>,
  active: string,
): string[] {
  const profiles = new Set<string>([active]);
  const profilesField = parsed.profiles;
  const asList = asArray(profilesField);
  if (asList) {
    for (const entry of asList) {
      const name = asString(entry) ?? asString(asRecord(entry)?.name);
      if (name) profiles.add(name);
    }
  } else {
    const profileRecord = asRecord(profilesField);
    if (profileRecord) {
      for (const key of Object.keys(profileRecord)) profiles.add(key);
    }
  }
  const activeProfile = asString(parsed.profile);
  if (activeProfile) profiles.add(activeProfile);
  return [...profiles];
}

export async function collectConfig(
  ctx: CollectorContext,
): Promise<CollectorResult<ConfigData>> {
  return runArea("config", EMPTY, ctx.redaction, async () => {
    const acc = newAccumulator();
    const { paths } = ctx;

    const homeExists = (await statSafe(paths.home)) !== null;
    const config = await loadHermesConfig(paths.config);

    addEvidence(acc, "Home", paths.home);
    addEvidence(acc, "Config path", paths.config);

    if (!homeExists) {
      acc.warnings.push(`Hermes home does not exist: ${paths.home}`);
    }

    if (!config.exists) {
      acc.warnings.push("config.yaml not found");
      const data: ConfigData = {
        homePath: paths.home,
        homeExists,
        configPath: paths.config,
        configExists: false,
        configValid: false,
        parseError: null,
        profiles: [],
        sections: {},
        schemaErrors: [],
      };
      return finalize("config", "partial", data, acc, ctx.redaction);
    }

    if (!config.valid || config.parsed === null) {
      acc.errors.push(`config.yaml parse error: ${config.error ?? "invalid"}`);
      const data: ConfigData = {
        homePath: paths.home,
        homeExists,
        configPath: paths.config,
        configExists: true,
        configValid: false,
        parseError: config.error,
        profiles: [],
        sections: {},
        schemaErrors: [],
      };
      return finalize("config", "failed", data, acc, ctx.redaction);
    }

    const sections = detectSections(config.parsed);
    const profiles = detectProfiles(config.parsed, ctx.profile);

    addEvidence(
      acc,
      "Sections",
      Object.entries(sections)
        .filter(([, present]) => present)
        .map(([name]) => name)
        .join(", ") || "none",
    );

    const data: ConfigData = {
      homePath: paths.home,
      homeExists,
      configPath: paths.config,
      configExists: true,
      configValid: true,
      parseError: null,
      profiles,
      sections,
      schemaErrors: [],
    };

    return finalize("config", "collected", data, acc, ctx.redaction);
  });
}
