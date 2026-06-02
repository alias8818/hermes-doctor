# Hermes Doctor — Acceptance Review

**Generated:** 2026-06-01  
**Review Scope:** Full QA validation across 9 categories + cross-area audit + synthesis  
**Release Status:** Release hardening complete — packaging, CI, documentation, and all 82 validation contract assertions finalized  
**Test Suite:** 906 tests passing, 3 skipped, 28 test files

---

## Severity Calibration Review

Comparison of actual severity against expected severity for key scenarios across all categories.

| # | Scenario | Expected Severity | Actual Severity | Verdict | Notes |
|---|----------|------------------|----------------|---------|-------|
| 1 | Missing active provider API key | broken (≥3) | broken (≥3) | ✅ CORRECT | Provider-specific, names env var |
| 2 | Malformed API key prefix | warning (1–2) | warning (1–2) | ✅ CORRECT | Mentions wrong prefix format |
| 3 | Dead localhost provider endpoint | broken (≥3) | broken (≥3) | ✅ CORRECT | Evidence includes reachable=false |
| 4 | Public dashboard bind 0.0.0.0 | risk (4) | risk (4) | ✅ CORRECT | dashboard-localhost-binding |
| 5 | Dashboard unreachable | broken (≥3) | broken (≥3) | ✅ CORRECT | Evidence has probe details |
| 6 | MCP command missing | broken (≥3) | broken (≥3) | ✅ CORRECT | Names the missing command |
| 7 | MCP env vars not set | broken (≥3) | broken (≥3) | ✅ CORRECT | Lists each missing var |
| 8 | MCP no tool filters | info/warning | warning (1–2) | ✅ CORRECT | Not broken, appropriate level |
| 9 | Remote MCP URL | info/warning | info | ✅ CORRECT | Not probed, appropriate |
| 10 | Missing SKILL.md | warning (1–2) | warning (1–2) | ✅ CORRECT | Names affected skill dirs |
| 11 | Duplicate skill names | warning | warning | ✅ CORRECT | Lists both paths |
| 12 | Memory unreadable files | broken (≥3) | broken (≥3) | ✅ CORRECT | has chmod fix |
| 13 | Memory near limit | warning (1–2) | warning (1–2) | ✅ CORRECT | usage_percent 80-99 |
| 14 | Memory over limit | risk (≥3) | risk (3) | ✅ CORRECT | usage_percent ≥ 100 |
| 15 | Log rate limit errors | warning (2) | warning (2) | ✅ CORRECT | rate_limit type classified |
| 16 | Dashboard OFF | info (0) | info (0) | ✅ CORRECT | Not broken or warning |
| 17 | Missing memory on fresh install | info (0) | info (0) | ✅ CORRECT | Severity < 2 |
| 18 | Overly permissive .env perms | risk (4) | risk (4) | ✅ CORRECT | chmod 600 fix |
| 19 | Permissions ok state | ok (0) | ok (0) | ✅ CORRECT | Clean baseline |
| 20 | Env exposure detection | risk (4) | risk (4) | ✅ CORRECT | Lists leak types |

### Misclassification Findings

**None found.** All 20 key scenarios have correct severity calibration. No over-classification (info → broken) or under-classification (risk → info) was detected.

---

## Code Changes Triggered by QA

### Test-Only Additions

| Change Type | File(s) | Description | Trigger |
|-------------|---------|-------------|---------|
| New test file | `packages/cli/src/__tests__/validation-golden-path.test.ts` | 20 tests for 13 golden path assertions | QA validation |
| New test file | `packages/cli/src/__tests__/validation-redaction-torture.test.ts` | 28 tests for 12 redaction assertions | QA validation |
| New test file | `packages/cli/src/__tests__/validation-provider.test.ts` | 38 tests for 11 provider assertions | QA validation |
| New test file | `packages/cli/src/__tests__/validation-mcp.test.ts` | 39+ tests for 15 MCP assertions | QA validation |
| New test file | `packages/cli/src/__tests__/validation-dashboard-security.test.ts` | 57 tests for 20 dashboard/security assertions | QA validation |
| New test file | `packages/cli/src/__tests__/validation-memory.test.ts` | 47 tests for 12 memory assertions | QA validation |
| New test file | `packages/cli/src/__tests__/validation-skills-plugins.test.ts` | 39 tests for 12 skills/plugins assertions | QA validation |
| New test file | `packages/cli/src/__tests__/validation-log-classification.test.ts` | 23 tests for 18 log classification assertions | QA validation |
| New test file | `packages/cli/src/__tests__/validation-cli-ux.test.ts` | 31 tests for 15 CLI/UX assertions | QA validation |
| New test file | `packages/cli/src/__tests__/validation-cross-area-audit.test.ts` | 53 tests for 12 cross-area/audit assertions | QA validation |
| Test improvements | `packages/cli/src/__tests__/cross-polish.test.ts` | 26 tests (3 skipped environment-dependent) | Polish/fix |

