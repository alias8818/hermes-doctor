import type { CollectorResult } from "../schemas/collector.js";
import {
  asArray,
  asBoolean,
  asRecord,
  asString,
  loadHermesConfig,
  pick,
} from "../utils/config.js";
import { executableFromCommand, findExecutable } from "../utils/which.js";
import type { CollectorContext } from "./context.js";
import type { McpData } from "./data.js";
import { addEvidence, finalize, newAccumulator, runArea } from "./result.js";

const EMPTY: McpData = {};

const VALID_TRANSPORTS = new Set([
  "stdio",
  "sse",
  "http",
  "streamable-http",
  "websocket",
  "ws",
]);

type McpServer = NonNullable<McpData["servers"]>[number];

interface RawServer {
  name: string;
  record: Record<string, unknown>;
}

function extractServers(
  parsed: Record<string, unknown> | null,
): RawServer[] {
  if (!parsed) return [];

  // 1. Top-level mcp_servers or mcpServers map (Hermes v24 style)
  //    mcp_servers:
  //      github:
  //        command: npx
  //        ...
  const topMap = asRecord(pick(parsed, "mcp_servers", "mcpServers"));
  if (topMap && Object.keys(topMap).length > 0) {
    return Object.entries(topMap)
      .map(([name, value]) => {
        const record = asRecord(value);
        return record ? { name, record } : null;
      })
      .filter((entry): entry is RawServer => entry !== null);
  }

  // 2. mcp section with nested servers list or map
  //    mcp:
  //      servers:
  //        - name: fs
  //          command: node ./server.js
  //          ...
  const mcpSection = asRecord(pick(parsed, "mcp"));
  if (mcpSection) {
    const serversField = pick(mcpSection, "servers", "mcpServers");

    const asList = asArray(serversField);
    if (asList) {
      const out: RawServer[] = [];
      for (const item of asList) {
        const record = asRecord(item);
        if (!record) continue;
        const name = asString(record.name) ?? "unnamed";
        out.push({ name, record });
      }
      return out;
    }

    const asMap = asRecord(serversField);
    if (asMap) {
      return Object.entries(asMap)
        .map(([name, value]) => {
          const record = asRecord(value);
          return record ? { name, record } : null;
        })
        .filter((entry): entry is RawServer => entry !== null);
    }
  }

  return [];
}

function buildCommand(record: Record<string, unknown>): string | null {
  const command = asString(pick(record, "command", "cmd"));
  if (command === null) return null;
  // Empty string means command field exists but is empty — not the same as no command
  if (command === "") return "";
  const args = asArray(record.args);
  if (args && args.length > 0) {
    const argStrings = args
      .map((arg) => asString(arg))
      .filter((arg): arg is string => arg !== null);
    return [command, ...argStrings].join(" ");
  }
  return command;
}

function expectedEnv(
  record: Record<string, unknown>,
  env: NodeJS.ProcessEnv,
): McpServer["expectedEnv"] {
  const envField = record.env;
  const keys: string[] = [];
  const list = asArray(envField);
  if (list) {
    for (const item of list) {
      const key = asString(item) ?? asString(asRecord(item)?.key);
      if (key) keys.push(key);
    }
  } else {
    const map = asRecord(envField);
    if (map) keys.push(...Object.keys(map));
  }
  return keys.map((key) => ({ key, set: Boolean(env[key]) }));
}

function toolsFilter(
  record: Record<string, unknown>,
): McpServer["toolsFilter"] {
  const tools = asRecord(pick(record, "tools", "toolsFilter", "tools_filter"));
  if (!tools) return null;
  const enabled = asBoolean(pick(tools, "enabled")) ?? true;
  const includes = asArray(pick(tools, "include", "includes", "allow"))
    ?.map((entry) => asString(entry))
    .filter((entry): entry is string => entry !== null);
  const excludes = asArray(pick(tools, "exclude", "excludes", "deny"))
    ?.map((entry) => asString(entry))
    .filter((entry): entry is string => entry !== null);
  return {
    enabled,
    ...(includes && includes.length > 0 ? { includes } : {}),
    ...(excludes && excludes.length > 0 ? { excludes } : {}),
  };
}

export async function collectMcp(
  ctx: CollectorContext,
): Promise<CollectorResult<McpData>> {
  return runArea("mcp", EMPTY, ctx.redaction, async () => {
    const acc = newAccumulator();
    const config = await loadHermesConfig(ctx.paths.config);
    const rawServers = extractServers(config.parsed);

    if (rawServers.length === 0) {
      acc.warnings.push("no MCP servers configured");
      return finalize("mcp", "skipped", { servers: [] }, acc, ctx.redaction);
    }

    const servers: McpServer[] = [];
    for (const { name, record } of rawServers) {
      const command = buildCommand(record);
      const declaredTransport = asString(
        pick(record, "transport", "type"),
      );
      const url = asString(pick(record, "url", "endpoint"));
      const transport =
        declaredTransport ?? (command !== null ? "stdio" : url ? "http" : null);
      const transportValid =
        transport !== null && VALID_TRANSPORTS.has(transport.toLowerCase());

      let executableFound: boolean | undefined;
      if (command !== null) {
        if (command === "") {
          // Empty command string explicitly set — no executable possible
          executableFound = false;
        } else {
          const executable = executableFromCommand(command);
          executableFound =
            executable !== null &&
            (await findExecutable(executable, ctx.env)) !== null;
        }
      }

      const server: McpServer = {
        name,
        command: command ?? null,
        transport: transport ?? null,
        transportValid,
        expectedEnv: expectedEnv(record, ctx.env),
        toolsFilter: toolsFilter(record),
      };
      if (executableFound !== undefined) {
        server.executableFound = executableFound;
      }
      servers.push(server);

      addEvidence(
        acc,
        `MCP: ${name}`,
        command ?? url ?? "(no command)",
        "config.yaml",
      );
    }

    return finalize("mcp", "collected", { servers }, acc, ctx.redaction);
  });
}
