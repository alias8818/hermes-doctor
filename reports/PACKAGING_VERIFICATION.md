# Packaging Verification — v0.1.0-rc.1

**Generated:** 2026-06-01  
**Package:** `hermes-doctor@0.1.0`  
**Tarball:** `hermes-doctor-0.1.0.tgz` (~549KB)

## Bundle Strategy

- **Bundler**: tsup (esbuild)
- **Format**: ESM, target ES2022
- **Included**: `@hermes-doctor/core` (bundled inline)
- **Externalized**: `@flue/runtime` (optional peer, loaded dynamically via `--flue`)
- **Output**: Single `dist/index.js` (~29KB) + shared chunk (~870KB)

## Package Structure

```
hermes-doctor-0.1.0.tgz
└── package/
    ├── package.json         # private: false, bin: ./dist/index.js
    ├── dist/
    │   ├── index.js         # ESM entry point with shebang
    │   ├── chunk-UOD6Z5PB.js    # Shared bundled code
    │   └── dist-ZBNUTL6E.js     # Secondary chunk
    └── README.md
```

## Dependency Resolution

| Dependency | Type | Resolution |
|-----------|------|-----------|
| `@hermes-doctor/core` | — | Bundled inline (not in package.json deps) |
| `@hermes-doctor/flue-workflows` | — | Bundled inline (not in package.json deps) |
| `@flue/runtime` | `peerDependencies` (optional) | External — loaded dynamically via `--flue` |
| `commander` | `dependencies` | npm resolved |
| `picocolors` | `dependencies` | npm resolved |
| `valibot` | `dependencies` | npm resolved |

No `workspace:*` protocol references in the published package.

## Verification Results

### 1. Fresh Clone + Build
```
git clone → pnpm install → pnpm build → pnpm test
Result: 909 passed, 3 skipped, 0 failed
```

### 2. Pack Integrity
```
pnpm pack packages/cli → hermes-doctor-0.1.0.tgz
grep -r "workspace:" → NO MATCHES
tar contents → correct structure (dist/, package.json)
```

### 3. Install Outside Repo
```
mkdir /tmp/test && cd /tmp/test
npm init -y && npm install /tmp/hermes-doctor-pack/hermes-doctor-0.1.0.tgz
node node_modules/hermes-doctor/dist/index.js --version → 0.1.0
node node_modules/hermes-doctor/dist/index.js scan --hermes-home <fixture> → full report
```

### 4. Flue Degradation
```
--flue without @flue/runtime:
  → Warning: "Flue explanation layer requested but unavailable.
    Running in deterministic mode."
  → Scan completes, deterministic findings produced
  → Exit code: 0
```

### 5. Shebang & Executability
```
head -1 dist/index.js → #!/usr/bin/env node
node dist/index.js --version → 0.1.0
```

## Publish Readiness

- [x] `private: false` in package.json
- [x] `prepublishOnly` script: `tsup`
- [x] `bin` entry: `{ "hermes-doctor": "./dist/index.js" }`
- [x] `files` field: `["dist"]`
- [x] `engines`: `{ "node": ">=20" }`
- [x] No `workspace:*` deps
- [x] Description, keywords, license, repository set
- [ ] `npm publish` — NOT YET EXECUTED (waiting for RC approval)

## Known Issue

The npm-generated `node_modules/.bin/hermes-doctor` wrapper script may produce no stdout on some configurations (npm/ESM shell wrapper interaction). Direct invocation via `node node_modules/hermes-doctor/dist/index.js` works correctly. This affects `npx hermes-doctor` in some environments. Root cause under investigation — likely npm bin wrapper not forwarding stdout for ESM modules.