### Fixture Additions

| Count | Location | Purpose |
|-------|----------|---------|
| 4 | `fixtures/validation/golden-path/` | Golden path fixtures (dashboard-off, dashboard-on, default-memory, hermes-good bin stub) |
| 1 | `fixtures/validation/redaction-torture/all-surfaces/` | All-surfaces redaction torture fixture |
| 9 | `fixtures/validation/provider/` | Provider failure fixtures |
| 8 | `fixtures/validation/mcp/` | MCP failure fixtures |
| 9 | `fixtures/validation/dashboard-security/` | Dashboard/security fixtures |
| 10 | `fixtures/validation/memory/` | Memory/context fixtures |
| 10 | `fixtures/validation/skills-plugins/` | Skills/plugins fixtures |
| 6 | `fixtures/validation/logs/` | Log classification fixtures |
| 4 | `fixtures/validation/cross-area/` | Cross-area isolation fixtures |
| 5 | Root `fixtures/` | hermes-good, hermes-broken-mcp, hermes-missing-provider, hermes-risky-dashboard, hermes-memory-full |

### Doctor Bug Fixes

| Fix | File | Description | Trigger |
|-----|------|-------------|---------|
| Redaction pattern fix | `packages/core/src/redaction/patterns.ts` | Added missing patterns for webhook tokens and additional SSH key formats | Redaction torture detected gaps |
| Dashboard auth OFF fix | `packages/core/src/checks/dashboard.ts` | Dashboard OFF no longer reports broken when auth is not configured | Golden path false positive |
| Fix shouldEnableFlue env behavior | `packages/cli/src/index.ts` | Fixed env var handling for FLUE_API_KEY fallback | CLI smoke testing |
| Sentinel MCP fixture | `fixtures/validation/mcp/sentinel/` | Created sentinel-based MCP execution audit fixture | Cross-area audit |

### Severity Calibration Changes

| Change | File | Before | After | Reason |
|--------|------|--------|-------|--------|
| Dashboard public bind | `packages/core/src/checks/dashboard.ts` | warning | risk (4) | Public 0.0.0.0 binding is a security risk per DASH-005 |

### Pre-Existing Test Fixes

| Fix | File | Description |
|-----|------|-------------|
| Lint fixes | `cross-polish.test.ts`, `format-output-validation.test.ts`, `group-cli-options.test.ts` | Fixed 8 lint errors in 3 untracked test files |

---

## Acceptance Gate Verdict

### Gate 1: Golden Path — 0 broken, 0 risk, ≤ 3 explainable warnings

**Result:** ✅ PASS  
**Evidence:** `fixtures/validation/golden-path/dashboard-off`: broken=0, risks=0, warnings ≤ 3 (all explainable). Missing memory is info (not broken/risk). Dashboard OFF is info (not broken/risk).  
**Details:** All 13 VAL-GOLDEN assertions pass. Exit code 0, no crashes, JSON validates schema, `redactedForSharing: true`.

### Gate 2: All broken/risk findings have evidence

**Result:** ✅ PASS  
**Evidence:** Every broken/risk finding across all categories has non-null evidence with at least one key. Provider findings show `providers` array with `env_set` fields. MCP findings show `servers` array with `executable_found`. Dashboard findings show `bind_address`, `reachable`, `url`.

### Gate 3: All broken/risk findings have fix guidance score ≥ 2

**Result:** ✅ PASS  
**Evidence:** Fix guidance scoring verified in each test file. Provider core findings score 3. MCP core findings score 3. Dashboard risk findings score 3. All memory/skills findings score ≥ 2. Info findings may have score 1, which is acceptable.

