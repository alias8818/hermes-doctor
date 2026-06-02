import type {
  ConfigSnapshot,
  DashboardSnapshot,
  InstallSnapshot,
  LogsSnapshot,
  McpSnapshot,
  MemorySnapshot,
  PluginsSnapshot,
  ProviderSnapshot,
  SecuritySnapshot,
  SkillsSnapshot,
  SystemSnapshot,
} from "../schemas/snapshot.js";

type AreaData<T> = Omit<T, "status" | "warnings" | "errors">;

export type SystemData = AreaData<SystemSnapshot>;
export type InstallData = AreaData<InstallSnapshot>;
export type ConfigData = AreaData<ConfigSnapshot>;
export type DashboardData = AreaData<DashboardSnapshot>;
export type ProviderData = AreaData<ProviderSnapshot>;
export type McpData = AreaData<McpSnapshot>;
export type MemoryData = AreaData<MemorySnapshot>;
export type SkillsData = AreaData<SkillsSnapshot>;
export type PluginsData = AreaData<PluginsSnapshot>;
export type LogsData = AreaData<LogsSnapshot>;
export type SecurityData = AreaData<SecuritySnapshot>;
