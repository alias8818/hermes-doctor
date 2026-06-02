/**
 * Packaging tests for Hermes Doctor CLI.
 *
 * Covers VAL-PKG-001 through VAL-PKG-010:
 * - npm pack produces tarball with no workspace:* deps
 * - Installed CLI runs scan without @flue/runtime
 * - --flue degrades gracefully without runtime or key
 * - Default scan never imports Flue
 * - prepublishOnly script exists
 * - Correct shebang in dist
 * - Package is un-privated
 * - --no-flue overrides HERMES_DOCTOR_USE_FLUE
 * - Built CLI findings match dev CLI findings
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const pkgRoot = resolve(here, "..", "..");
const repoRoot = resolve(pkgRoot, "..", "..");
const fixturesDir = resolve(repoRoot, "fixtures");
const pkgJsonPath = resolve(pkgRoot, "package.json");
const distIndexPath = resolve(pkgRoot, "dist", "index.js");

// ---------------------------------------------------------------------------
// VAL-PKG-007: dist/index.js has correct Node shebang
// ---------------------------------------------------------------------------
describe("VAL-PKG-007: Shebang", () => {
  it("dist/index.js starts with #!/usr/bin/env node", () => {
    expect(existsSync(distIndexPath)).toBe(true);
    const firstLine = readFileSync(distIndexPath, "utf-8").split("\n")[0];
    expect(firstLine).toBe("#!/usr/bin/env node");
  });
});

// ---------------------------------------------------------------------------
// VAL-PKG-008: Package is un-privated (private: false or absent)
// ---------------------------------------------------------------------------
describe("VAL-PKG-008: Package un-privated", () => {
  it("package.json does not have private: true", () => {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    expect(pkg.private).not.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// VAL-PKG-006: prepublishOnly script exists
// ---------------------------------------------------------------------------
describe("VAL-PKG-006: prepublishOnly script", () => {
  it("package.json has prepublishOnly script", () => {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.prepublishOnly).toBeDefined();
    expect(pkg.scripts.prepublishOnly.length).toBeGreaterThan(0);
  });

  it("prepublishOnly invokes the build command", () => {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    expect(pkg.scripts.prepublishOnly).toMatch(/tsup|build/);
  });
});

// ---------------------------------------------------------------------------
// VAL-PKG-001: npm pack produces tarball with no workspace:* deps
// ---------------------------------------------------------------------------
describe("VAL-PKG-001: No workspace:* deps in packed output", () => {
  it("npm pack --dry-run does not contain workspace: references", async () => {
    const result = await execa("npm", ["pack", "--dry-run"], {
      cwd: pkgRoot,
      reject: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("workspace:");
  });

  it("packed package.json has no workspace:* dependencies", async () => {
    // Run npm pack to create tarball
    const result = await execa("npm", ["pack"], {
      cwd: pkgRoot,
      reject: false,
    });
    expect(result.exitCode).toBe(0);
    
    // Extract tarball name from output
    const tarballLine = result.stdout.trim().split("\n").pop() ?? "";
    const tarballPath = resolve(pkgRoot, tarballLine);
    expect(existsSync(tarballPath)).toBe(true);

    try {
      // Extract the tarball to a temp location
      const { mkdtempSync } = await import("node:fs");
      const { join } = await import("node:path");
      const os = await import("node:os");
      const extractDir = mkdtempSync(join(os.tmpdir(), "hermes-doctor-pack-"));
      
      await execa("tar", ["-xzf", tarballPath, "-C", extractDir], { reject: false });
      
      const packedPkgPath = resolve(extractDir, "package", "package.json");
      expect(existsSync(packedPkgPath)).toBe(true);
      
      const packedPkg = JSON.parse(readFileSync(packedPkgPath, "utf-8"));
      
      // Check no workspace:* in dependencies (bundled deps should not appear)
      if (packedPkg.dependencies) {
        const depsStr = JSON.stringify(packedPkg.dependencies);
        expect(depsStr).not.toContain("workspace:");
      }
      
      // Check no workspace:* in optionalDependencies
      if (packedPkg.optionalDependencies) {
        const depsStr = JSON.stringify(packedPkg.optionalDependencies);
        expect(depsStr).not.toContain("workspace:");
      }
      
      // Check no workspace:* in peerDependencies  
      if (packedPkg.peerDependencies) {
        const depsStr = JSON.stringify(packedPkg.peerDependencies);
        expect(depsStr).not.toContain("workspace:");
      }
      
      // @hermes-doctor/core should NOT appear in dependencies (it's bundled)
      if (packedPkg.dependencies) {
        expect(packedPkg.dependencies["@hermes-doctor/core"]).toBeUndefined();
      }
    } finally {
      // Clean up tarball
      try {
        await import("node:fs/promises").then(m => m.rm(tarballPath));
      } catch { /* ignore */ }
    }
  });
});