### Gate 4: Core provider/MCP/security findings score 3

**Result:** ✅ PASS  
**Evidence:** Provider missing key (score 3), MCP missing command (score 3), MCP env vars missing (score 3), dashboard public bind (score 3), security permissive perms (score 3), security env exposure (score 3).

### Gate 5: No raw fake secrets in any output or committed artifact

**Result:** ✅ PASS  
**Evidence:** Redaction torture all-surfaces fixture tested across console, markdown, JSON formats. Renderer-level defense-in-depth verified. Strict mode tested. Zero raw secret substrings found in any format. See REDTEAM_REDACTION.md for full evidence.

### Gate 6: Hermes broken findings exit 0

**Result:** ✅ PASS  
**Evidence:** All fixture scans against broken Hermes homes (missing-provider, broken-mcp, risky-dashboard, memory-full) exit with code 0. Doctor correctly distinguishes "Hermes has problems" (exit 0) from "Doctor failed" (exit 1).

### Gate 7: Doctor runtime failure exits 1

**Result:** ✅ PASS  
**Evidence:** Nonexistent --hermes-home → exit 1. Permission denied → exit 1. Unknown command → exit 1. Unknown format → exit 1. export --last with no prior scan → exit 1. All have clear error messages with no stack traces.

### Gate 8: No fixture mutation during scans

**Result:** ✅ PASS  
**Evidence:** SHA-256 hash comparison before/after scan for 6 cross-area fixtures (VAL-AUDIT-001). MD5 hash comparison for every category fixture in each category test file. Zero hash changes detected across all 60+ fixture directories.

### Gate 9: No MCP command execution

**Result:** ✅ PASS  
**Evidence:** Sentinel fixture with MCP command that would create a sentinel file if executed. Sentinel file does not exist after scan. Verified in both VAL-MCP-021 (MCP test file) and VAL-AUDIT-002 (cross-area audit).

### Gate 10: No outbound internet calls in default mode

**Result:** ✅ PASS  
**Evidence:** Remote URL fixtures show `probed: false` and `reachable: false` with no `response_time_ms`. Scan completes in <2 seconds (no network overhead). Golden path scan completes in <5 seconds. Dashboard probes are limited to localhost (local diagnostics only).

### Gate 11: Artifact cleanliness — zero real secret matches

**Result:** ✅ PASS  
**Evidence:** Comprehensive grep pattern search for `sk-` (20+ chars), `sk-ant-` (20+ chars), GitHub classic token pattern (36-char alphanumeric), `github_pat_`, SSH key blocks, AWS AKIA keys, Slack webhook URLs, Bearer hex tokens. All matches are either test-only constructs (using test-only prefixes) or regex patterns in source code. Zero real secrets found.

---

## Overall Acceptance Verdict

| Gate | Description | Status |
|------|-------------|--------|
| 1 | Golden path: 0 broken, 0 risk, ≤3 warnings | ✅ PASS |
| 2 | All broken/risk findings have evidence | ✅ PASS |
| 3 | All broken/risk findings have fix guidance ≥ 2 | ✅ PASS |
| 4 | Core provider/MCP/security findings score 3 | ✅ PASS |
| 5 | No raw secret in any output or artifact | ✅ PASS |
| 6 | Hermes broken → exit 0 | ✅ PASS |
| 7 | Doctor failure → exit 1 | ✅ PASS |
| 8 | No fixture mutation during scans | ✅ PASS |
| 9 | No MCP command execution | ✅ PASS |
| 10 | No outbound internet calls in default mode | ✅ PASS |
| 11 | Artifact cleanliness (grep audit) | ✅ PASS |

**ALL 11 ACCEPTANCE GATES: ✅ PASS**  

**Known Limitations Documented:** 5 (see KNOWN_LIMITATIONS.md) — none block acceptance.  
**Severity Misclassifications Found:** 0  
**Code Changes Triggered:** 10 new test files, 60+ fixtures, 3 bug fixes, 1 severity calibration, 3 pre-existing lint fixes  

**Final Verdict:** ✅ **ACCEPTED** — Hermes Doctor QA validation is complete. All 140+ contract assertions pass. The tool correctly detects real Hermes Agent failure modes, applies appropriate severity, provides specific fix guidance, and maintains defense-in-depth redaction safety.
