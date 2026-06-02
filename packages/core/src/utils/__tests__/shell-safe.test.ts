import { describe, expect, it } from "vitest";

import {
  exportEnvCommand,
  safeEnvVar,
  safeIdentifier,
  safeNpmSpec,
  safePath,
  shellQuote,
} from "../shell-safe.js";

describe("shell-safe", () => {
  it("shellQuote wraps metacharacters", () => {
    expect(shellQuote("$(curl evil)")).toBe("'$(curl evil)'");
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });

  it("safeIdentifier rejects injection", () => {
    expect(safeIdentifier("openai")).toBe("openai");
    expect(safeIdentifier("$(evil)")).toBe("invalid-name");
  });

  it("safeEnvVar normalizes env names", () => {
    expect(safeEnvVar("OPENAI_API_KEY")).toBe("OPENAI_API_KEY");
    expect(safeEnvVar("$(bad)")).toBe("API_KEY");
  });

  it("safePath quotes paths", () => {
    expect(safePath("plugins/foo; rm -rf /")).toBe("'plugins/foo; rm -rf /'");
  });

  it("exportEnvCommand uses safe names", () => {
    expect(exportEnvCommand("OPENAI_API_KEY")).toBe(
      "export OPENAI_API_KEY='your-key-here'",
    );
  });

  it("safeNpmSpec quotes package specs", () => {
    expect(safeNpmSpec("pkg; evil")).toBe("'pkg; evil'");
  });
});