// ---------------------------------------------------------------------------
// VAL-PKG-002: Installed CLI runs scan without @flue/runtime
// ---------------------------------------------------------------------------
describe("VAL-PKG-002: CLI runs without @flue/runtime", () => {
  it("built CLI can scan golden fixture without Flue", async () => {
    const distCli = resolve(pkgRoot, "dist", "index.js");
    const fixturePath = resolve(fixturesDir, "hermes-good");
    
    const result = await execa("node", [distCli, "scan", "--hermes-home", fixturePath], {
      reject: false,
      timeout: 30_000,
    });
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hermes Doctor");
    expect(result.stdout).toContain("Summary");
    // No Flue-related errors
    expect(result.stderr).not.toContain("MODULE_NOT_FOUND");
    expect(result.stderr).not.toContain("@flue/runtime");
  });
});

// ---------------------------------------------------------------------------
// VAL-PKG-003: --flue without @flue/runtime degrades gracefully
// ---------------------------------------------------------------------------
describe("VAL-PKG-003: --flue without runtime degrades gracefully", () => {
  it("scan --flue without Flue runtime exits 0 with warning", async () => {
    const distCli = resolve(pkgRoot, "dist", "index.js");
    const fixturePath = resolve(fixturesDir, "hermes-good");
    
    const result = await execa("node", [distCli, "scan", "--hermes-home", fixturePath, "--flue"], {
      reject: false,
      timeout: 30_000,
      env: {
        ...process.env,
        FLUE_API_KEY: "",
        ANTHROPIC_API_KEY: "",
      },
    });
    
    // Should still exit 0 (graceful degradation)
    expect(result.exitCode).toBe(0);
    // Should contain the completed deterministic scan
    expect(result.stdout).toContain("Summary");
    // Should have a warning about Flue being unavailable
    const allOutput = result.stderr + result.stdout;
    expect(allOutput).toMatch(/Flue|warning/i);
  });
});

// ---------------------------------------------------------------------------
// VAL-PKG-005: Default scan never imports or loads Flue
// ---------------------------------------------------------------------------
describe("VAL-PKG-005: Default scan never imports Flue", () => {
  it("default scan has no Flue output or warnings", async () => {
    const distCli = resolve(pkgRoot, "dist", "index.js");
    const fixturePath = resolve(fixturesDir, "hermes-good");
    
    const result = await execa("node", [distCli, "scan", "--hermes-home", fixturePath], {
      reject: false,
      timeout: 30_000,
    });
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Summary");
    // No Flue-related content in default scan
    expect(result.stdout).not.toMatch(/Flue/i);
    expect(result.stderr).not.toMatch(/Flue/i);
  });
});

// ---------------------------------------------------------------------------
// VAL-PKG-009: --no-flue overrides HERMES_DOCTOR_USE_FLUE env var
// ---------------------------------------------------------------------------
describe("VAL-PKG-009: --no-flue overrides env var", () => {
  it("--no-flue with HERMES_DOCTOR_USE_FLUE=1 has no Flue output", async () => {
    const distCli = resolve(pkgRoot, "dist", "index.js");
    const fixturePath = resolve(fixturesDir, "hermes-good");
    
    const result = await execa("node", [distCli, "scan", "--hermes-home", fixturePath, "--no-flue"], {
      reject: false,
      timeout: 30_000,
      env: {
        ...process.env,
        HERMES_DOCTOR_USE_FLUE: "1",
        FLUE_API_KEY: "",
        ANTHROPIC_API_KEY: "",
      },
    });
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Summary");
    // --no-flue should prevent any Flue-related output
    expect(result.stdout).not.toMatch(/Flue/i);
  });
});

// ---------------------------------------------------------------------------
// VAL-PKG-010: Built CLI findings match dev CLI findings for golden fixture
// ---------------------------------------------------------------------------
describe("VAL-PKG-010: Built CLI matches dev CLI findings", () => {
  it("built CLI and dev CLI produce identical finding IDs, statuses, severities", async () => {
    const distCli = resolve(pkgRoot, "dist", "index.js");
    const fixturePath = resolve(fixturesDir, "hermes-good");
    
    // Run built CLI
    const builtResult = await execa("node", [distCli, "scan", "--hermes-home", fixturePath, "--format", "json"], {
      reject: false,
      timeout: 30_000,
    });
    expect(builtResult.exitCode).toBe(0);
    
    // Run dev CLI (tsx)
    const tsxBin = resolve(repoRoot, "node_modules", ".bin", "tsx");
    const cliEntry = resolve(pkgRoot, "src", "index.ts");
    const devResult = await execa(tsxBin, [cliEntry, "scan", "--hermes-home", fixturePath, "--format", "json"], {
      reject: false,
      timeout: 30_000,
    });
    expect(devResult.exitCode).toBe(0);
    
    // Parse both outputs
    const builtReport = JSON.parse(builtResult.stdout);
    const devReport = JSON.parse(devResult.stdout);
    
    // Both should have same number of findings
    expect(builtReport.findings.length).toBe(devReport.findings.length);
    
    // Sort both by finding ID for comparison
    const sortBy = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
    const builtSorted = [...builtReport.findings].sort(sortBy);
    const devSorted = [...devReport.findings].sort(sortBy);
    
    // Compare each finding
    for (let i = 0; i < builtSorted.length; i++) {
      expect(builtSorted[i].id).toBe(devSorted[i].id);
      expect(builtSorted[i].status).toBe(devSorted[i].status);
      expect(builtSorted[i].severity).toBe(devSorted[i].severity);
    }
    
    // Summary counts should match
    expect(builtReport.summary).toEqual(devReport.summary);
  });
});
