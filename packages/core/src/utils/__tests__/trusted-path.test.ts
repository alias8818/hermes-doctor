import { describe, expect, it } from "vitest";

import { envForTrustedProbes, trustedPathDirectories } from "../trusted-path.js";

describe("trusted-path", () => {
  it("uses standard system directories only", () => {
    const dirs = trustedPathDirectories("linux");
    expect(dirs).toContain("/usr/bin");
    expect(dirs).not.toContain(".");
    expect(dirs).not.toContain("");
  });

  it("prepends trusted dirs to existing PATH in probe environment", () => {
    const env = envForTrustedProbes({
      PATH: "/tmp/evil:/home/attacker/bin",
      HOME: "/home/user",
    });
    // Trusted dirs come first
    const parts = env.PATH?.split(":") ?? [];
    const trustedIdx = parts.indexOf("/usr/bin");
    expect(trustedIdx).toBeGreaterThanOrEqual(0);
    // Original PATH entries are still present (after trusted dirs)
    expect(env.PATH).toContain("/tmp/evil");
    expect(env.PATH).toContain("/home/attacker/bin");
    // Other env vars are preserved
    expect(env.HOME).toBe("/home/user");
  });
});
