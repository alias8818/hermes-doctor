import type { HermesSnapshot } from "../schemas/snapshot.js";
import { safeIdentifier } from "../utils/shell-safe.js";
import { evidence, finding, fix, type Check } from "./types.js";

/**
 * Check: Hermes home directory exists.
 * VAL-CONF-001: Hermes home directory exists
 */
export const homeExistsCheck: Check = {
  id: "config-home-exists",
  area: "config",
  title: "Hermes Home Directory",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const cfg = snapshot.config;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("home_path", cfg.homePath ?? "(not found)", "file"),
      evidence("home_exists", String(cfg.homeExists ?? false), "file"),
    ];

    if (cfg.homeExists) {
      return [
        finding(
          "config-home-exists",
          "config",
          "ok",
          0,
          "Hermes Home Exists",
          `Hermes home directory found at ${cfg.homePath}`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "config-home-exists",
        "config",
        "broken",
        3,
        "Hermes Home Missing",
        "Hermes home directory does not exist or is inaccessible",
        ev,
        [
          fix("Create Hermes home directory", {
            command: "mkdir -p ~/.hermes",
            risk: "medium",
            requiresConfirmation: true,
            manualSteps: [
              "Run: mkdir -p ~/.hermes",
              "This creates the Hermes home directory",
            ],
            rollback: "rmdir ~/.hermes 2>/dev/null || echo 'Directory not empty, remove manually'",
          }),
          fix("Configure Hermes home", {
            command: 'export HERMES_HOME="$HOME/.hermes"',
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: config.yaml parseable.
 * VAL-CONF-002: config.yaml parseable
 */
export const configParseCheck: Check = {
  id: "config-parse",
  area: "config",
  title: "Configuration File (config.yaml)",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const cfg = snapshot.config;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("config_path", cfg.configPath ?? "(not found)", "file"),
      evidence("config_valid", String(cfg.configValid ?? false), "config"),
    ];

    if (cfg.parseError) {
      ev.push(evidence("parse_error", cfg.parseError, "file"));
    }

    if (cfg.configValid) {
      return [
        finding(
          "config-parse",
          "config",
          "ok",
          0,
          "Configuration Valid",
          "config.yaml exists and is valid YAML",
          ev,
        ),
      ];
    }

    if (!cfg.configExists) {
      return [
        finding(
          "config-parse",
          "config",
          "warning",
          1,
          "Configuration File Missing",
          "config.yaml does not exist in Hermes home",
          ev,
          [
            fix("Create default config.yaml", {
              command: 'echo "providers: {}" > ~/.hermes/config.yaml',
              risk: "low",
            }),
          ],
        ),
      ];
    }

    // Config exists but is invalid
    return [
      finding(
        "config-parse",
        "config",
        "broken",
        3,
        "Configuration Parse Error",
        `config.yaml exists but cannot be parsed: ${cfg.parseError ?? "Unknown error"}`,
        ev,
        [
          fix("Validate config YAML syntax", {
            command: "python3 -c \"import yaml; yaml.safe_load(open('~/.hermes/config.yaml'))\"",
            description: "Or use: npx js-yaml ~/.hermes/config.yaml",
            risk: "medium",
            requiresConfirmation: true,
            manualSteps: [
              "Run the validation command to check YAML syntax",
              "Fix any errors reported by the validator",
            ],
            rollback: "Restore config.yaml from backup if validation makes changes",
          }),
          fix("Restore config from backup", {
            command: "cp ~/.hermes/config.yaml.bak ~/.hermes/config.yaml",
            description: "If a backup exists",
            risk: "medium",
            requiresConfirmation: true,
            manualSteps: [
              "Ensure ~/.hermes/config.yaml.bak exists",
              "Run: cp ~/.hermes/config.yaml.bak ~/.hermes/config.yaml",
            ],
            rollback: "cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Profile exists.
 * VAL-CONF-003: Profile exists
 */
export const profileCheck: Check = {
  id: "config-profiles",
  area: "config",
  title: "Profiles Configuration",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const cfg = snapshot.config;
    const ev: Array<ReturnType<typeof evidence>> = [];

    const profiles = cfg.profiles ?? [];
    ev.push(evidence("profiles", JSON.stringify(profiles), "config"));

    if (profiles.length > 0) {
      return [
        finding(
          "config-profiles",
          "config",
          "ok",
          0,
          "Profiles Configured",
          `Found ${profiles.length} profile(s): ${profiles.join(", ")}`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "config-profiles",
        "config",
        "warning",
        1,
        "No Profiles Found",
        "No profiles are configured in config.yaml",
        ev,
        [
          fix("Add a profile", {
            command: 'echo "  - default" >> ~/.hermes/config.yaml',
            description: "Or add profiles section to config.yaml",
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Key config sections present.
 * VAL-CONF-004: Key config sections present
 */
export const sectionsCheck: Check = {
  id: "config-sections",
  area: "config",
  title: "Configuration Sections",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const cfg = snapshot.config;
    const sections = cfg.sections ?? {};
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("sections", JSON.stringify(sections), "config"),
    ];

    const requiredSections = ["providers"];
    const optionalSections = ["skills", "plugins"];

    const missing = requiredSections.filter((s) => sections[s] !== true);
    const missingOptional = optionalSections.filter((s) => sections[s] !== true);

    // Missing required sections: warning
    if (missing.length > 0) {
      return [
        finding(
          "config-sections",
          "config",
          "warning",
          1,
          "Missing Configuration Sections",
          `Missing required section(s): ${missing.join(", ")}`,
          ev,
          [
            fix(`Add ${missing[0]} section to config.yaml`, {
              command: `echo "${safeIdentifier(missing[0] ?? "section", "section")}: {}" >> ~/.hermes/config.yaml`,
              risk: "low",
            }),
          ],
        ),
      ];
    }

    // Missing optional sections: info (not a warning — they're optional)
    if (missingOptional.length > 0) {
      return [
        finding(
          "config-sections",
          "config",
          "info",
          0,
          "Optional Sections Not Configured",
          `Optional section(s) not found: ${missingOptional.join(", ")}. These are not required but recommended for full functionality.`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "config-sections",
        "config",
        "ok",
        0,
        "All Required Sections Present",
        "config.yaml contains all required top-level sections",
        ev,
      ),
    ];
  },
};

/**
 * Check: Config schema conformant.
 * VAL-CONF-005: Config schema conformant
 */
export const schemaConformanceCheck: Check = {
  id: "config-schema",
  area: "config",
  title: "Config Schema Conformance",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const cfg = snapshot.config;
    const schemaErrors = cfg.schemaErrors ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("schema_errors", JSON.stringify(schemaErrors), "config"),
    ];

    if (schemaErrors.length === 0) {
      return [
        finding(
          "config-schema",
          "config",
          "ok",
          0,
          "Config Schema Conformant",
          "Configuration follows the expected schema",
          ev,
        ),
      ];
    }

    return [
      finding(
        "config-schema",
        "config",
        "warning",
        2,
        "Config Schema Violations",
        `Found ${schemaErrors.length} schema violation(s): ${schemaErrors.slice(0, 3).join("; ")}${schemaErrors.length > 3 ? ` (+${schemaErrors.length - 3} more)` : ""}`,
        ev,
        [
          fix("Review config.yaml for correct types", {
            command: "cat ~/.hermes/config.yaml",
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/** All config checks */
export const configChecks: Check[] = [
  homeExistsCheck,
  configParseCheck,
  profileCheck,
  sectionsCheck,
  schemaConformanceCheck,
];
