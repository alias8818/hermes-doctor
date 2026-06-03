import type { HermesSnapshot } from "../schemas/snapshot.js";
import { shellQuote } from "../utils/shell-safe.js";
import { evidence, finding, fix, type Check } from "./types.js";

/**
 * Check: Dashboard reachable.
 * VAL-DASH-001: Dashboard reachable
 */
export const dashboardReachableCheck: Check = {
  id: "dashboard-reachable",
  area: "dashboard",
  title: "Dashboard Reachability",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const dash = snapshot.dashboard;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("url", dash.url ?? "(not configured)", "config"),
      evidence("reachable", String(dash.reachable ?? false), "dashboard-api"),
    ];

    if (dash.statusCode !== undefined && dash.statusCode !== null) {
      ev.push(evidence("status_code", String(dash.statusCode), "dashboard-api"));
    }
    if (dash.responseTimeMs !== undefined && dash.responseTimeMs !== null) {
      ev.push(evidence("response_time_ms", String(dash.responseTimeMs), "dashboard-api"));
    }

    if (!dash.url) {
      return [
        finding(
          "dashboard-reachable",
          "dashboard",
          "info",
          0,
          "No Dashboard Configured",
          "No dashboard URL is configured",
          ev,
        ),
      ];
    }

    if (dash.reachable) {
      return [
        finding(
          "dashboard-reachable",
          "dashboard",
          "ok",
          0,
          "Dashboard Reachable",
          `Dashboard at ${dash.url} is reachable (status: ${dash.statusCode ?? "?"})`,
          ev,
        ),
      ];
    }

    if (dash.probed === false) {
      return [
        finding(
          "dashboard-reachable",
          "dashboard",
          "info",
          0,
          "Dashboard Not Probed (Remote URL)",
          `Dashboard at ${dash.url} was not probed (remote URL; only localhost is probed)`,
          ev,
        ),
      ];
    }

    // If the probe ran but reachability is unknown (collector failed, timeout, etc.),
    // report uncertain status rather than falsely claiming unreachable
    if (dash.reachable === undefined || dash.reachable === null) {
      return [
        finding(
          "dashboard-reachable",
          "dashboard",
          "unknown",
          0,
          "Dashboard Reachability Unknown",
          `Dashboard at ${dash.url} could not be probed — reachability status is unknown`,
          ev,
          [
            fix("Check dashboard connectivity manually", {
              command: `curl -s -o /dev/null -w "%{http_code}" ${shellQuote(dash.url ?? "http://127.0.0.1:8080")}`,
              risk: "low",
            }),
          ],
        ),
      ];
    }

    return [
      finding(
        "dashboard-reachable",
        "dashboard",
        "broken",
        3,
        "Dashboard Unreachable",
        `Dashboard at ${dash.url} is not reachable`,
        ev,
        [
          fix("Check if dashboard service is running", {
            command: "systemctl status hermes-dashboard || ps aux | grep hermes",
            risk: "medium",
            requiresConfirmation: true,
            manualSteps: [
              "Run: systemctl status hermes-dashboard || ps aux | grep hermes",
              "Check if the dashboard service is active and running",
            ],
            rollback: "No changes made, this is a diagnostic command",
          }),
          fix("Verify dashboard URL", {
            command: `curl -sI ${shellQuote(dash.url ?? "http://127.0.0.1:8080")}`,
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Localhost binding verified.
 * VAL-DASH-002: Localhost binding verified
 */
export const localhostBindingCheck: Check = {
  id: "dashboard-localhost-binding",
  area: "dashboard",
  title: "Dashboard Localhost Binding",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const dash = snapshot.dashboard;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("bind_address", dash.bindAddress ?? "(unknown)", "config"),
      evidence("is_localhost", String(dash.isLocalhost ?? false), "derived"),
    ];

    if (dash.isLocalhost) {
      return [
        finding(
          "dashboard-localhost-binding",
          "dashboard",
          "ok",
          0,
          "Dashboard Bound to Localhost",
          `Dashboard is bound to ${dash.bindAddress ?? "127.0.0.1"} (localhost only)`,
          ev,
        ),
      ];
    }

    // 0.0.0.0 (IPv4 any) and :: (IPv6 any) both expose the dashboard to the network
    if (dash.bindAddress && (dash.bindAddress === "0.0.0.0" || dash.bindAddress === "::")) {
      return [
        finding(
          "dashboard-localhost-binding",
          "dashboard",
          "risk",
          4,
          "Dashboard Bound to All Interfaces",
          `Dashboard is bound to ${dash.bindAddress}, which exposes it to the network`,
          ev,
          [
            fix("Bind dashboard to localhost only", {
              command: "Change bind address to 127.0.0.1 in config.yaml",
              description: "dashboard:\n  bind: 127.0.0.1",
              risk: "low",
            }),
          ],
        ),
      ];
    }

    if (!dash.bindAddress) {
      return [
        finding(
          "dashboard-localhost-binding",
          "dashboard",
          "info",
          0,
          "Dashboard Binding Unknown",
          "No binding information available for the dashboard",
          ev,
        ),
      ];
    }

    return [
      finding(
        "dashboard-localhost-binding",
        "dashboard",
        "warning",
        2,
        "Dashboard Non-Localhost Binding",
        `Dashboard is bound to ${dash.bindAddress} (not localhost)`,
        ev,
        [
          fix("Bind to localhost", {
            command: "Set bind: 127.0.0.1 in config.yaml dashboard section",
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Authentication status reported.
 * VAL-DASH-003: Authentication status reported
 */
export const authCheck: Check = {
  id: "dashboard-auth",
  area: "dashboard",
  title: "Dashboard Authentication",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const dash = snapshot.dashboard;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("auth_required", String(dash.authRequired ?? false), "dashboard-api"),
    ];

    if (!dash.url) {
      return [
        finding(
          "dashboard-auth",
          "dashboard",
          "info",
          0,
          "No Dashboard Configured",
          "No dashboard is configured, so authentication is not applicable",
          ev,
        ),
      ];
    }

    if (dash.authRequired === undefined || dash.authRequired === null) {
      return [
        finding(
          "dashboard-auth",
          "dashboard",
          "info",
          0,
          "Dashboard Auth Status Unknown",
          "Could not determine whether the dashboard requires authentication",
          ev,
        ),
      ];
    }

    if (dash.authRequired) {
      return [
        finding(
          "dashboard-auth",
          "dashboard",
          "ok",
          0,
          "Dashboard Authentication Enabled",
          "Dashboard requires authentication",
          ev,
        ),
      ];
    }

    return [
      finding(
        "dashboard-auth",
        "dashboard",
        "risk",
        4,
        "Dashboard Authentication Disabled",
        "Dashboard does not require authentication — sensitive operations may be exposed",
        ev,
        [
          fix("Enable dashboard authentication", {
            command: "Add auth configuration to config.yaml dashboard section",
            risk: "low",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: HTTPS/TLS status reported.
 * VAL-DASH-004: HTTPS/TLS status reported
 */
export const tlsCheck: Check = {
  id: "dashboard-tls",
  area: "dashboard",
  title: "Dashboard HTTPS/TLS",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const dash = snapshot.dashboard;
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("tls", String(dash.tls ?? false), "dashboard-api"),
    ];

    if (dash.certValid !== undefined && dash.certValid !== null) {
      ev.push(evidence("cert_valid", String(dash.certValid), "dashboard-api"));
    }

    if (!dash.url) {
      return [
        finding(
          "dashboard-tls",
          "dashboard",
          "info",
          0,
          "No Dashboard Configured",
          "No TLS check needed (no dashboard configured)",
          ev,
        ),
      ];
    }

    if (dash.tls && dash.certValid === true) {
      return [
        finding(
          "dashboard-tls",
          "dashboard",
          "ok",
          0,
          "Dashboard TLS Enabled",
          "Dashboard uses HTTPS with a valid certificate",
          ev,
        ),
      ];
    }

    if (dash.tls && dash.certValid === false) {
      return [
        finding(
          "dashboard-tls",
          "dashboard",
          "warning",
          2,
          "Dashboard TLS Certificate Issue",
          "Dashboard uses HTTPS but certificate is invalid or self-signed",
          ev,
          [
            fix("Replace self-signed certificate", {
              command: "See documentation for generating a valid TLS certificate",
              risk: "low",
            }),
          ],
        ),
      ];
    }

    // dash.tls is undefined when the probe couldn't determine TLS status —
    // only flag plain HTTP when we're certain (explicit false)
    if (dash.tls === false) {
      return [
        finding(
          "dashboard-tls",
          "dashboard",
          "info",
          1,
          "Dashboard Uses Plain HTTP",
          "Dashboard is served over plain HTTP. Consider enabling HTTPS for production.",
          ev,
          [
            fix("Enable HTTPS", {
              command: "Add TLS configuration to config.yaml dashboard section",
              description: "See documentation for certificate generation",
              risk: "low",
            }),
          ],
        ),
      ];
    }

    return [
      finding(
        "dashboard-tls",
        "dashboard",
        "info",
          0,
        "Dashboard TLS Unknown",
        "Could not determine TLS status",
        ev,
      ),
    ];
  },
};

/** All dashboard checks */
export const dashboardChecks: Check[] = [
  dashboardReachableCheck,
  localhostBindingCheck,
  authCheck,
  tlsCheck,
];
