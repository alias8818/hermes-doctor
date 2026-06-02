# Hermes Doctor — Validation Status

**Generated:** 2026-06-01  
**Purpose:** Track validation coverage, known limitations, and acceptance history for the Hermes Doctor CLI.

---

## Test Coverage Summary

| Metric | Count |
|--------|-------|
| **Total tests** | 906 passing, 3 skipped |
| **Test files** | 28 |
| **Test assertions (contract)** | 140+ |
| **Fixture directories** | 50+ |
| **Known limitations** | 5 (see [KNOWN_LIMITATIONS.md](./reports/KNOWN_LIMITATIONS.md)) |

### Test Distribution by Area

| Area | Test Files | Approx. Tests | Status |
|------|-----------|---------------|--------|
| Golden Path | 1 | 20 | ✅ Passing |
| Redaction Torture | 1 | 28 | ✅ Passing |
| Provider Checks | 1 | 38 | ✅ Passing |
| MCP Checks | 1 | 39+ | ✅ Passing |
| Dashboard / Security | 1 | 57 | ✅ Passing |
| Memory / Context | 1 | 47 | ✅ Passing |
| Skills / Plugins | 1 | 39 | ✅ Passing |
| Log Classification | 1 | 23 | ✅ Passing |
| CLI / UX | 1 | 31 | ✅ Passing |
| Cross-Area / Audit | 1 | 53 | ✅ Passing |
| Polish / Fix | 1 | 26 | ✅ Passing (3 skipped) |
| Core Unit Tests | ~16 | — | ✅ Passing |

### Quality Gates

| Gate | Status |
|------|--------|
| Golden path: 0 broken, 0 risk, ≤3 warnings | ✅ Pass |
| All broken/risk findings have evidence | ✅ Pass |
| All broken/risk findings have fix guidance ≥ 2 | ✅ Pass |
| Core provider/MCP/security findings score ≥ 3 | ✅ Pass |
| No raw fake secrets in any output or artifact | ✅ Pass |
| Hermes broken → exit 0 | ✅ Pass |
| Doctor failure → exit 1 | ✅ Pass |
| No fixture mutation during scans | ✅ Pass |
| No MCP command execution | ✅ Pass |
| No outbound internet calls in default mode | ✅ Pass |
| Artifact cleanliness (no real secret patterns) | ✅ Pass |

---

## Known Limitations

Hermes Doctor has **5 documented known limitations** covering detection gaps across 4 areas. For full details, see [KNOWN_LIMITATIONS.md](./reports/KNOWN_LIMITATIONS.md).

### Provider Gaps (2 remaining)

| # | Limitation | Contract ID | Status |
|---|-----------|-------------|--------|
| 1 | Malformed fallback provider config undetected | VAL-PROV-011 | ✅ Documented |
| 2 | Auxiliary model/provider validation incomplete | VAL-PROV-012 | ✅ Documented |

> Three provider gaps (orphaned model references, custom provider missing `base_url`, and `auth.json` active provider conflict) have been **resolved** in this release. See validation history below.

### Other Gaps

| # | Limitation | Area | Contract ID |
|---|-----------|------|-------------|
| 3 | Remote MCP URLs — no probing, info only | MCP | VAL-MCP-015 |
| 4 | Security public-binding check not registered | Security | VAL-DASH-024 |
| 5 | Huge file detection relies on sparse files | Memory | VAL-MEM-012 |

### Provider Gaps Resolved in This Release

| # | Limitation | Contract ID | Resolved In |
|---|-----------|-------------|-------------|
| ~~Orphaned model references~~ | Providers | ~~VAL-PROV-007~~ | MS2 / Release hardening |
| ~~Custom provider missing `base_url`~~ | Providers | ~~VAL-PROV-008~~ | MS2 / Release hardening |
| ~~`auth.json` active provider conflict~~ | Providers | ~~VAL-PROV-010~~ | MS2 / Release hardening |

---

## Validation History

### 2026-06-01 — Release Hardening Complete

- **906 tests passing**, 3 skipped, 28 test files
- All 11 acceptance gates pass
- 3 provider gaps resolved (orphaned models, custom base_url, auth.json conflict)
- 5 remaining known limitations documented
- SECURITY.md, COMPATIBILITY.md, VALIDATION_STATUS.md created
- Full QA validation across all categories

### 2026-05-31 — QA Validation Phase

- **797 tests passing**, 3 skipped, 27 test files
- Redaction torture test suite (12 assertions) — zero raw secrets
- Cross-area isolation verified (MCP, provider, dashboard independence)
- Audit hard gates: no fixture mutation, no MCP execution, no outbound network calls
- Severity calibration reviewed — all 20 key scenarios correct
- Acceptance review: `fixtures/validation/golden-path/dashboard-off` — 0 broken, 0 risk, ≤ 3 warnings
- 10 new validation test files added
- 50+ fixture directories created

### 2026-05-30 — Foundation Complete

- **All 11 diagnostic areas** implemented with collectors and checks
- **50+ deterministic checks** across system, install, config, dashboard, providers, MCP, memory, skills, plugins, logs, security
- **3 output formats**: console, markdown, JSON
- **Defense-in-depth redaction**: secrets caught at collection boundary AND render time
- **Flue integration**: optional AI enrichment with graceful degradation
- **Packaging**: CLI bundled with tsup, Flue as optional peer dependency

---

## Related Documents

- [Test Matrix](./reports/TEST_MATRIX.md) — Detailed assertion-level results
- [Known Limitations](./reports/KNOWN_LIMITATIONS.md) — Documented detection gaps
- [Acceptance Review](./reports/ACCEPTANCE_REVIEW.md) — Full QA acceptance verdict
- [Red Team Report](./reports/REDTEAM_REDACTION.md) — Redaction torture test results
- [README.md](./README.md) — Project overview and usage
- [SECURITY.md](./SECURITY.md) — Security policy and privacy model
- [COMPATIBILITY.md](./COMPATIBILITY.md) — Version and platform support

**Last updated:** 2026-06-01
