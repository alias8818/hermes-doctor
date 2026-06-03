import type { CollectorResult } from "../schemas/collector.js";
import {
  asBoolean,
  asNumber,
  asRecord,
  asString,
  loadHermesConfig,
  pick,
} from "../utils/config.js";
import type { CollectorContext } from "./context.js";
import type { DashboardData } from "./data.js";
import { isLocalhostUrl, parseHost, probeHttp } from "./probe.js";
import { addEvidence, finalize, runArea } from "./result.js";

const EMPTY: DashboardData = { probed: false };

function dashboardSection(
  parsed: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!parsed) return null;
  return (
    asRecord(parsed.dashboard) ?? asRecord(parsed.ui) ?? asRecord(parsed.server)
  );
}

/**
 * Check for the Hermes v24 display.platforms.api_server binding as a fallback
 * dashboard URL source when no explicit dashboard section is configured.
 *
 * In Hermes v24, api_server can be:
 *   - A string URL: "http://0.0.0.0:8642"
 *   - An object: { enabled: true, host: "0.0.0.0", port: 8642 }
 */
function displayApiServerBinding(
  parsed: Record<string, unknown> | null,
): { url: string; bindAddress: string | null } | null {
  if (!parsed) return null;
  const display = asRecord(parsed.display);
  if (!display) return null;
  const platforms = asRecord(display.platforms);
  if (!platforms) return null;
  const apiServer = platforms.api_server;
  if (!apiServer) return null;

  // Handle string format: "host:port" or "http://host:port"
  const strVal = asString(apiServer);
  if (strVal) {
    const host = parseHost(strVal);
    return { url: strVal, bindAddress: host ?? null };
  }

  // Handle object format: { enabled: true, host: "0.0.0.0", port: 8642 }
  const obj = asRecord(apiServer);
  if (obj) {
    const enabled = asBoolean(pick(obj, "enabled"));
    if (enabled === false) return null; // explicitly disabled
    const hostVal = asString(pick(obj, "host", "hostname", "address")) ?? "127.0.0.1";
    const portVal = asNumber(pick(obj, "port"));
    const url = portVal ? `http://${hostVal}:${portVal}` : `http://${hostVal}`;
    return { url, bindAddress: hostVal };
  }

  return null;
}

export async function collectDashboard(
  ctx: CollectorContext,
): Promise<CollectorResult<DashboardData>> {
  return runArea("dashboard", EMPTY, ctx.redaction, async (acc) => {
    const config = await loadHermesConfig(ctx.paths.config);
    const section = dashboardSection(config.parsed);

    let url = asString(pick(section, "url", "address", "endpoint"));
    let bindAddress = asString(
      pick(section, "bind", "bind_address", "host", "hostname"),
    );
    let sourceLabel = "dashboard";

    // Fallback to display.platforms.api_server (Hermes v24 location)
    if (!url && !bindAddress) {
      const apiBinding = displayApiServerBinding(config.parsed);
      if (apiBinding) {
        url = apiBinding.url;
        bindAddress = apiBinding.bindAddress;
        sourceLabel = "display.platforms.api_server";
      }
    }

    if (!url && !bindAddress) {
      acc.warnings.push("no dashboard configured");
      const data: DashboardData = {
        url: null,
        reachable: false,
        statusCode: null,
        responseTimeMs: null,
        bindAddress: null,
        isLocalhost: false,
        authRequired: false,
        tls: false,
        certValid: null,
        probed: false,
      };
      return finalize("dashboard", "skipped", data, acc, ctx.redaction);
    }

    const tls = url
      ? url.startsWith("https://")
      : (asBoolean(pick(section, "tls", "https")) ?? false);
    const configuredAuth = asBoolean(
      pick(section, "auth", "auth_required", "authentication"),
    );
    const host = url ? parseHost(url) : (bindAddress?.toLowerCase() ?? null);
    const isLocalhost = url
      ? isLocalhostUrl(url)
      : isLocalAddress(bindAddress);

    const configSource = sourceLabel === "display.platforms.api_server" ? "config.yaml (display.platforms.api_server)" : "config.yaml";
    if (url) addEvidence(acc, "Dashboard URL", url, configSource);
    if (bindAddress) addEvidence(acc, "Bind address", bindAddress, configSource);

    const data: DashboardData = {
      url: url ?? null,
      reachable: false,
      statusCode: null,
      responseTimeMs: null,
      bindAddress: bindAddress ?? null,
      isLocalhost,
      authRequired: configuredAuth ?? false,
      tls,
      certValid: null,
      probed: false,
    };

    if (url && isLocalhost) {
      const probe = await probeHttp(url, ctx.dashboardTimeoutMs, {
        rejectUnauthorized: false,
      });
      data.probed = true;
      data.reachable = probe.reachable;
      data.statusCode = probe.statusCode;
      data.responseTimeMs = probe.latencyMs;
      if (probe.reachable) {
        addEvidence(
          acc,
          "Probe",
          `HTTP ${probe.statusCode ?? "?"} in ${probe.latencyMs ?? "?"}ms`,
        );
        if (probe.statusCode === 401 || probe.statusCode === 403) {
          data.authRequired = true;
        }
      } else if (probe.timedOut) {
        acc.warnings.push(
          `dashboard probe timed out after ${ctx.dashboardTimeoutMs}ms`,
        );
      } else {
        acc.warnings.push(`dashboard not reachable: ${probe.error ?? "unknown"}`);
      }
    } else if (url) {
      data.probed = false;
      acc.warnings.push(
        `dashboard host ${host ?? "remote"} is not localhost; configured but not probed`,
      );
    }

    return finalize("dashboard", "collected", data, acc, ctx.redaction);
  });
}

function isLocalAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}
