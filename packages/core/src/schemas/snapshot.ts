import * as v from "valibot";

import { CollectorStatusSchema } from "./common.js";

const areaStatus = {
  status: CollectorStatusSchema,
  warnings: v.optional(v.array(v.string())),
  errors: v.optional(v.array(v.string())),
};

export const SystemSnapshotSchema = v.object({
  ...areaStatus,
  os: v.optional(v.string()),
  arch: v.optional(v.string()),
  nodeVersion: v.optional(v.string()),
  shell: v.optional(v.nullable(v.string())),
  path: v.optional(v.array(v.string())),
  docker: v.optional(v.nullable(v.string())),
  git: v.optional(v.nullable(v.string())),
});
export type SystemSnapshot = v.InferOutput<typeof SystemSnapshotSchema>;

export const InstallSnapshotSchema = v.object({
  ...areaStatus,
  executablePath: v.optional(v.nullable(v.string())),
  onPath: v.optional(v.boolean()),
  versionString: v.optional(v.nullable(v.string())),
  versionExitCode: v.optional(v.nullable(v.number())),
  installMethod: v.optional(
    v.picklist(["npm", "pip", "binary", "docker", "unknown"]),
  ),
  permissionOk: v.optional(v.boolean()),
});
export type InstallSnapshot = v.InferOutput<typeof InstallSnapshotSchema>;

export const ConfigSnapshotSchema = v.object({
  ...areaStatus,
  homePath: v.optional(v.nullable(v.string())),
  homeExists: v.optional(v.boolean()),
  configPath: v.optional(v.nullable(v.string())),
  configExists: v.optional(v.boolean()),
  configValid: v.optional(v.boolean()),
  parseError: v.optional(v.nullable(v.string())),
  profiles: v.optional(v.array(v.string())),
  sections: v.optional(v.record(v.string(), v.boolean())),
  schemaErrors: v.optional(v.array(v.string())),
});
export type ConfigSnapshot = v.InferOutput<typeof ConfigSnapshotSchema>;

export const DashboardSnapshotSchema = v.object({
  ...areaStatus,
  url: v.optional(v.nullable(v.string())),
  reachable: v.optional(v.boolean()),
  statusCode: v.optional(v.nullable(v.number())),
  responseTimeMs: v.optional(v.nullable(v.number())),
  bindAddress: v.optional(v.nullable(v.string())),
  isLocalhost: v.optional(v.boolean()),
  authRequired: v.optional(v.boolean()),
  tls: v.optional(v.boolean()),
  certValid: v.optional(v.nullable(v.boolean())),
  probed: v.optional(v.boolean()),
});
export type DashboardSnapshot = v.InferOutput<typeof DashboardSnapshotSchema>;

export const ProviderEntrySchema = v.object({
  name: v.string(),
  requiredEnv: v.optional(v.array(v.string())),
  envSet: v.optional(v.boolean()),
});

export const LocalEndpointSchema = v.object({
  url: v.string(),
  reachable: v.boolean(),
  latencyMs: v.nullable(v.number()),
});

export const KeyCheckSchema = v.object({
  provider: v.string(),
  formatOk: v.boolean(),
});

export const CustomProviderEntrySchema = v.object({
  name: v.string(),
  baseUrl: v.optional(v.nullable(v.string())),
  isBuiltIn: v.boolean(),
});

export const ModelRefSchema = v.object({
  modelName: v.string(),
  providerRef: v.optional(v.nullable(v.string())),
  providerExists: v.optional(v.boolean()),
  isDefault: v.optional(v.boolean()),
});

export const AuthInfoSchema = v.object({
  activeProvider: v.optional(v.nullable(v.string())),
  hasSecrets: v.optional(v.boolean()),
});

export const ProviderSnapshotSchema = v.object({
  ...areaStatus,
  defaultModel: v.optional(v.nullable(v.string())),
  activeProviderBackend: v.optional(v.nullable(v.string())),
  modelAliases: v.optional(v.record(v.string(), v.string())),
  modelsConfigured: v.optional(v.number()),
  providers: v.optional(v.array(ProviderEntrySchema)),
  localEndpoints: v.optional(v.array(LocalEndpointSchema)),
  keyChecks: v.optional(v.array(KeyCheckSchema)),
  customProviders: v.optional(v.array(CustomProviderEntrySchema)),
  modelReferences: v.optional(v.array(ModelRefSchema)),
  authInfo: v.optional(v.nullable(AuthInfoSchema)),
});
export type ProviderSnapshot = v.InferOutput<typeof ProviderSnapshotSchema>;

