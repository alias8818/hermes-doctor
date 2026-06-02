import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  target: "es2022",
  dts: false,
  sourcemap: true,
  clean: true,
  // Enable shims to handle CJS interop for packages like cross-spawn that
  // use require(). In ESM mode, we provide a require function via banner.
  shims: true,
  banner: {
    js: `
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
`,
  },
  // Externalize only @flue/runtime (loaded dynamically by FlueWorkflowRunner).
  // @hermes-doctor/core and @hermes-doctor/flue-workflows are bundled into the CLI.
  // The dynamic import("@hermes-doctor/flue-workflows") creates a separate chunk
  // that ships alongside dist/index.js in the published package.
  external: ["@flue/runtime"],
  platform: "node",
});
