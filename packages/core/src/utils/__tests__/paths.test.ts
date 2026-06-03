import { describe, expect, it } from "vitest";
import * as os from "node:os";

import { resolveHermesHome } from "../paths.js";

describe("resolveHermesHome", () => {
  it("expands tilde in explicit path (#21)", () => {
    const homeDir = os.homedir();
    const result = resolveHermesHome({ hermesHome: "~/test-hermes" });
    expect(result).toBe(`${homeDir}/test-hermes`);
  });

  it("expands tilde followed by slash to home dir (#21)", () => {
    const homeDir = os.homedir();
    const result = resolveHermesHome({ hermesHome: "~/.hermes" });
    expect(result).toBe(`${homeDir}/.hermes`);
  });

  it("does not expand tilde in the middle of path", () => {
    const result = resolveHermesHome({ hermesHome: "/tmp/~test" });
    expect(result).toBe("/tmp/~test");
  });

  it("resolves absolute paths unchanged", () => {
    const result = resolveHermesHome({ hermesHome: "/absolute/path" });
    expect(result).toBe("/absolute/path");
  });

  it("resolves relative paths against cwd", () => {
    const result = resolveHermesHome({ hermesHome: "relative/path" });
    // relative paths are resolved by path.resolve
    expect(result.endsWith("relative/path")).toBe(true);
  });

  it("falls back to ~/.hermes when no option is given", () => {
    const homeDir = os.homedir();
    const result = resolveHermesHome({});
    expect(result).toBe(`${homeDir}/.hermes`);
  });

  it("uses HERMES_HOME env var when hermesHome is not set", () => {
    const homeDir = os.homedir();
    const result = resolveHermesHome({
      env: { HERMES_HOME: "~/from-env" } as NodeJS.ProcessEnv,
    });
    expect(result).toBe(`${homeDir}/from-env`);
  });
});
