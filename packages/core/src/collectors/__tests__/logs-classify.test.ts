import { describe, expect, it } from "vitest";
import { classify } from "../logs.js";

// =========================================================================
// Log error classifier: unit tests for classify()
// =========================================================================
// The classifier must correctly identify real error types while avoiding
// false positives from naive substring matching on numeric values.
//
// Issue #10: "processed 401 records successfully" was classified as auth
// error because `\b401\b` matched standalone "401" as a word boundary.
// =========================================================================

describe("classify", () => {
  // =========================================================================
  // Auth: true positives (must still be classified)
  // =========================================================================
  describe("auth — true positives", () => {
    it("classifies '401 Unauthorized' as auth", () => {
      expect(classify("ERROR 401 Unauthorized: Invalid API key")).toBe("auth");
    });

    it("classifies '403 Forbidden' as auth", () => {
      expect(classify("ERROR 403 Forbidden: Token expired")).toBe("auth");
    });

    it("classifies 'Authentication failed' as auth", () => {
      expect(classify("ERROR Authentication failed: invalid credentials")).toBe("auth");
    });

    it("classifies 'Invalid API key' as auth", () => {
      expect(classify("ERROR Invalid API key for provider")).toBe("auth");
    });

    it("classifies 'unauthorized' as auth", () => {
      expect(classify("ERROR Unauthorized access detected")).toBe("auth");
    });

    it("classifies 'forbidden' as auth", () => {
      expect(classify("CRITICAL Forbidden: resource access denied")).toBe("auth");
    });

    it("classifies 'status 401' as auth", () => {
      expect(classify("ERROR Provider returned status 401")).toBe("auth");
    });

    it("classifies 'returned 401' as auth", () => {
      expect(classify("ERROR provider returned 401 error")).toBe("auth");
    });

    it("classifies 'HTTP 403' as auth", () => {
      expect(classify("ERROR HTTP 403 - access denied")).toBe("auth");
    });

    it("classifies 'response 401' as auth", () => {
      expect(classify("ERROR API response 401 unauthorized")).toBe("auth");
    });

    it("classifies 'code 403' as auth", () => {
      expect(classify("ERROR Error code 403 received")).toBe("auth");
    });

    it("classifies 'got 401' as auth", () => {
      expect(classify("ERROR got 401 from server")).toBe("auth");
    });

    it("classifies 'colon-prefixed 401' as auth", () => {
      expect(classify("ERROR status: 401 Unauthorized")).toBe("auth");
    });

    it("classifies 'equals-prefixed 401' as auth", () => {
      expect(classify("ERROR status=401 Unauthorized")).toBe("auth");
    });
  });

  // =========================================================================
  // Auth: false positives (must NOT be classified as auth)
  // =========================================================================
  describe("auth — false positives prevented", () => {
    it("does NOT classify 'processed 401 records' as auth", () => {
      expect(classify("ERROR processed 401 records successfully")).not.toBe("auth");
    });

    it("does NOT classify '4012 records' as auth", () => {
      expect(classify("ERROR processed 4012 records")).not.toBe("auth");
    });

    it("does NOT classify 'code 4012' as auth", () => {
      expect(classify("ERROR code 4012 is invalid")).not.toBe("auth");
    });

    it("does NOT classify '14015 timeout' as auth", () => {
      expect(classify("ERROR Connection 14015 timed out")).not.toBe("auth");
    });

    it("does NOT classify 'page 403 of' as auth", () => {
      expect(classify("ERROR See page 403 of the manual")).not.toBe("auth");
    });

    it("does NOT classify 'item #4032' as auth", () => {
      expect(classify("ERROR item #4032 not found")).not.toBe("auth");
    });
  });

  // =========================================================================
  // Auth: edge cases with HTTP_STATUS_KEYWORDS proximity
  // =========================================================================
  describe("auth — edge cases", () => {
    it("does NOT classify 'error 401' without context keyword as auth", () => {
      // "error" is NOT in the HTTP_STATUS_KEYWORDS list because it's too
      // common and would cause false positives — 401 must be adjacent to
      // status/code/http/response/returned/got
      expect(classify("ERROR 401")).toBe("unknown");
    });

    it("classifies 'status code 401' as auth (two keywords)", () => {
      expect(classify("ERROR status code 401")).toBe("auth");
    });
  });

  // =========================================================================
  // Rate limit: true positives (must still be classified)
  // =========================================================================
  describe("rate_limit — true positives", () => {
    it("classifies 'rate limit exceeded' as rate_limit", () => {
      expect(classify("ERROR Rate limit exceeded")).toBe("rate_limit");
    });

    it("classifies 'too many requests' as rate_limit", () => {
      expect(classify("ERROR Too many requests")).toBe("rate_limit");
    });

    it("classifies 'quota exceeded' as rate_limit", () => {
      expect(classify("ERROR Quota exceeded for this month")).toBe("rate_limit");
    });

    it("classifies 'status 429' as rate_limit", () => {
      expect(classify("ERROR status 429 Too Many Requests")).toBe("rate_limit");
    });

    it("classifies 'HTTP 429' as rate_limit", () => {
      expect(classify("ERROR HTTP 429 rate limited")).toBe("rate_limit");
    });

    it("classifies 'returned 429' as rate_limit", () => {
      expect(classify("ERROR API returned 429 quota exceeded")).toBe("rate_limit");
    });
  });

  // =========================================================================
  // Rate limit: false positives (must NOT be classified as rate_limit)
  // =========================================================================
  describe("rate_limit — false positives prevented", () => {
    it("does NOT classify 'processed 429 payments' as rate_limit", () => {
      expect(classify("ERROR processed 429 payments")).not.toBe("rate_limit");
    });

    it("does NOT classify '4290 items' as rate_limit", () => {
      expect(classify("ERROR found 4290 items")).not.toBe("rate_limit");
    });

    it("does NOT classify 'item_429' as rate_limit", () => {
      expect(classify("ERROR item_429 not found")).not.toBe("rate_limit");
    });
  });

  // =========================================================================
  // Network: classification unchanged (already specific)
  // =========================================================================
  describe("network — true positives", () => {
    it("classifies ECONNREFUSED as network", () => {
      expect(classify("ERROR ECONNREFUSED on 0.0.0.0:8080")).toBe("network");
    });

    it("classifies ETIMEDOUT as network", () => {
      expect(classify("ERROR ETIMEDOUT connecting to provider")).toBe("network");
    });

    it("classifies ENOTFOUND as network", () => {
      expect(classify("ERROR ENOTFOUND - DNS resolution failed")).toBe("network");
    });
  });

  // =========================================================================
  // Model: classification unchanged
  // =========================================================================
  describe("model — true positives", () => {
    it("classifies 'model not found' as model", () => {
      expect(classify("ERROR model 'claude-opus-99' not found")).toBe("model");
    });

    it("classifies 'context window' as model", () => {
      expect(classify("ERROR Context window exceeded")).toBe("model");
    });

    it("classifies 'token limit' as model", () => {
      expect(classify("ERROR Token limit exceeded for request")).toBe("model");
    });
  });

  // =========================================================================
  // MCP: classification unchanged
  // =========================================================================
  describe("mcp — true positives", () => {
    it("classifies 'MCP server' as mcp", () => {
      expect(classify("ERROR MCP server database exited")).toBe("mcp");
    });

    it("classifies 'tool server' as mcp", () => {
      expect(classify("ERROR Tool server connection lost")).toBe("mcp");
    });
  });

  // =========================================================================
  // Permission: classification unchanged
  // =========================================================================
  describe("permission — true positives", () => {
    it("classifies EACCES as permission", () => {
      expect(classify("ERROR EACCES: permission denied")).toBe("permission");
    });

    it("classifies 'access denied' as permission", () => {
      expect(classify("ERROR access denied: cannot read file")).toBe("permission");
    });

    it("classifies 'operation not permitted' as permission", () => {
      expect(classify("ERROR operation not permitted")).toBe("permission");
    });
  });

  // =========================================================================
  // Unknown: errors that should not match any classifier
  // =========================================================================
  describe("unknown — fallthrough", () => {
    it("classifies generic error as unknown", () => {
      expect(classify("ERROR Out of memory")).toBe("unknown");
    });

    it("classifies ENOSPC as unknown", () => {
      expect(classify("ERROR ENOSPC: no space left on device")).toBe("unknown");
    });

    it("classifies YAML error as unknown", () => {
      expect(classify("ERROR Invalid YAML syntax at line 42")).toBe("unknown");
    });

    it("classifies module import error as unknown", () => {
      expect(classify("ERROR Cannot find module 'hermes-plugin-xyz'")).toBe("unknown");
    });
  });
});
