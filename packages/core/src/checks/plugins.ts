import type { HermesSnapshot } from "../schemas/snapshot.js";
import { safeIdentifier, safeNpmSpec, safePath } from "../utils/shell-safe.js";
import { evidence, finding, fix, type Check } from "./types.js";

function pluginDir(p: { name: string; path?: string | null }): string {
  return p.path ?? `plugins/${safeIdentifier(p.name)}`;
}

/**
 * Check: Enabled plugin paths exist.
 * VAL-PLUG-001: Enabled plugin paths exist
 */
export const pluginPathsCheck: Check = {
  id: "plugins-paths-exist",
  area: "plugins",
  title: "Plugin Paths",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const plugins = snapshot.plugins;
    const pluginEntries = plugins.plugins ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("plugins", JSON.stringify(
        pluginEntries.map((p) => ({
          name: p.name,
          path: p.path ?? null,
          enabled: p.enabled ?? false,
          exists: p.exists ?? false,
        })),
      ), "config"),
    ];

    if (pluginEntries.length === 0) {
      return [
        finding(
          "plugins-paths-exist",
          "plugins",
          "info",
          0,
          "No Plugins Configured",
          "No plugins are configured in config.yaml",
          ev,
        ),
      ];
    }

    const enabledPlugins = pluginEntries.filter((p) => p.enabled);
    const missingEnabled = enabledPlugins.filter((p) => !p.exists);

    if (missingEnabled.length === 0) {
      return [
        finding(
          "plugins-paths-exist",
          "plugins",
          "ok",
          0,
          "Plugin Paths Exist",
          `All ${enabledPlugins.length} enabled plugin(s) have valid paths`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "plugins-paths-exist",
        "plugins",
        "broken",
        3,
        "Plugin Paths Missing",
        `${missingEnabled.length} enabled plugin(s) are missing on disk: ${missingEnabled.map((p) => p.name).join(", ")}`,
        ev,
        missingEnabled.map((p) => {
          const dir = pluginDir(p);
          const quoted = safePath(dir);
          return fix(`Install plugin ${p.name}`, {
            command: `mkdir -p ${quoted}`,
            description: `Plugin "${p.name}" is enabled in config.yaml but its directory does not exist at ${dir}. Create the directory or install the plugin package.`,
            risk: "medium",
            requiresConfirmation: true,
            manualSteps: [
              `Run: mkdir -p ${quoted}`,
              "Verify the plugin directory was created successfully",
            ],
            rollback: `rm -rf ${quoted}`,
          });
        }),
      ),
    ];
  },
};

/**
 * Check: Plugin manifests parseable.
 * VAL-PLUG-002: Plugin manifests parseable
 */
export const pluginManifestsCheck: Check = {
  id: "plugins-manifests",
  area: "plugins",
  title: "Plugin Manifests",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const plugins = snapshot.plugins;
    const pluginEntries = plugins.plugins ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("plugins", JSON.stringify(
        pluginEntries.map((p) => ({
          name: p.name,
          manifest_found: p.manifestFound ?? false,
          manifest_valid: p.manifestValid ?? false,
          parse_error: p.parseError ?? null,
        })),
      ), "file"),
    ];

    const withManifests = pluginEntries.filter((p) => p.manifestFound);
    // Use explicit false check — undefined means manifest wasn't probed, not invalid
    const invalidManifests = withManifests.filter((p) => p.manifestValid === false);

    if (invalidManifests.length === 0) {
      if (withManifests.length === 0) {
        return [
          finding(
            "plugins-manifests",
            "plugins",
            "info",
            0,
            "No Plugin Manifests",
            "No plugin manifests found to validate",
            ev,
          ),
        ];
      }
      return [
        finding(
          "plugins-manifests",
          "plugins",
          "ok",
          0,
          "Plugin Manifests Valid",
          `All ${withManifests.length} plugin manifest(s) are parseable`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "plugins-manifests",
        "plugins",
        "warning",
          2,
        "Plugin Manifest Parse Errors",
        `${invalidManifests.length} plugin manifest(s) have parse errors: ${invalidManifests.map((p) => `${p.name} (${p.parseError ?? "unknown error"})`).join(", ")}`,
        ev,
        invalidManifests.map((p) => {
          const manifest = `${pluginDir(p)}/plugin.json`;
          return fix(`Fix manifest for plugin ${p.name}`, {
            command: `python3 -m json.tool < ${safePath(manifest)} > /dev/null`,
            description: `Check ${manifest} for JSON syntax errors (e.g., trailing commas, missing quotes). Use a JSON validator.`,
            risk: "low",
          });
        }),
      ),
    ];
  },
};

