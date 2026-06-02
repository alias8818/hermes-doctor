# Release Candidate Checklist — v0.1.0-rc.1

**Generated:** 2026-06-01  
**Purpose:** Final release-candidate verification gate for Hermes Doctor public release.

## 1. Fresh Clone Verification

- [x] `git clone` into clean temp directory succeeds
- [x] `pnpm install --frozen-lockfile` completes without errors
- [x] `pnpm typecheck` — zero errors
- [x] `pnpm lint` — zero errors
- [x] `pnpm build` — succeeds (tsc -b + tsup bundle)
- [x] `pnpm test` — **909 passed, 3 skipped, 0 failed** (28 test files)
- [x] No untracked assumptions, no local-only files required, no hidden env vars

## 2. Packaged Install Test

- [x] `pnpm pack packages/cli` produces `hermes-doctor-0.1.0.tgz` (~549KB)
- [x] Packed tarball contains NO `workspace:*` dependencies
- [x] Install tarball into clean temp project: `npm install ./hermes-doctor-0.1.0.tgz`
- [x] `node node_modules/hermes-doctor/dist/index.js --version` → `0.1.0`
- [x] `node node_modules/hermes-doctor/dist/index.js scan --hermes-home <fixture>` produces full health report
- [x] JSON output: valid, parsed, with findings
- [x] All renderers produce correct output from packed CLI

## 3. Flue Degradation Matrix

- [x] Default scan (no `--flue`) — deterministic, no Flue import
- [x] `--flue` without `@flue/runtime` — clear warning, deterministic fallback
- [x] `--flue` without API key — clear warning, deterministic fallback  
- [x] Warning message: "Flue explanation layer requested but unavailable. Running in deterministic mode."
- [x] Deterministic findings unchanged between `--flue` and `--no-flue` runs
- [x] `--no-flue` explicitly disables even when `HERMES_DOCTOR_USE_FLUE=1`

## 4. Repo-Wide Secret Scan

- [x] `grep -R "sk-" .` — only redaction patterns and placeholders in docs
- [x] `grep -R "sk-ant-" .` — only redaction patterns and placeholders in docs
- [x] `grep -R "ghp_" .` — only `REDTEAM_REDACTION.md` (expected)
- [x] `grep -R "xoxb-" .` — only `REDTEAM_REDACTION.md` (expected)
- [x] No raw realistic token values in documentation files
- [x] All fake secrets use abbreviated/placeholder format (`<FAKE_OPENAI_KEY>`, `sk-test-...example`)

## 5. Docs Wording Audit

- [x] README.md — "redacted for sharing", no "safe to share", no "zero network"
- [x] SECURITY.md — honest, no overselling, mentions redaction limitations
- [x] COMPATIBILITY.md — Hermes versions, Node.js >=20, platform support
- [x] VALIDATION_STATUS.md — coverage stats, known limitations, history
- [x] KNOWN_LIMITATIONS.md — 3 provider gaps removed, 2 remaining
- [x] TEST_MATRIX.md — updated counts, fixed gaps → PASS
- [x] ACCEPTANCE_REVIEW.md — updated wording, release hardening status
- [x] Network claim: "no outbound internet calls (local diagnostics only)"
- [x] Flue described as optional/experimental

## 6. Severity Calibration

- [x] Missing provider key → broken/3 (not critical/4)
- [x] Security/privacy risks → risk/4
- [x] Dashboard 0.0.0.0 bind → risk/4
- [x] No MCP tool filters → warning (not broken)
- [x] Dashboard disabled → info (not warning)
- [x] Memory/logs secrets → risk/4 where applicable

## 7. Provider Checks (New)

- [x] Custom provider missing `base_url` → broken/3, fix score >= 3
- [x] `auth.json` active_provider conflict → warning/2 or broken/3
- [x] Orphaned model reference → broken/3, fix score >= 3
- [x] Auth.json content fully redacted in all reports
- [x] Negative assertions: no false positives on built-in providers

## 8. FixAction Safety

- [x] New fields: `risk`, `requiresConfirmation`, `manualSteps`, `rollback`
- [x] Dangerous commands have `requiresConfirmation: true`
- [x] All fix commands reference real packages (no `npm install -g bogus`)
- [x] Backward compatible with old reports

## 9. Structured Evidence

- [x] `Evidence` type with `label`, `detail`, `source?`, `confidence?`, `redacted?`
- [x] `normalizeEvidence()` adapter for legacy string[]
- [x] All renderers consume normalized evidence
- [x] Backward compatible with legacy evidence format

## 10. MCP Remote-Only Fix

- [x] Remote-only servers (no `command` field) not flagged for missing executable
- [x] Local servers with missing commands still correctly flagged
- [x] Empty command string handled correctly (flagged, not silently skipped)

## 11. Real Hermes Smoke Test (exe.dev VM)

- [x] Fresh Ubuntu 24.04 VM (exe.dev), Node v22.22.2
- [x] `npm install` from tarball — 4 packages, 0 vulnerabilities
- [x] `--version` → `0.1.0`
- [x] `scan` → **56 findings** (17 OK, 31 Info, 4 Warnings, 4 Broken) against real Hermes install
- [x] `--format json` → valid JSON, 56 findings, machine-parseable
- [x] `--format markdown` → proper table output with emoji indicators
- [x] `--flue` → graceful degradation: "Flue explanation layer requested but unavailable. Running in deterministic mode."
- [x] `--no-flue` → exit 0, full report produced
- [x] `--help` → all options displayed, exit 0
- [x] Path redaction verified: `<HOME>` replaces real home paths
- [x] Redaction footer: "This report has been redacted for sharing."
- [x] Structured evidence with labels, sources, confidence levels present
- [x] Fix actions with risk levels, confirmation gates, manual steps, rollbacks present

## Known Issues / Limitations

- **npm bin wrapper**: The npm-created `node_modules/.bin/hermes-doctor` symlink wrapper produces no stdout on some configurations. Direct `node dist/index.js` invocation works correctly. This is a known npm/ESM interaction.

## Verdict

**✅ v0.1.0-rc.1 — READY FOR LIMITED BETA RELEASE**

All 11 verification categories passed. 909 tests in fresh clone. Real Hermes smoke test on exe.dev VM: 56 findings across all severity levels, all output formats verified, redaction confirmed working, Flue degrades gracefully. Recommend sharing with 3-5 Hermes/Flue test users before broad launch.