export const McpExpectedEnvSchema = v.object({
  key: v.string(),
  set: v.boolean(),
});

export const McpToolsFilterSchema = v.object({
  enabled: v.boolean(),
  includes: v.optional(v.array(v.string())),
  excludes: v.optional(v.array(v.string())),
});

export const McpServerSchema = v.object({
  name: v.string(),
  command: v.optional(v.nullable(v.string())),
  executableFound: v.optional(v.boolean()),
  transport: v.optional(v.nullable(v.string())),
  transportValid: v.optional(v.boolean()),
  expectedEnv: v.optional(v.array(McpExpectedEnvSchema)),
  toolsFilter: v.optional(v.nullable(McpToolsFilterSchema)),
});

export const McpSnapshotSchema = v.object({
  ...areaStatus,
  servers: v.optional(v.array(McpServerSchema)),
});
export type McpSnapshot = v.InferOutput<typeof McpSnapshotSchema>;

export const MemoryFileSchema = v.object({
  name: v.string(),
  sizeBytes: v.number(),
  large: v.boolean(),
});

export const MemorySecretSchema = v.object({
  file: v.string(),
  secretType: v.string(),
});

export const MemorySnapshotSchema = v.object({
  ...areaStatus,
  memoryDir: v.optional(v.nullable(v.string())),
  fileCount: v.optional(v.number()),
  readable: v.optional(v.boolean()),
  dirExists: v.optional(v.boolean()),
  files: v.optional(v.array(MemoryFileSchema)),
  totalSizeBytes: v.optional(v.number()),
  limitBytes: v.optional(v.nullable(v.number())),
  usagePercent: v.optional(v.nullable(v.number())),
  externalProvider: v.optional(v.nullable(v.string())),
  externalOk: v.optional(v.nullable(v.boolean())),
  secrets: v.optional(v.array(MemorySecretSchema)),
  /** True when a memory-relevant plugin or provider is configured under a non-standard config section */
  misplacedConfig: v.optional(v.nullable(v.boolean())),
  /** Details about the misplaced config (section name and plugin names) */
  misplacedConfigDetails: v.optional(v.nullable(v.string())),
  /** True when duplicate or conflicting memory provider configs are detected */
  hasDuplicateProviders: v.optional(v.nullable(v.boolean())),
  /** Names of the conflicting provider entries */
  duplicateProviderNames: v.optional(v.nullable(v.array(v.string()))),
});
export type MemorySnapshot = v.InferOutput<typeof MemorySnapshotSchema>;

export const SkillEntrySchema = v.object({
  dir: v.string(),
  name: v.optional(v.nullable(v.string())),
  hasSkillMd: v.boolean(),
  metadataComplete: v.optional(v.boolean()),
  missingFields: v.optional(v.array(v.string())),
});

export const BrokenRefSchema = v.object({
  sourceSkill: v.string(),
  referencedPath: v.string(),
  reason: v.string(),
});

export const DuplicateSkillSchema = v.object({
  name: v.string(),
  paths: v.array(v.string()),
});

export const LargeFileSchema = v.object({
  path: v.string(),
  sizeBytes: v.number(),
});

export const SkillsSnapshotSchema = v.object({
  ...areaStatus,
  skillsDir: v.optional(v.nullable(v.string())),
  skills: v.optional(v.array(SkillEntrySchema)),
  brokenRefs: v.optional(v.array(BrokenRefSchema)),
  duplicates: v.optional(v.array(DuplicateSkillSchema)),
  largeFiles: v.optional(v.array(LargeFileSchema)),
});
export type SkillsSnapshot = v.InferOutput<typeof SkillsSnapshotSchema>;

export const PluginDependencySchema = v.object({
  name: v.string(),
  version: v.optional(v.nullable(v.string())),
  resolved: v.boolean(),
});

export const PluginEntrySchema = v.object({
  name: v.string(),
  path: v.optional(v.nullable(v.string())),
  exists: v.optional(v.boolean()),
  enabled: v.optional(v.boolean()),
  manifestFound: v.optional(v.boolean()),
  manifestValid: v.optional(v.boolean()),
  parseError: v.optional(v.nullable(v.string())),
  dependencies: v.optional(v.array(PluginDependencySchema)),
  requiresHermes: v.optional(v.nullable(v.string())),
  compatible: v.optional(v.nullable(v.boolean())),
});

export const PluginsSnapshotSchema = v.object({
  ...areaStatus,
  plugins: v.optional(v.array(PluginEntrySchema)),
  hooks: v.optional(
    v.object({
      hasHooks: v.boolean(),
      hookCount: v.number(),
      phases: v.array(v.string()),
      unknownPhases: v.optional(v.array(v.string())),
    }),
  ),
});
export type PluginsSnapshot = v.InferOutput<typeof PluginsSnapshotSchema>;

