export interface ProbeResult { reachable: boolean; statusCode: number | null; latencyMs: number | null; timedOut: boolean; error: string | null; }
export interface ProbeOptions { rejectUnauthorized?: boolean; }

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function parseHost(rawUrl: string): string | null {
  try { const url = new URL(rawUrl); return url.hostname.toLowerCase(); } catch { return null; }
}

export function isLocalhostUrl(rawUrl: string): boolean {
  const host = parseHost(rawUrl);
  if (host === null) return false;
  return LOCALHOST_HOSTS.has(host);
}

export function isPublicBindAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "0.0.0.0" || normalized === "::") return true;
  return !LOCALHOST_HOSTS.has(normalized);
}

export async function probeHttp(rawUrl: string, timeoutMs: number, options?: ProbeOptions): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  const origRejectEnv = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  const bypassTls = options?.rejectUnauthorized === false;
  if (bypassTls) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }

  try {
    const response = await fetch(rawUrl, { signal: controller.signal, redirect: "manual" });
    const raw = performance.now() - start;
    return { reachable: true, statusCode: response.status, latencyMs: Math.round(raw / 10) * 10, timedOut: false, error: null };
  } catch (error) {
    const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    const raw = performance.now() - start;
    return { reachable: false, statusCode: null, latencyMs: Math.round(raw / 10) * 10, timedOut: aborted, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (bypassTls) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = origRejectEnv; }
    clearTimeout(timer);
  }
}