/**
 * Check: Plugin dependencies present.
 * VAL-PLUG-003: Plugin dependencies present
 */
export const pluginDepsCheck: Check = {
  id: "plugins-dependencies",
  area: "plugins",
  title: "Plugin Dependencies",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const plugins = snapshot.plugins;
    const pluginEntries = plugins.plugins ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("plugins", JSON.stringify(
        pluginEntries.map((p) => ({
          name: p.name,
          dependencies: (p.dependencies ?? []).map((d) => ({
            name: d.name,
            version: d.version ?? null,
            resolved: d.resolved,
          })),
        })),
      ), "file"),
    ];

    const allDeps = pluginEntries.flatMap((p) =>
      (p.dependencies ?? []).map((d) => ({ plugin: p.name, dep: d })),
    );
    const unresolved = allDeps.filter((d) => !d.dep.resolved);

    if (unresolved.length === 0) {
      const totalDeps = allDeps.length;
      if (totalDeps === 0) {
        return [
          finding(
            "plugins-dependencies",
            "plugins",
            "info",
            0,
            "No Plugin Dependencies",
            "No plugins declare external dependencies",
            ev,
          ),
        ];
      }
      return [
        finding(
          "plugins-dependencies",
          "plugins",
          "ok",
          0,
          "Plugin Dependencies Resolved",
          `All ${totalDeps} plugin dependenc(ies) are resolved`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "plugins-dependencies",
        "plugins",
        "broken",
        3,
        "Unresolved Plugin Dependencies",
        `${unresolved.length} plugin dependenc(ies) are not resolved`,
        ev,
        unresolved.slice(0, 3).map((d) => {
          const spec = safeNpmSpec(d.dep.name, d.dep.version);
          return fix(`Install dependency ${d.dep.name} for plugin ${d.plugin}`, {
            command: `npm install ${spec}`,
            risk: "high",
            requiresConfirmation: true,
            manualSteps: [
              `Run: npm install ${spec}`,
              "Verify the dependency was installed successfully",
            ],
            rollback: `npm uninstall ${spec}`,
          });
        }),
      ),
    ];
  },
};

/**
 * Check: Plugin version compatibility checked.
 * VAL-PLUG-004: Plugin version compatibility checked
 */
export const pluginVersionCompatCheck: Check = {
  id: "plugins-version-compat",
  area: "plugins",
  title: "Plugin Version Compatibility",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const plugins = snapshot.plugins;
    const pluginEntries = plugins.plugins ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("plugins", JSON.stringify(
        pluginEntries.map((p) => ({
          name: p.name,
          requires_hermes: p.requiresHermes ?? null,
          compatible: p.compatible ?? null,
        })),
      ), "file"),
    ];

    const withVersionReq = pluginEntries.filter((p) => p.requiresHermes);

    if (withVersionReq.length === 0) {
      return [
        finding(
          "plugins-version-compat",
          "plugins",
          "info",
          0,
          "No Plugin Version Requirements",
          "No plugins declare Hermes version requirements",
          ev,
        ),
      ];
    }

    const incompatible = withVersionReq.filter((p) => p.compatible === false);

    if (incompatible.length === 0) {
      return [
        finding(
          "plugins-version-compat",
          "plugins",
          "ok",
          0,
          "Plugin Hermes Compatibility OK",
          `All ${withVersionReq.length} plugin(s) with version requirements are compatible`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "plugins-version-compat",
        "plugins",
        "warning",
          2,
        "Plugin Hermes Incompatibility",
        `${incompatible.length} plugin(s) require a different Hermes version: ${incompatible.map((p) => `${p.name} (requires ${p.requiresHermes})`).join(", ")}`,
        ev,
        incompatible.map((p) =>
          fix(`Update ${p.name} plugin`, {
            command: `Plugin ${p.name} requires Hermes ${p.requiresHermes}. Update the plugin or Hermes.`,
            risk: "low",
          }),
        ),
      ),
    ];
  },
};

