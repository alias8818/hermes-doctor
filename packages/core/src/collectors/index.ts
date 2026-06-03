import type { CollectorResult } from "../schemas/collector.js";
import { collectConfig } from "./config.js";
import {
  createCollectorContext,
  type CollectorContext,
  type CreateCollectorContextOptions,
} from "./context.js";
import { collectDashboard } from "./dashboard.js";
import type {
  ConfigData,
  DashboardData,
  InstallData,
  LogsData,
  McpData,
  MemoryData,
  PluginsData,
  ProviderData,
  SecurityData,
  SkillsData,
  SystemData,
} from "./data.js";
import { collectInstall } from "./install.js";
import { collectLogs } from "./logs.js";
import { collectMcp } from "./mcp.js";
import { collectMemory } from "./memory.js";
import { collectPlugins } from "./plugins.js";
import { collectProviders } from "./providers.js";
import { collectSecurity } from "./security.js";
import { collectSkills } from "./skills.js";
import { collectSystem } from "./system.js";

export * from "./context.js";
export * from "./data.js";
export * from "./probe.js";
export * from "./result.js";
export { collectSystem } from "./system.js";
export { collectInstall } from "./install.js";
export { collectConfig } from "./config.js";
export { collectDashboard } from "./dashboard.js";
export { collectProviders } from "./providers.js";
export { collectMcp } from "./mcp.js";
export { collectMemory } from "./memory.js";
export { collectSkills } from "./skills.js";
export { collectPlugins } from "./plugins.js";
export { collectLogs } from "./logs.js";
export { collectSecurity } from "./security.js";

export interface CollectorResults {
  system: CollectorResult<SystemData>;
  install: CollectorResult<InstallData>;
  config: CollectorResult<ConfigData>;
  dashboard: CollectorResult<DashboardData>;
  providers: CollectorResult<ProviderData>;
  mcp: CollectorResult<McpData>;
  memory: CollectorResult<MemoryData>;
  skills: CollectorResult<SkillsData>;
  plugins: CollectorResult<PluginsData>;
  logs: CollectorResult<LogsData>;
  security: CollectorResult<SecurityData>;
}

const COLLECT_ALL_TIMEOUT_MS = 60_000;

export async function collectAll(
  options: CollectorContext | CreateCollectorContextOptions = {},
): Promise<CollectorResults> {
  const ctx = isContext(options) ? options : createCollectorContext(options);

  const collectorPromises = Promise.all([
    collectSystem(ctx),
    collectInstall(ctx),
    collectConfig(ctx),
    collectDashboard(ctx),
    collectProviders(ctx),
    collectMcp(ctx),
    collectMemory(ctx),
    collectSkills(ctx),
    collectPlugins(ctx),
    collectLogs(ctx),
    collectSecurity(ctx),
  ]);

  const collected = await Promise.race([
    collectorPromises,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("collectAll timed out after " + COLLECT_ALL_TIMEOUT_MS + "ms")), COLLECT_ALL_TIMEOUT_MS);
    }),
  ]);

  const [
    system,
    install,
    config,
    dashboard,
    providers,
    mcp,
    memory,
    skills,
    plugins,
    logs,
    security,
  ] = collected;

  return {
    system,
    install,
    config,
    dashboard,
    providers,
    mcp,
    memory,
    skills,
    plugins,
    logs,
    security,
  };
}

function isContext(
  value: CollectorContext | CreateCollectorContextOptions,
): value is CollectorContext {
  return (
    "paths" in value &&
    "hermesHome" in value &&
    "redaction" in value &&
    "dashboardTimeoutMs" in value
  );
}