export const LogFileSchema = v.object({
  path: v.string(),
  readable: v.boolean(),
  sizeBytes: v.number(),
  linesRead: v.optional(v.number()),
  snippet: v.optional(v.nullable(v.string())),
});

export const RecentErrorSchema = v.object({
  timestamp: v.nullable(v.string()),
  message: v.string(),
  type: v.optional(v.string()),
});

export const ErrorTypeCountsSchema = v.object({
  auth: v.optional(v.number(), 0),
  model: v.optional(v.number(), 0),
  mcp: v.optional(v.number(), 0),
  permission: v.optional(v.number(), 0),
  rate_limit: v.optional(v.number(), 0),
  network: v.optional(v.number(), 0),
  unknown: v.optional(v.number(), 0),
});

export const LogsSnapshotSchema = v.object({
  ...areaStatus,
  logFiles: v.optional(v.array(LogFileSchema)),
  logFile: v.optional(v.nullable(v.string())),
  errorCount: v.optional(v.number()),
  recentErrors: v.optional(v.array(RecentErrorSchema)),
  errorTypes: v.optional(ErrorTypeCountsSchema),
  maxLinesRead: v.optional(v.nullable(v.number())),
});
export type LogsSnapshot = v.InferOutput<typeof LogsSnapshotSchema>;

export const SecretLeakSchema = v.object({
  location: v.string(),
  secretType: v.string(),
  maskedValue: v.string(),
});

export const PermissionIssueSchema = v.object({
  path: v.string(),
  currentMode: v.string(),
  suggestedMode: v.string(),
});

export const DynamicExecBlockSchema = v.object({
  location: v.string(),
  pattern: v.string(),
  riskLevel: v.string(),
});

export const SecuritySnapshotSchema = v.object({
  ...areaStatus,
  publicBinding: v.optional(v.boolean()),
  bindAddress: v.optional(v.nullable(v.string())),
  secretLeaks: v.optional(v.array(SecretLeakSchema)),
  terminalBackend: v.optional(v.nullable(v.string())),
  shellRestricted: v.optional(v.boolean()),
  sandboxEnabled: v.optional(v.boolean()),
  permissionIssues: v.optional(v.array(PermissionIssueSchema)),
  envExposure: v.optional(v.boolean()),
  exposedVars: v.optional(v.array(v.string())),
  dynamicExecBlocks: v.optional(v.array(DynamicExecBlockSchema)),
});
export type SecuritySnapshot = v.InferOutput<typeof SecuritySnapshotSchema>;

export const ThresholdsSchema = v.object({
  memoryWarnPercent: v.optional(v.number(), 80),
  memoryCriticalPercent: v.optional(v.number(), 100),
  hugeFileBytes: v.optional(v.number(), 100 * 1024 * 1024),
  crashLoopErrorCount: v.optional(v.number(), 50),
  crashLoopRecentErrors: v.optional(v.number(), 20),
  largeFileBytes: v.optional(v.number(), 256 * 1024),
  skillsLargeFileBytes: v.optional(v.number(), 512 * 1024),
});
export type ThresholdsSnapshot = v.InferOutput<typeof ThresholdsSchema>;

export const RedactionSummarySchema = v.object({
  redacted: v.boolean(),
  count: v.number(),
  totalRedactions: v.number(),
  patterns: v.array(v.string()),
  homePathRedactions: v.number(),
});
export type RedactionSummary = v.InferOutput<typeof RedactionSummarySchema>;

export const HermesSnapshotSchema = v.object({
  schemaVersion: v.literal("1.0"),
  collectedAt: v.string(),
  profile: v.string(),
  hermesHome: v.optional(v.nullable(v.string())),
  system: SystemSnapshotSchema,
  install: InstallSnapshotSchema,
  config: ConfigSnapshotSchema,
  dashboard: DashboardSnapshotSchema,
  providers: ProviderSnapshotSchema,
  mcp: McpSnapshotSchema,
  memory: MemorySnapshotSchema,
  skills: SkillsSnapshotSchema,
  plugins: PluginsSnapshotSchema,
  logs: LogsSnapshotSchema,
  security: SecuritySnapshotSchema,
  collectionWarnings: v.array(v.string()),
  redaction: RedactionSummarySchema,
  thresholds: v.optional(ThresholdsSchema),
});
export type HermesSnapshot = v.InferOutput<typeof HermesSnapshotSchema>;
