import type { HermesSnapshot } from "../schemas/snapshot.js";
import { safePath } from "../utils/shell-safe.js";
import { evidence, finding, fix, type Check } from "./types.js";

/**
 * Check: Hermes executable found or missing.
 * VAL-INST-001: Hermes executable found or missing
 */
export const executableCheck: Check = {
  id: "install-executable",
  area: "install",
  title: "Hermes Executable",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const inst = snapshot.install;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("executable_path", inst.executablePath ?? "(not found)", "file"),
      evidence("on_path", String(inst.onPath ?? false), "derived"),
    ];

    if (inst.onPath && inst.executablePath) {
      return [
        finding(
          "install-executable",
          "install",
          "ok",
          0,
          "Hermes Executable Found",
          `Hermes found at: ${inst.executablePath}`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "install-executable",
        "install",
        "broken",
        3,
        "Hermes Executable Not Found",
        "Hermes is not installed or not on PATH",
        ev,
        [
          fix("Install Hermes via pip", {
            command: "pip install hermes-agent",
            description: "Or use the curl installer: curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash",
            risk: "high",
            requiresConfirmation: true,
            manualSteps: [
              "Run: pip install hermes-agent",
              "After installation, reload your shell: source ~/.bashrc",
              "Verify with: hermes --version",
            ],
            rollback: "pip uninstall hermes-agent -y",
          }),
          fix("Add to PATH", {
            command: 'export PATH="$PATH:$(npm bin -g)"',
            description: "Then run: hermes --version",
            risk: "low",
            requiresConfirmation: false,
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Version command succeeds.
 * VAL-INST-002: Version command succeeds
 */
export const versionCheck: Check = {
  id: "install-version",
  area: "install",
  title: "Hermes Version",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const inst = snapshot.install;
    const ev: Array<ReturnType<typeof evidence>> = [];

    if (inst.versionString) {
      ev.push(evidence("version_string", inst.versionString, "command"));
    }
    if (inst.versionExitCode !== undefined && inst.versionExitCode !== null) {
      ev.push(evidence("exit_code", String(inst.versionExitCode), "derived"));
    }

    if (inst.versionString && inst.versionExitCode === 0) {
      return [
        finding(
          "install-version",
          "install",
          "ok",
          0,
          "Hermes Version Detected",
          `Hermes version: ${inst.versionString}`,
          ev,
        ),
      ];
    }

    if (inst.versionString) {
      // Non-zero exit code but we got a version string
      return [
        finding(
          "install-version",
          "install",
          "warning",
          1,
          "Hermes Version Issue",
          `Hermes version exited with code ${inst.versionExitCode ?? "unknown"}: ${inst.versionString}`,
          ev,
          [
            fix("Reinstall Hermes", {
              command: "pip install hermes-agent",
              description: "Or use the curl installer: curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash",
              risk: "high",
              requiresConfirmation: true,
              manualSteps: [
                "Run: pip install hermes-agent",
                "After installation, reload your shell: source ~/.bashrc",
                "Verify with: hermes --version",
              ],
              rollback: "pip uninstall hermes-agent -y",
            }),
          ],
        ),
      ];
    }

    // If hermes is on PATH but version couldn't be determined (e.g. safety skip),
    // it's informational, not broken
    if (inst.onPath) {
      return [
        finding(
          "install-version",
          "install",
          "info",
          0,
          "Hermes Version Unknown",
          "Hermes was found but version could not be determined. The version probe may have been skipped for safety.",
          ev,
        ),
      ];
    }

    return [
      finding(
        "install-version",
        "install",
        "broken",
        3,
        "Hermes Version Not Detected",
        "Could not determine Hermes version. The executable may be missing or broken.",
        ev,
        [
          fix("Install Hermes", {
            command: "pip install hermes-agent",
            description: "Or use the curl installer: curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash",
            risk: "high",
            requiresConfirmation: true,
            manualSteps: [
              "Run: pip install hermes-agent",
              "After installation, reload your shell: source ~/.bashrc",
              "Verify with: hermes --version",
            ],
            rollback: "pip uninstall hermes-agent -y",
          }),
          fix("Check installation", {
            command: "which hermes && hermes --version",
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Install method reported.
 * VAL-INST-003: Install method reported
 */
export const installMethodCheck: Check = {
  id: "install-method",
  area: "install",
  title: "Install Method",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const inst = snapshot.install;
    const ev: Array<ReturnType<typeof evidence>> = [];

    if (inst.installMethod) {
      ev.push(evidence("install_method", inst.installMethod, "derived"));
    }

    const method = inst.installMethod ?? null;

    if (method && method !== "unknown") {
      return [
        finding(
          "install-method",
          "install",
          "ok",
          0,
          "Install Method Known",
          `Hermes was installed via: ${method}`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "install-method",
        "install",
        "info",
        0,
        "Install Method Unknown",
        method === "unknown"
          ? "Could not determine how Hermes was installed"
          : "No install method detected",
        ev,
      ),
    ];
  },
};

/**
 * Check: Permission errors surfaced.
 * VAL-INST-004: Permission errors surfaced
 */
export const permissionCheck: Check = {
  id: "install-permissions",
  area: "install",
  title: "Executable Permissions",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const inst = snapshot.install;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("permission_ok", String(inst.permissionOk ?? "unknown"), "file"),
    ];

    if (inst.permissionOk === true) {
      return [
        finding(
          "install-permissions",
          "install",
          "ok",
          0,
          "Executable Permissions OK",
          "Hermes executable is readable and executable",
          ev,
        ),
      ];
    }

    if (inst.permissionOk === false) {
      return [
        finding(
          "install-permissions",
          "install",
          "broken",
          4,
          "Executable Permission Issue",
          "Hermes executable is not readable or executable by the current user",
          ev,
          [
            fix("Fix permissions", {
              command: `chmod +x ${safePath(inst.executablePath ?? "<hermes-path>")}`,
              risk: "high",
              requiresConfirmation: true,
              manualSteps: [
                `Run: chmod +x ${inst.executablePath ?? "<hermes-path>"}`,
              ],
              rollback: `chmod -x ${safePath(inst.executablePath ?? "<hermes-path>")}`,
            }),
            fix("Reinstall Hermes", {
              command: "pip install hermes-agent",
              description: "Or use the curl installer: curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash",
              risk: "high",
              requiresConfirmation: true,
              manualSteps: [
                "Run: pip install hermes-agent",
                "After installation, reload your shell: source ~/.bashrc",
                "Verify with: hermes --version",
              ],
              rollback: "pip uninstall hermes-agent -y",
            }),
          ],
        ),
      ];
    }

    // No permission info (maybe hermes not found)
    return [
      finding(
        "install-permissions",
        "install",
        "info",
        0,
        "Executable Permissions",
        "No permission information available",
        ev,
      ),
    ];
  },
};

/** All install checks */
export const installChecks: Check[] = [
  executableCheck,
  versionCheck,
  installMethodCheck,
  permissionCheck,
];
