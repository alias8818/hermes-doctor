import type { HermesSnapshot } from "../schemas/snapshot.js";
import { exportEnvCommand, safeIdentifier, shellQuote } from "../utils/shell-safe.js";
import { evidence, finding, fix, type Check } from "./types.js";

/**
 * Check: Server configs found.
 * VAL-MCP-001: Server configs found
 */
export const serversFoundCheck: Check = {
  id: "mcp-servers-found",
  area: "mcp",
  title: "MCP Server Configurations",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mcp = snapshot.mcp;
    const serverNames = (mcp.servers ?? []).map((s) => s.name);
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("servers", JSON.stringify(serverNames), "config"),
    ];

    if (serverNames.length > 0) {
      return [
        finding(
          "mcp-servers-found",
          "mcp",
          "ok",
          0,
          "MCP Servers Configured",
          `${serverNames.length} MCP server(s) configured: ${serverNames.join(", ")}`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "mcp-servers-found",
        "mcp",
        "info",
        0,
        "No MCP Servers Configured",
        "No MCP servers are configured. This is fine if you don't use MCP tools.",
        ev,
      ),
    ];
  },
};

/**
 * Check: Command executables exist.
 * VAL-MCP-002: Command executables exist
 */
export const commandExistsCheck: Check = {
  id: "mcp-commands-exist",
  area: "mcp",
  title: "MCP Server Command Executables",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mcp = snapshot.mcp;
    const servers = mcp.servers ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("servers", JSON.stringify(
        servers.map((s) => ({
          name: s.name,
          command: s.command ?? null,
          executable_found: s.executableFound ?? false,
        })),
      ), "config"),
    ];

    const missingCmds = servers.filter((s) => s.executableFound === false);

    if (missingCmds.length === 0) {
      if (servers.length === 0) {
        return [
          finding(
            "mcp-commands-exist",
            "mcp",
            "info",
            0,
            "No MCP Commands to Check",
            "No MCP servers configured",
            ev,
          ),
        ];
      }
      return [
        finding(
          "mcp-commands-exist",
          "mcp",
          "ok",
          0,
          "MCP Commands Resolved",
          `All ${servers.length} MCP server command(s) resolve to valid executables`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "mcp-commands-exist",
        "mcp",
        "broken",
        3,
        "MCP Command Executables Missing",
        `${missingCmds.length} MCP server command(s) not found: ${missingCmds.map((s) => `${s.name} (${s.command ?? "unknown"})`).join(", ")}`,
        ev,
        missingCmds.map((s) => {
          const rawCmd = s.command?.split(" ")[0] ?? "command";
          const cmdName = safeIdentifier(rawCmd, "mcp-command");
          const quoted = shellQuote(cmdName);
          return fix(`Install or fix path for ${s.name}`, {
            command: `command -v ${quoted} || echo ${shellQuote(`${cmdName} not found on PATH`)}`,
            description: `The executable "${rawCmd}" for MCP server "${s.name}" was not found on PATH. Install the package or ensure it is on your PATH.`,
            risk: "medium",
            requiresConfirmation: true,
            manualSteps: [
              `Check if the executable exists: command -v ${quoted}`,
              `Search npm registry documentation for package name ${quoted}`,
              "Or add the executable's directory to your PATH",
            ],
            rollback: "Undo any PATH changes by restoring your shell profile",
          });
        }),
      ),
    ];
  },
};

/**
 * Check: Referenced environment variables set.
 * VAL-MCP-003: Referenced environment variables set
 */
export const mcpEnvVarsCheck: Check = {
  id: "mcp-env-vars",
  area: "mcp",
  title: "MCP Server Environment Variables",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mcp = snapshot.mcp;
    const servers = mcp.servers ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("servers", JSON.stringify(
        servers.map((s) => ({
          name: s.name,
          expected_env: (s.expectedEnv ?? []).map((e) => ({
            key: e.key,
            set: e.set,
          })),
        })),
      ), "config"),
    ];

    const missingVars: { server: string; key: string }[] = [];
    for (const s of servers) {
      for (const envVar of s.expectedEnv ?? []) {
        if (!envVar.set) {
          missingVars.push({ server: s.name, key: envVar.key });
        }
      }
    }

    if (missingVars.length === 0) {
      const totalExpected = servers.reduce((sum, s) => sum + (s.expectedEnv?.length ?? 0), 0);
      if (totalExpected === 0) {
        return [
          finding(
            "mcp-env-vars",
            "mcp",
            "info",
            0,
            "No MCP Environment Variables Expected",
            "No MCP servers reference environment variables",
            ev,
          ),
        ];
      }
      return [
        finding(
          "mcp-env-vars",
          "mcp",
          "ok",
          0,
          "MCP Environment Variables Set",
          `All ${totalExpected} referenced environment variable(s) are set`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "mcp-env-vars",
        "mcp",
        "broken",
        3,
        "MCP Environment Variables Missing",
        `${missingVars.length} environment variable(s) referenced by MCP servers are not set: ${missingVars.map((v) => `${v.server}:${v.key}`).join(", ")}`,
        ev,
        missingVars.map((v) =>
          fix(`Set ${v.key} for MCP server ${v.server}`, {
            command: exportEnvCommand(v.key, "your-value-here"),
            risk: "low",
          }),
        ),
      ),
    ];
  },
};

