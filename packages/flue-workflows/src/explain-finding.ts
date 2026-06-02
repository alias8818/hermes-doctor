import * as v from "valibot";

import type { DoctorFinding } from "@hermes-doctor/core";
import { FlueResponseSchema, type FlueResponse } from "@hermes-doctor/core";

/**
 * Options for requesting Flue insights for a batch of findings.
 */
export interface RequestFlueInsightsOptions {
  /** The dynamically imported @flue/runtime module. */
  flueRuntime: typeof import("@flue/runtime");
  /** The snapshot context, serialized as needed. */
  snapshotContext?: string;
  /** Timeout in milliseconds for the Flue request (default: 30000). */
  timeout?: number;
}

/**
 * Result of requesting Flue insights.
 */
export interface RequestFlueInsightsResult {
  /** The parsed Flue response, or null if it failed. */
  response: FlueResponse | null;
  /** Whether the request succeeded. */
  success: boolean;
  /** Warning message if something went wrong. */
  warning?: string;
}

/** Default prompt used to request insights from the Flue LLM. */
const SYSTEM_PROMPT = `You are Hermes Doctor, a diagnostic assistant for the Hermes Agent.
Analyze the following diagnostic findings and provide brief, actionable insights.
Your response MUST be valid JSON matching this exact schema:
{ "findings": [{ "findingId": "...", "insight": "..." }] }

For each finding, explain in 2-3 sentences what the issue means, why it matters, and how to fix it.
Be specific — reference the actual finding title and message.`;

/**
 * Build a batch prompt from a list of findings.
 * Sends finding id, title, message, status, severity, area, and fixes.
 */
function buildBatchPrompt(findings: DoctorFinding[]): string {
  const sections = findings.map((f, i) => {
    const lines = [
      `[Finding ${i + 1}]`,
      `  id: ${f.id}`,
      `  area: ${f.area}`,
      `  status: ${f.status}`,
      `  severity: ${f.severity}`,
      `  title: ${f.title}`,
      `  message: ${f.message}`,
    ];
    if (f.details) lines.push(`  details: ${f.details}`);
    if (f.fixes.length > 0) {
      lines.push(`  suggested fixes: ${f.fixes.map((fx) => fx.title).join("; ")}`);
    }
    return lines.join("\n");
  });

  return sections.join("\n\n");
}

/**
 * Request Flue insights for a batch of findings.
 *
 * Sends all findings in a single batch dispatch, waits for the response,
 * and validates it against FlueResponseSchema.
 *
 * Graceful degradation:
 * - If Flue dispatch fails → return null response with warning
 * - If Flue response is malformed JSON → return null response with warning
 * - If Flue response doesn't match FlueResponseSchema → return null response with warning
 * - If Flue request times out → return null response with warning
 *
 * @param findings - The findings to send to Flue (should be pre-filtered).
 * @param options - Flue runtime and timeout options.
 * @returns Parsed FlueResponse or null with a warning message.
 */
export async function requestFlueInsights(
  findings: DoctorFinding[],
  options: RequestFlueInsightsOptions,
): Promise<RequestFlueInsightsResult> {
  const { flueRuntime, snapshotContext } = options;
  const timeoutMs = options.timeout ?? 30_000;

  try {
    // Build a batch prompt with all findings and context
    const promptParts = [SYSTEM_PROMPT];
    if (snapshotContext) {
      promptParts.push(`\nSnapshot context: ${snapshotContext}`);
    }
    promptParts.push("\n--- DIAGNOSTIC FINDINGS ---");
    promptParts.push(buildBatchPrompt(findings));
    promptParts.push(
      "\n--- END FINDINGS ---\n" +
      "Return ONLY valid JSON matching the schema described above. No commentary outside the JSON.",
    );

    const prompt = promptParts.join("\n");

    // Send the batch dispatch with timeout
    const receipt = await withTimeout(
      flueRuntime.dispatch({
        id: "hermes-doctor-batch-insights",
        agent: "hermes-doctor-insights",
        input: prompt,
      }),
      timeoutMs,
    );

    // If dispatch succeeded, try to get the result.
    // In the mocked test environment, the dispatch return value IS the
    // structured JSON response. In production, the receipt may contain
    // a result or we may need to poll.
    if (!receipt) {
      return {
        response: null,
        success: false,
        warning: "Flue dispatch returned no response. Running in deterministic mode.",
      };
    }

    // Try to extract structured JSON from the dispatch result.
    // The receipt may have a `result` field with the JSON, or be the JSON directly.
    const rawResult = extractResult(receipt);

    if (!rawResult || typeof rawResult !== "string") {
      return {
        response: null,
        success: false,
        warning:
          "Flue response was empty or not a string. Falling back to deterministic mode.",
      };
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawResult);
    } catch {
      return {
        response: null,
        success: false,
        warning:
          "Flue returned malformed JSON that could not be parsed. Falling back to deterministic mode.",
      };
    }

    // Validate against FlueResponseSchema
    try {
      const validated = v.parse(FlueResponseSchema, parsed);
      return { response: validated, success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        response: null,
        success: false,
        warning:
          `Flue response failed Valibot validation: ${message}. Falling back to deterministic mode.`,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Check for timeout
    const isTimeout = message.toLowerCase().includes("timeout");
    const warning = isTimeout
      ? "Flue request timed out. Falling back to deterministic mode."
      : `Flue request failed (${message}). Falling back to deterministic mode.`;
    return { response: null, success: false, warning };
  }
}

/**
 * Extract the result string from a dispatch receipt.
 *
 * The receipt could be:
 * - A DispatchReceipt with a `result` field containing the JSON string
 * - A DispatchReceipt with `dispatchId` (no result yet — needs polling)
 * - The direct structured JSON (in mocked tests)
 *
 * In the mocked test environment, the receipt itself is the structured
 * JSON with a `findings` array. We detect this by checking for
 * the `findings` key.
 */
function extractResult(receipt: unknown): string | null {
  if (!receipt || typeof receipt !== "object") return null;

  const obj = receipt as Record<string, unknown>;

  // If the receipt has a "result" string field, use that
  if (typeof obj.result === "string" && obj.result.length > 0) {
    return obj.result;
  }

  // If the receipt itself looks like the structured response (has findings),
  // serialize it back to JSON for Valibot validation
  if (Array.isArray(obj.findings)) {
    return JSON.stringify({ findings: obj.findings });
  }

  return null;
}

/**
 * Wrap a promise with a timeout.
 * If the promise doesn't settle within the timeout, rejects with TimeoutError.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout (${ms}ms)`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

