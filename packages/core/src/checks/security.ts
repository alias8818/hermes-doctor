import type { HermesSnapshot } from "../schemas/snapshot.js";
import { safeFileMode, safePath, shellQuote } from "../utils/shell-safe.js";
import { evidence, finding, fix, type Check } from "./types.js";

/**
 * Check: Dashboard public binding risk.
 * VAL-SEC-001: Dashboard public binding risk
 */
export const publicBindingCheck: Check = {
  id: "security-public-binding",
  area: "security",
  title: "Dashboard Public Binding",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const sec = snapshot.security;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("public_binding", String(sec.publicBinding ?? false), "config"),
      evidence("bind_address", sec.bindAddress ?? "(unknown)", "config"),
    ];

    if (!sec.publicBinding) {
      return [
        finding(
          "security-public-binding",
          "security",
          "ok",
          0,
          "Dashboard Not Publicly Bound",
          `Dashboard is bound to ${sec.bindAddress ?? "localhost"} (not publicly exposed)`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "security-public-binding",
        "security",
        "risk",
        4,
        "Dashboard Exposed to Network",
        `Dashboard is bound to ${sec.bindAddress ?? "0.0.0.0"}, making it accessible from other machines`,
        ev,
        [
          fix("Bind to localhost only", {
            command: "Set 'bind: 127.0.0.1' in the dashboard section of config.yaml",
            risk: "low",
          }),
          fix("Use a reverse proxy with authentication", {
            command: "Configure nginx or Caddy as a reverse proxy with auth for secure remote access",
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Secrets redacted in logs and findings.
 * VAL-SEC-002: Secrets redacted in logs and findings
 */
export const secretLeaksCheck: Check = {
  id: "security-secret-leaks",
  area: "security",
  title: "Secret Leak Detection",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const sec = snapshot.security;
    const secretLeaks = sec.secretLeaks ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("secret_leaks", JSON.stringify(
        secretLeaks.map((l) => ({
          location: l.location,
          secret_type: l.secretType,
          masked_value: l.maskedValue,
        })),
      ), "file", "medium", true),
    ];

    if (secretLeaks.length === 0) {
      return [
        finding(
          "security-secret-leaks",
          "security",
          "ok",
          0,
          "No Secret Leaks Detected",
          "No API keys, tokens, or secrets found exposed in config or logs",
          ev,
        ),
      ];
    }

    return [
      finding(
        "security-secret-leaks",
        "security",
        "risk",
        4,
        "Secret Leaks Found",
        `${secretLeaks.length} potential secret leak(s) detected across ${[...new Set(secretLeaks.map((l) => l.location))].join(", ")}`,
        ev,
        [
          fix("Rotate exposed keys", {
            command: "Revoke and regenerate any exposed API keys immediately",
            risk: "high",
            requiresConfirmation: true,
            manualSteps: [
              "Revoke the compromised API keys from the provider's dashboard",
              "Generate new API keys from the provider's dashboard",
              "Update your config.yaml and .env files with the new keys",
            ],
            rollback: "Re-activate old API keys in provider dashboard (if supported)",
          }),
          fix("Move secrets to .env file", {
            command: "Remove API keys from config.yaml and add them to ~/.hermes/.env instead",
            risk: "low",
          }),
          fix("Check for committed secrets", {
            command: 'git log -p | grep -i "api_key\\|token\\|secret" | head -20',
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Terminal backend risk assessed.
 * VAL-SEC-003: Terminal backend risk assessed
 */
export const terminalBackendCheck: Check = {
  id: "security-terminal-backend",
  area: "security",
  title: "Terminal Backend Security",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const sec = snapshot.security;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("terminal_backend", sec.terminalBackend ?? "(not configured)", "config"),
      evidence("shell_restricted", String(sec.shellRestricted ?? false), "config"),
      evidence("sandbox_enabled", String(sec.sandboxEnabled ?? false), "config"),
    ];

    if (!sec.terminalBackend) {
      return [
        finding(
          "security-terminal-backend",
          "security",
          "info",
          0,
          "No Terminal Backend Configured",
          "No shell-based terminal backend is configured",
          ev,
        ),
      ];
    }

    if (sec.sandboxEnabled) {
      return [
        finding(
          "security-terminal-backend",
          "security",
          "ok",
          0,
          "Terminal Backend Sandboxed",
          `Terminal backend "${sec.terminalBackend}" is sandboxed for security`,
          ev,
        ),
      ];
    }

    if (sec.shellRestricted) {
      return [
        finding(
          "security-terminal-backend",
          "security",
          "warning",
          2,
          "Terminal Backend Partially Restricted",
          `Terminal backend "${sec.terminalBackend}" has restricted commands but no sandbox`,
          ev,
          [
            fix("Enable sandbox for terminal backend", {
              command: "Configure sandbox settings in the security section of config.yaml",
              risk: "low",
            }),
          ],
        ),
      ];
    }

    return [
      finding(
        "security-terminal-backend",
        "security",
        "risk",
        4,
        "Unrestricted Terminal Backend",
        `Terminal backend "${sec.terminalBackend}" has no sandbox or command restrictions — potential command injection risk`,
        ev,
        [
          fix("Restrict shell access", {
            command: "Configure restricted commands and enable sandbox in the security section of config.yaml",
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: File permissions checked.
 * VAL-SEC-004: File permissions checked
 */
export const filePermissionsCheck: Check = {
  id: "security-file-permissions",
  area: "security",
  title: "File Permissions",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const sec = snapshot.security;
    const permissionIssues = sec.permissionIssues ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("permission_issues", JSON.stringify(
        permissionIssues.map((p) => ({
          path: p.path,
          current_mode: p.currentMode,
          suggested_mode: p.suggestedMode,
        })),
      ), "file"),
    ];

    if (permissionIssues.length === 0) {
      return [
        finding(
          "security-file-permissions",
          "security",
          "ok",
          0,
          "File Permissions OK",
          "No overly permissive file permissions detected",
          ev,
        ),
      ];
    }

    return [
      finding(
        "security-file-permissions",
        "security",
        "risk",
          4,
        "Overly Permissive File Permissions",
        `${permissionIssues.length} file(s) have overly permissive permissions`,
        ev,
        permissionIssues.slice(0, 3).map((p) =>
          fix(`Fix permissions for ${p.path}`, {
            command: `chmod ${safeFileMode(p.suggestedMode)} ${safePath(p.path)}`,
            description: `Current mode: ${p.currentMode}, suggested: ${p.suggestedMode}`,
            risk: "medium",
            requiresConfirmation: true,
            manualSteps: [
              `Run: chmod ${p.suggestedMode} ${p.path}`,
              "This will change file permissions to the recommended mode",
            ],
            rollback: `chmod ${safeFileMode(p.currentMode)} ${safePath(p.path)}`,
          }),
        ),
      ),
    ];
  },
};

/**
 * Check: Environment variable exposure assessed.
 * VAL-SEC-005: Environment variable exposure assessed
 */
export const envExposureCheck: Check = {
  id: "security-env-exposure",
  area: "security",
  title: "Environment Variable Exposure",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const sec = snapshot.security;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("env_exposure", String(sec.envExposure ?? false), "derived"),
    ];

    if (sec.exposedVars && sec.exposedVars.length > 0) {
      ev.push(evidence("exposed_vars", JSON.stringify(sec.exposedVars), "derived"));
    }

    if (!sec.envExposure) {
      return [
        finding(
          "security-env-exposure",
          "security",
          "ok",
          0,
          "Environment Variables Secure",
          "No sensitive environment variables appear to be exposed",
          ev,
        ),
      ];
    }

    return [
      finding(
        "security-env-exposure",
        "security",
        "risk",
        4,
        "Environment Variable Exposure Detected",
        `${sec.exposedVars?.length ?? 0} sensitive environment variable(s) may be exposed: ${(sec.exposedVars ?? []).join(", ")}`,
        ev,
        [
          fix("Secure exposed environment variables", {
            command: "Remove sensitive values from shell history and process listings",
            risk: "low",
          }),
          fix("Use .env file for secrets", {
            command: "Store API keys in ~/.hermes/.env instead of exporting them in shell profile",
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Unsafe eval/dynamic execution detected.
 * VAL-SEC-006: Unsafe eval/dynamic execution detected
 */
export const dynamicExecCheck: Check = {
  id: "security-dynamic-exec",
  area: "security",
  title: "Unsafe Dynamic Execution",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const sec = snapshot.security;
    const dynBlocks = sec.dynamicExecBlocks ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("dynamic_exec_blocks", JSON.stringify(
        dynBlocks.map((b) => ({
          location: b.location,
          pattern: b.pattern,
          risk_level: b.riskLevel,
        })),
      ), "config"),
    ];

    if (dynBlocks.length === 0) {
      return [
        finding(
          "security-dynamic-exec",
          "security",
          "ok",
          0,
          "No Unsafe Dynamic Execution",
          "No eval/exec patterns detected in configuration",
          ev,
        ),
      ];
    }

    return [
      finding(
        "security-dynamic-exec",
        "security",
        "risk",
        4,
        "Unsafe Dynamic Execution Detected",
        `${dynBlocks.length} unsafe eval/exec pattern(s) found in configuration`,
        ev,
        dynBlocks.slice(0, 3).map((b) =>
          fix(`Remove unsafe pattern at ${b.location}`, {
            command: `Avoid using ${shellQuote(b.pattern)} in configuration. Use static declarations instead.`,
            risk: "low",
          }),
        ),
      ),
    ];
  },
};

/** All security checks */
export const securityChecks: Check[] = [
  publicBindingCheck,
  secretLeaksCheck,
  terminalBackendCheck,
  filePermissionsCheck,
  envExposureCheck,
  dynamicExecCheck,
];