/**
 * Check: Tool filters configured.
 * VAL-MCP-004: Tool filters configured
 */
export const toolsFilterCheck: Check = {
  id: "mcp-tools-filter",
  area: "mcp",
  title: "MCP Server Tool Filters",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mcp = snapshot.mcp;
    const servers = mcp.servers ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("servers", JSON.stringify(
        servers.map((s) => ({
          name: s.name,
          tools_filter: s.toolsFilter
            ? {
                enabled: s.toolsFilter.enabled,
                includes: s.toolsFilter.includes ?? [],
                excludes: s.toolsFilter.excludes ?? [],
              }
            : null,
        })),
      ), "config"),
    ];

    const serversWithFilters = servers.filter((s) => s.toolsFilter?.enabled);
    const serversWithoutFilters = servers.filter(
      (s) => !s.toolsFilter || !s.toolsFilter.enabled,
    );

    if (servers.length === 0) {
      return [
        finding(
          "mcp-tools-filter",
          "mcp",
          "info",
          0,
          "No MCP Tool Filters",
          "No MCP servers configured",
          ev,
        ),
      ];
    }

    if (serversWithFilters.length === 0) {
      // All servers lack tool filters — warning severity
      const sev = servers.length > 1 ? 2 : 1;
      return [
        finding(
          "mcp-tools-filter",
          "mcp",
          "warning",
          sev,
          "No MCP Tool Filters Configured",
          `${servers.length} MCP server(s) have no tool filters configured. Consider adding tools.include or tools.exclude to restrict tool access.`,
          ev,
          [
            fix("Add tool filters to MCP servers", {
              command: "# In config.yaml, add to each MCP server:\n# tools:\n#   include:\n#     - allowed-tool-*\n#   exclude:\n#     - dangerous-tool",
              description: "Adding tool filters helps restrict which tools MCP servers can expose",
              risk: "low",
            }),
          ],
        ),
      ];
    }

    if (serversWithoutFilters.length > 0) {
      // Some servers have filters, some don't — warning
      return [
        finding(
          "mcp-tools-filter",
          "mcp",
          "warning",
          1,
          "Some MCP Servers Missing Tool Filters",
          `${serversWithoutFilters.length} MCP server(s) have no tool filters configured: ${serversWithoutFilters.map((s) => s.name).join(", ")}`,
          ev,
          [
            fix("Add tool filters to unfiltered servers", {
              command: "# In config.yaml, add to each MCP server:\n# tools:\n#   include:\n#     - allowed-tool-*\n#   exclude:\n#     - dangerous-tool",
              description: "Adding tool filters helps restrict which tools MCP servers can expose",
              risk: "low",
            }),
          ],
        ),
      ];
    }

    return [
      finding(
        "mcp-tools-filter",
        "mcp",
        "ok",
        0,
        "MCP Tool Filters Configured",
        `${serversWithFilters.length} MCP server(s) have tool filters: ${serversWithFilters.map((s) => s.name).join(", ")}`,
        ev,
      ),
    ];
  },
};

/**
 * Check: MCP server transport validated.
 * VAL-MCP-005: MCP server transport validated
 */
export const transportCheck: Check = {
  id: "mcp-transport",
  area: "mcp",
  title: "MCP Server Transport",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const mcp = snapshot.mcp;
    const servers = mcp.servers ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("servers", JSON.stringify(
        servers.map((s) => ({
          name: s.name,
          transport: s.transport ?? null,
          transport_valid: s.transportValid ?? false,
        })),
      ), "config"),
    ];

    const knownTransports = ["stdio", "sse", "streamable-http"];
    const invalidTransports = servers.filter(
      (s) => s.transport && !knownTransports.includes(s.transport) && !s.transportValid,
    );

    if (invalidTransports.length === 0) {
      if (servers.length === 0) {
        return [
          finding(
            "mcp-transport",
            "mcp",
            "info",
            0,
            "No MCP Transports to Validate",
            "No MCP servers configured",
            ev,
          ),
        ];
      }
      return [
        finding(
          "mcp-transport",
          "mcp",
          "ok",
          0,
          "MCP Server Transports Valid",
          `All ${servers.length} MCP server(s) have recognized transports`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "mcp-transport",
        "mcp",
        "warning",
          1,
        "Unrecognized MCP Transports",
        `${invalidTransports.length} MCP server(s) have unrecognized transports: ${invalidTransports.map((s) => `${s.name} (${s.transport})`).join(", ")}`,
        ev,
        [
          fix("Review MCP server configuration", {
            command: "cat ~/.hermes/config.yaml | grep -A10 mcp",
            description: "Valid transports: stdio, sse, streamable-http",
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/** All MCP checks */
export const mcpChecks: Check[] = [
  serversFoundCheck,
  commandExistsCheck,
  mcpEnvVarsCheck,
  toolsFilterCheck,
  transportCheck,
];