/**
 * Check: Memory-provider plugin in wrong section.
 * VAL-SKILL-008: Memory-provider plugin in wrong config section
 */
export const pluginWrongSectionCheck: Check = {
  id: "plugins-wrong-section",
  area: "plugins",
  title: "Plugin Config Section",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const plugins = snapshot.plugins;
    const pluginEntries = plugins.plugins ?? [];
    const MEMORY_PROVIDER_NAMES = ["memory-provider", "memory_provider", "memoryprovider"];

    // Check if any plugin name matches a known memory-provider pattern
    const misplacedMemoryPlugins = pluginEntries.filter((p) =>
      MEMORY_PROVIDER_NAMES.includes(p.name.toLowerCase()),
    );

    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("plugins", JSON.stringify(
        pluginEntries.map((p) => ({
          name: p.name,
          is_memory_provider: MEMORY_PROVIDER_NAMES.includes(p.name.toLowerCase()),
        })),
      ), "config"),
    ];

    if (misplacedMemoryPlugins.length === 0) {
      return [
        finding(
          "plugins-wrong-section",
          "plugins",
          "ok",
          0,
          "Plugins in Correct Sections",
          "No memory-provider plugins found in the plugins section",
          ev,
        ),
      ];
    }

    return [
      finding(
        "plugins-wrong-section",
        "plugins",
        "warning",
          1,
        "Memory-Provider Plugin in Wrong Section",
        `Plugin(s) "${misplacedMemoryPlugins.map((p) => p.name).join(", ")}" should be configured under the 'memory' section, not 'plugins'`,
        ev,
        misplacedMemoryPlugins.map((p) =>
          fix(`Move ${p.name} to memory section`, {
            command: "Move the memory-provider plugin configuration from 'plugins:' to 'memory:' section in config.yaml",
            risk: "low",
          }),
        ),
      ),
    ];
  },
};

/**
 * Check: Hooks configuration validity.
 * VAL-PLUG-005: Hooks configured in Hermes v24 hooks section
 */
export const hooksConfigCheck: Check = {
  id: "hooks-config",
  area: "plugins",
  title: "Hooks Configuration",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const hooks = snapshot.plugins.hooks;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("hooks", JSON.stringify(hooks ?? { hasHooks: false, hookCount: 0, phases: [], unknownPhases: [] }), "config"),
    ];

    const unknownPhases = hooks?.unknownPhases ?? [];

    if (unknownPhases.length > 0) {
      return [
        finding(
          "hooks-config",
          "plugins",
          "warning",
          1,
          "Unknown Hook Phase Names",
          `Hook section contains unknown phase name(s): ${unknownPhases.join(", ")}. Known phases: pre_tool_call, post_tool_call, on_session_start, on_session_end, pre_command, post_command, on_system_prompt`,
          ev,
          [
            fix("Review hook phase names", {
              command: "# Known hook phases: pre_tool_call, post_tool_call, on_session_start, on_session_end, pre_command, post_command, on_system_prompt",
              description: `The hooks: section in config.yaml references unknown phase name(s): ${unknownPhases.join(", ")}. Verify these are valid for your Hermes version or correct the spelling.`,
              risk: "low",
            }),
          ],
        ),
      ];
    }

    if (!hooks || !hooks.hasHooks) {
      return [
        finding(
          "hooks-config",
          "plugins",
          "info",
          0,
          "No Hooks Configured",
          "No shell hooks are configured under the hooks: section in config.yaml",
          ev,
        ),
      ];
    }

    return [
      finding(
        "hooks-config",
        "plugins",
        "info",
        0,
        "Hooks Configured",
        `${hooks.hookCount} hook(s) configured in phase(s): ${hooks.phases.join(", ")}`,
        ev,
      ),
    ];
  },
};

/** All plugins checks */
export const pluginsChecks: Check[] = [
  pluginPathsCheck,
  pluginManifestsCheck,
  pluginDepsCheck,
  pluginVersionCompatCheck,
  pluginWrongSectionCheck,
  hooksConfigCheck,
];
