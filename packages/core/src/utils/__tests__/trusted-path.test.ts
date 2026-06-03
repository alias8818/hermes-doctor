import { describe, expect, it } from "vitest";

import { envForTrustedProbes, trustedPathDirectories } from "../trusted-path.js";

describe("trusted-path", () => {
  it("uses standard system directories only", () => {
    const dirs = trustedPathDirectories("linux");
    expect(dirs).toContain("/usr/bin");
    expect(dirs).not.toContain(".");
    expect(dirs).not.toContain("");
  });

  it("restricts PATH to trusted system directories only", () => {
    const env = envForTrustedProbes({
      PATH: "/tmp/evil:/home/attacker/bin",
      HOME: "/home/user",
    });
    // Trusted dirs are present
    const parts = env.PATH?.split(":") ?? [];
    expect(parts).toContain("/usr/bin");
    // Untrusted PATH entries are excluded
    expect(env.PATH).not.toContain("/tmp/evil");
    expect(env.PATH).not.toContain("/home/attacker/bin");
    // Other env vars are preserved
    expect(env.HOME).toBe("/home/user");
  });
});
