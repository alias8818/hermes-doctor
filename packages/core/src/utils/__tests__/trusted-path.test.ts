import { describe, expect, it } from "vitest";

import { envForTrustedProbes, trustedPathDirectories } from "../trusted-path.js";

describe("trusted-path", () => {
  it("uses standard system directories only", () => {
    const dirs = trustedPathDirectories("linux");
    expect(dirs).toContain("/usr/bin");
    expect(dirs).not.toContain(".");
    expect(dirs).not.toContain("");
  });

  it("replaces PATH in probe environment", () => {
    const env = envForTrustedProbes({
      PATH: "/tmp/evil:/home/attacker/bin",
      HOME: "/home/user",
    });
    expect(env.PATH).not.toContain("/tmp/evil");
    expect(env.PATH).toContain("/usr/bin");
    expect(env.HOME).toBe("/home/user");
  });
});
