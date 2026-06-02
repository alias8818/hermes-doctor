# Review Pass 1: DOCS + CLI + REDACT + EX — Structured Report

**Reviewer:** Worker Droid (pass 1)  
**Date:** 2026-05-31  
**Contract:** `/home/exedev/.factory/missions/bac794cb-34f3-47ee-8afe-a175790468ec/validation-contract.md`  
**Repo:** `/home/exedev/workspace/hermes-doctor`

---

## 1. Documentation (DOCS) — 6 existing assertions

### What's Covered Well

- **VAL-DOCS-001 (SECURITY.md)**: Clear pass/fail criteria — file existence, honesty language, redaction limitations, review-before-sharing advice. No overselling.
- **VAL-DOCS-002 (COMPATIBILITY.md)**: Well-scoped — Hermes version, Node.js, platform support. Three required categories measured.
- **VAL-DOCS-003 (VALIDATION_STATUS.md)**: Comprehensive — coverage data, known limitations, history. Good coverage of what a status doc needs.
- **VAL-DOCS-004 (KNOWN_LIMITATIONS.md)**: Precise — explicitly names the 3 gaps to remove (VAL-PROV-007, -008, -010) and the 2 to keep (VAL-PROV-011, -012). Summary table update required.
- **VAL-DOCS-005 (TEST_MATRIX.md)**: Explicit — checks individual assertion IDs change from "GAP"/"KNOWN LIMITATION" to "PASS", stale counts updated, date updated.
- **VAL-DOCS-006 (README.md honesty)**: Broad scope — covers "safe to share", network claims, setup accuracy, privacy model language, JSON schema field names.

### Current Status in Repo (evidence gathered)

| # | Assertion | Current State | Issue |
|---|-----------|---------------|-------|
| DOCS-001 | SECURITY.md exists | **MISSING** — no `SECURITY.md` at repo root | Needs creation |
| DOCS-002 | COMPATIBILITY.md exists | **MISSING** — no `COMPATIBILITY.md` at repo root | Needs creation |
| DOCS-003 | VALIDATION_STATUS.md exists | **MISSING** — no `VALIDATION_STATUS.md` at repo root | Needs creation |
| DOCS-004 | KNOWN_LIMITATIONS updated | **STALE** — still lists Limitation 1 (orphaned models), Limitation 2 (custom base_url), Limitation 3 (auth.json conflict) as active gaps. Summary says "Total gaps: 8 (5 provider...)" | Needs update |
| DOCS-005 | TEST_MATRIX updated | **STALE** — VAL-PROV-007, -008, -010 still show "KNOWN LIMITATION" / "GAP". Reported test count "797 tests, 3 skipped, 27 test files" likely stale | Needs update |
| DOCS-006 | README honest claims | **BLOCKER** — README contains 3 instances of "safe to share" (privacy section, console example output, markdown example output). Privacy section: "✅ **All reports are safe to share.**", "The JSON report includes a `safeToShare: true` field.", example output footer: "✅ This report is safe to share." | Needs update |

### What's MISSING — Suggested New Assertions

#### VAL-DOCS-007: ACCEPTANCE_REVIEW.md wording consistency with "redacted for sharing"
- **Why missing**: After the MS1 wording change replaces "safe to share" → "redacted for sharing", ACCEPTANCE_REVIEW.md must be consistent. It currently references `safeToShare=true` in gate 1 results (line 101). The TEST_MATRIX.md also references "safe-to-share" in golden path row 010 and redaction row 010 — these text labels should be updated.
- **Pass condition**: ACCEPTANCE_REVIEW.md does not contain "safe to share" or "safeToShare" as a claim (references to VAL assertions with old names are acceptable in historical context). If it describes the report output, it uses "redacted for sharing."
- **Tool**: Shell (`grep -i "safe to share\|safeToShare" reports/ACCEPTANCE_REVIEW.md`)
- **Evidence**: File content

#### VAL-DOCS-008: survey-context.md contains honest privacy claims
- **Why missing**: survey-context.md opens with "reports are `safeToShare: true`" — this is an absolute safety claim that contradicts the MS1 wording change. No existing assertion covers this file.
- **Pass condition**: survey-context.md does not contain "safe to share" or `safeToShare: true` as an unqualified claim. If it describes reports, it uses "redacted for sharing" language.
- **Tool**: Shell (`grep -i "safe to share\|safeToShare" survey-context.md`)
- **Evidence**: File content

#### VAL-DOCS-009: droid-wiki files contain honest privacy claims
- **Why missing**: droid-wiki/packages/cli.md contains "✅ This report is safe to share." in two places (line describing console output, line describing privacy footer). No assertion covers wiki docs.
- **Pass condition**: droid-wiki files do not contain "safe to share" as an unqualified claim. If they describe reports, they use "redacted for sharing."
- **Tool**: Shell (`grep -ri "safe to share" droid-wiki/`)
- **Evidence**: File content — zero matches for "safe to share"

#### VAL-DOCS-010: README Roadmap reflects honest completion status
- **Why missing**: The README's Roadmap section shows all milestones as "✅ Complete" including "Hardening." However, MS3 deliverables (SECURITY.md, COMPATIBILITY.md, VALIDATION_STATUS.md creation, bare invocation change) are not complete. The Roadmap should either be updated to show accurate status or removed.
- **Pass condition**: The Roadmap section accurately reflects which milestones are actually complete. If "Hardening" is shown as complete, all hardening deliverables must be done. Alternatively, the Roadmap section is removed or marked as "In Progress."
- **Tool**: Shell (`grep -A 20 "Roadmap" README.md`)
- **Evidence**: File content — Hardening status matches actual deliverables

#### VAL-DOCS-011: General doc audit for other stale/outdated documentation files
- **Why missing**: No cross-cutting check that all docs are consistent. Individual assertions target specific files, but a general sweep would catch files like droid-wiki, survey-context.md, and ACCEPTANCE_REVIEW.md that aren't explicitly named in the existing contract.
- **Pass condition**: A grep for "safe to share" across all `.md` files in the repo root, reports/, and droid-wiki/ returns zero matches (excluding REDTEAM_REDACTION.md which documents test results with old wording in table headers).
- **Tool**: Shell (`rg -i "safe to share" --glob '*.md' --glob '!reports/REDTEAM_REDACTION.md'`)
- **Evidence**: Zero matches

### Assertions Suggested for REMOVAL or CONSOLIDATION

- **CONSOLIDATE VAL-DOCS-006 + VAL-WORD-005**: Both cover "safe to share" removal from README.md. VAL-DOCS-006 is broader (network claims, setup, safeToShare field) while VAL-WORD-005 is narrower (only "safe to share" text). **Recommendation**: Keep both separate — VAL-WORD-005 is a precise wording check, VAL-DOCS-006 is broader documentation honesty. They are complementary, not redundant.
- **CONSOLIDATE VAL-DOCS-008 + VAL-DOCS-009 + VAL-DOCS-011**: All three check "safe to share" absence across different doc surfaces. **Recommendation**: Consider a single "VAL-DOCS-011: No 'safe to share' in any documentation file" that covers all surfaces, rather than per-file assertions.

---

## 2. CLI UX (CLI) — 1 existing assertion

### What's Covered Well

- **VAL-CLI-001 (Bare invocation)**: Covers the core MS3 behavior change — bare invocation scans, `--help` prints help, `-h` prints help. Includes both positive and negative pass conditions.

### Current Status in Repo

- CLI source at `packages/cli/src/` with `program.ts`, `commands/scan.ts`, etc.
- Bare invocation currently routes to help (pre-MS3 behavior). MS3 change #17 in architecture.md specifies "Bare invocation scans instead of showing help."
- `--help`/`-h` flags are implemented via Commander.js and work correctly.
- Test coverage: `validation-cli-ux.test.ts` exists with 31 tests.

### What's MISSING — Suggested New Assertions

#### VAL-CLI-002: Exit code 0 on completed scan (with or without findings), exit 1 on tool/runtime failure
- **Why missing**: The README clearly documents the exit code policy (0 = scan completed, 1 = tool failure, 2 = reserved). But no contract assertion verifies this policy is actually enforced. The bare invocation change could accidentally change exit code behavior. This is critical for CI/CD integration.
- **Pass condition**:
  - `hermes-doctor scan --hermes-home ./fixtures/hermes-good` → exit 0 (healthy scan)
  - `hermes-doctor scan --hermes-home ./fixtures/hermes-broken-mcp` → exit 0 (broken Hermes, scan completed)
  - `hermes-doctor scan --hermes-home /nonexistent/path` → exit 1 (tool failure)
  - `hermes-doctor scan --format bogus` → exit 1 (invalid args)
  - Bare invocation `hermes-doctor` on a nonexistent default Hermes home → exit 1
- **Tool**: Shell (check `$?` / `process.exitCode`)
- **Evidence**: Exit codes match documented policy

#### VAL-CLI-003: --hermes-home with nonexistent path exits 1 with clear error (no stack trace)
- **Why missing**: While the TEST_MATRIX rows 015-017 cover some error cases, there's no contract-level assertion for this specific flag behavior. The `--hermes-home` flag is the most commonly used option and deserves explicit validation.
- **Pass condition**:
  - `hermes-doctor scan --hermes-home /nonexistent/path` → exit 1
  - stderr contains a human-readable error message (not a stack trace)
  - Error message mentions the path and why it's invalid
- **Tool**: Shell (execa)
- **Evidence**: Exit code 1, stderr contains descriptive error, no `at file:line:col` stack trace patterns

#### VAL-CLI-004: --version works correctly after bare invocation change
- **Why missing**: VAL-CLI-001 explicitly covers `--help`/`-h` but not `--version`/`-V`. After the MS3 bare invocation change (default action becomes `scan` instead of `help`), `--version` must still work. Commander.js could have edge cases if the default command changes.
- **Pass condition**:
  - `hermes-doctor --version` prints version string matching semver
  - `hermes-doctor -V` prints version string
  - Exit code 0
- **Tool**: Shell
- **Evidence**: stdout contains version number, exit code 0

#### VAL-CLI-005: Explicit `hermes-doctor scan` subcommand continues to work after bare invocation change
- **Why missing**: After making bare invocation default to scan, the explicit `scan` subcommand must continue to work identically. This is a regression guard.
- **Pass condition**:
  - `hermes-doctor scan --hermes-home ./fixtures/hermes-good` completes and exits 0
  - Output is identical to bare invocation behavior on the same fixture (minus any path differences)
  - All scan-specific flags (`--format`, `--output`, `--flue`, `--verbose`, `--strict-redaction`) still work with explicit `scan` subcommand
- **Tool**: Shell (execa)
- **Evidence**: Exit code 0, output contains findings, all flags functional

#### VAL-CLI-006: Bare invocation error message is clear and user-friendly
- **Why missing**: When bare invocation attempts a scan and the default Hermes home is missing or broken, the error message should guide the user. VAL-CLI-001 checks that exit 1 happens but doesn't validate message quality.
- **Pass condition**:
  - Error message suggests using `--hermes-home` to specify a path
  - Error message suggests `--help` for usage information
  - No raw stack trace in stderr
- **Tool**: Shell (execa, unset HERMES_HOME, run bare invocation)
- **Evidence**: stderr contains user-friendly guidance, no stack trace

### Assertions Suggested for REMOVAL or CONSOLIDATION

- None to remove. VAL-CLI-001 is well-scoped and necessary.
- **CONSOLIDATE VAL-CLI-002 + VAL-CLI-003**: Exit code policy and nonexistent path behavior are related but distinct. VAL-CLI-002 is about the general exit code contract; VAL-CLI-003 is about a specific flag's error handling. Keep separate for clarity.

---

## 3. Redaction Cleanup (REDACT) — 2 existing assertions

### What's Covered Well

- **VAL-REDACT-001**: Explicit, measurable — greppable patterns (Anthropic key prefix, GitHub token prefix, Slack token prefix), clear exclusions for REDTEAM_REDACTION.md and fixtures, specific file list.
- **VAL-REDACT-002**: Good criteria — acceptable placeholder formats documented (`<FAKE_*>`, `<YOUR_*>`, `sk-test-...example`), distinguishes ambiguous from clearly-marked.

### Current Status in Repo

| # | Assertion | Current State | Issue |
|---|-----------|---------------|-------|
| REDACT-001 | No raw fake secrets in docs | **MOSTLY CLEAN** — README.md example output shows `set HERMES_DASHBOARD_BIND=127.0.0.1` (not a secret). REDTEAM_REDACTION.md uses `sk-test-` prefixed test keys. Example reports use redacted paths like `<HOME>/...`. The droid-wiki/packages/core.md mention of Slack token prefix is a documentation description of a regex pattern, not a raw secret (it's part of a table describing what patterns are detected). | Acceptable |
| REDACT-002 | Fake secrets use placeholder format | **PASSING** — REDTEAM_REDACTION.md consistently uses test-only prefixed values. Example reports show redacted content. README.md doesn't contain any fake secrets. | Clean |

### What's MISSING — Suggested New Assertions

#### VAL-REDACT-003: Example reports in `reports/examples/` have been regenerated with correct "redacted for sharing" wording
- **Why missing**: All 4 example report .md files (golden-clean.md, provider-missing-key.md, mcp-broken-command.md, risky-dashboard.md) contain `> ✅ This report is safe to share.` in their privacy footer. After the MS1 wording change, these should be regenerated with the new "redacted for sharing" wording. The existing REDACT assertions only check for raw secrets and placeholder formats — not for wording consistency with the MS1 change.
- **Pass condition**:
  - No example report `.md` or `.json` file in `reports/examples/` contains "safe to share"
  - Example reports contain "redacted for sharing" or equivalent updated wording
  - The JSON reports no longer contain `safeToShare: true` (or the field is renamed to `redactedForSharing`)
- **Tool**: Shell (`grep -ri "safe to share\|safeToShare" reports/examples/`)
- **Evidence**: Zero matches, new wording present

#### VAL-REDACT-004: REDTEAM_REDACTION.md reflects updated redaction wording
- **Why missing**: REDTEAM_REDACTION.md contains headers like `| Output Format | "safe to share" Present? | Verdict |` and likely references "safe to share" in descriptions. This is a detailed QA artifact that should be consistent with the MS1 wording change. Not an absolute blocker (it's a historical test report), but should be updated for accuracy.
- **Pass condition**: REDTEAM_REDACTION.md table headers and descriptive text use "redacted for sharing" where they previously used "safe to share" in reference to the output claim. Historical test result descriptions that quote old behavior are acceptable in context.
- **Tool**: Shell (`grep -i "safe to share" reports/REDTEAM_REDACTION.md`)
- **Evidence**: Updated wording in table headers and descriptions

#### VAL-REDACT-005: Test fixtures containing fake secrets have clear header/footer comments
- **Why missing**: Several test fixtures under `fixtures/validation/` contain fake secrets (e.g., test-only prefixes). While these are safe because they use test prefixes, a header comment like `# TEST FIXTURE ONLY — CONTAINS FAKE SECRETS — DO NOT USE REAL KEYS` would prevent any ambiguity for contributors or automated scanners. This is a defense-in-depth best practice.
- **Pass condition**:
  - Secret-containing fixture files (config.yaml, .env, SKILL.md, etc.) have a comment at the top identifying them as test fixtures with fake secrets
  - At minimum: `fixtures/validation/redaction-torture/all-surfaces/` files, `fixtures/validation/provider/fake-secrets/` files, `fixtures/validation/mcp/fake-secrets/` files
  - Comment uses clear language: "FAKE", "TEST ONLY", "NOT REAL", "DO NOT USE"
- **Tool**: Shell (`head -5` on secret-containing fixture files)
- **Evidence**: Header comments present in all secret-containing fixture files

#### VAL-REDACT-006: droid-wiki files use updated redaction wording
- **Why missing**: droid-wiki/packages/cli.md contains "✅ This report is safe to share." This is an auto-generated wiki that should be consistent with the project's current wording. No assertion covers wiki docs for wording consistency.
- **Pass condition**: droid-wiki files do not contain "safe to share" as a claim about report output. They use "redacted for sharing" instead.
- **Tool**: Shell (`grep -ri "safe to share" droid-wiki/`)
- **Evidence**: Zero matches or updated wording

### Assertions Suggested for REMOVAL or CONSOLIDATION

- None to remove. VAL-REDACT-001 and VAL-REDACT-002 are distinct and well-scoped.
- **CONSOLIDATE VAL-REDACT-003 + VAL-EX-001**: VAL-REDACT-003 (example reports wording) overlaps with VAL-EX-001 (example reports exist and are redacted). VAL-EX-001 already requires redaction, but doesn't explicitly check wording. **Recommendation**: Broaden VAL-EX-001 to include wording check, or keep VAL-REDACT-003 separate as it's specifically about the MS1 wording change's impact on examples.

---

## 4. Example Reports (EX) — 1 existing assertion

### What's Covered Well

- **VAL-EX-001**: Good scope — checks file existence, `Generated:` timestamp authenticity, actual findings (not placeholders), path normalization `<HOME>`, report structure sections. The pass condition is thorough.

### Current Status in Repo

| # | Assertion | Current State | Issue |
|---|-----------|---------------|-------|
| EX-001 | Example reports exist | **PARTIAL** — 8 files exist (4 scenarios × .md + .json): golden-clean, mcp-broken-command, provider-missing-key, risky-dashboard. All have `Generated:` timestamps and real findings. Paths are normalized (`<HOME>/...`). **BUT** all .md files contain `> ✅ This report is safe to share.` which contradicts MS1 wording change. | Needs regeneration |

### What's MISSING — Suggested New Assertions

#### VAL-EX-002: Example reports cover all 4 key scenarios explicitly
- **Why missing**: VAL-EX-001 only requires "at least one" example report. The architecture doc (MS3 #19) specifies "Real scan output from actual Hermes installs" and the contract mentions golden-clean, provider-missing-key, mcp-broken-command, risky-dashboard as qualifying scenarios. Having all 4 gives users a representative view of the tool's output across different Hermes health states.
- **Pass condition**:
  - `reports/examples/golden-clean.md` and `.json` exist
  - `reports/examples/provider-missing-key.md` and `.json` exist
  - `reports/examples/mcp-broken-command.md` and `.json` exist
  - `reports/examples/risky-dashboard.md` and `.json` exist
  - Each is a real scan output with `Generated:` timestamp, not placeholder content
- **Tool**: Shell (`ls reports/examples/`)
- **Evidence**: 8 files, all with expected content structure

#### VAL-EX-003: README references the `reports/examples/` directory
- **Why missing**: The README has an "Example Output" section with inline snippets, but doesn't tell users where to find full example reports. A reference to `reports/examples/` would help users who want to see what a full report looks like before running the tool.
- **Pass condition**:
  - README.md contains a reference to `reports/examples/` (either as a link or a path mention)
  - The "Example Output" section or a nearby section mentions that full examples are available
- **Tool**: Shell (`grep "reports/examples\|example reports\|example output" README.md`)
- **Evidence**: README references the examples directory

#### VAL-EX-004: Example reports include console captured output format (`.txt` or `.ansi`)
- **Why missing**: The examples directory only has `.md` and `.json` formats. Console output (with ANSI color codes or plain text) is the default format users see when they run `hermes-doctor scan`. A captured console output example gives users a realistic preview. This is nice-to-have but would improve the examples' completeness.
- **Pass condition**:
  - At least one `.txt` or `.ansi` file in `reports/examples/` showing captured console output
  - The file contains the terminal output as users would see it (with or without ANSI codes)
  - The file corresponds to one of the 4 key scenarios
- **Tool**: Shell (`ls reports/examples/*.txt reports/examples/*.ansi 2>/dev/null`)
- **Evidence**: File existence, content showing console renderer output

#### VAL-EX-005: Example JSON reports validate against DoctorReportSchema
- **Why missing**: The `.json` example reports should be valid `DoctorReport` objects. If the schema has changed during MS1/MS2 (Evidence type, FlueInsights, FixAction safety fields), the example JSON files may be stale and fail schema validation.
- **Pass condition**:
  - Parsing each `.json` file in `reports/examples/` and validating with `v.parse(DoctorReportSchema, parsed)` does not throw
  - The validation is done programmatically using the current schema from `@hermes-doctor/core`
- **Tool**: vitest (programmatic schema validation)
- **Evidence**: `v.parse` succeeds for all example JSON files

#### VAL-EX-006: Example reports have a clear "EXAMPLE" designation
- **Why missing**: Users browsing `reports/examples/` should immediately know these are example outputs, not real scan results of their own system. A header comment or a note like "> **⚠️ EXAMPLE REPORT** — generated from test fixture `fixtures/hermes-good`" would prevent confusion.
- **Pass condition**:
  - Each example report `.md` file includes a clearly visible note that it's an example
  - The note appears near the top of the file (within first 10 lines)
  - The note indicates which fixture or scenario generated the report
- **Tool**: Shell (`head -10` on each example report)
- **Evidence**: "EXAMPLE" or similar designation in file header

### Assertions Suggested for REMOVAL or CONSOLIDATION

- **VAL-EX-001 is too broad**: It tries to check existence, authenticity, redaction, and structure in one assertion. **Recommendation**: Keep VAL-EX-001 as existence + authenticity, and split redaction checking into VAL-REDACT-003 (example reports use updated wording).
- **CONSOLIDATE VAL-EX-002 + VAL-EX-001**: VAL-EX-002 (4 specific scenarios) can be merged into VAL-EX-001 by changing "at least one" to "all 4 specific scenarios." This reduces assertion count while maintaining coverage.
- **VAL-EX-004 (console format) could be tagged as nice-to-have**: It's the lowest priority of the EX suggestions since the README already shows inline console output.

---

## 5. Summary

### Existing Assertions Assessment

| Section | Existing Count | Well-Covered | Needs Update | Gaps Found |
|---------|---------------|-------------|--------------|------------|
| DOCS | 6 | 6 definitions are solid | All 6 need action (files don't exist or are stale) | 5 new assertions suggested |
| CLI | 1 | 1 definition is solid | 1 needs implementation (bare invocation) | 5 new assertions suggested |
| REDACT | 2 | 2 definitions are solid | 0 urgent (REDTEAM wording is secondary) | 4 new assertions suggested |
| EX | 1 | 1 definition is solid | 1 needs regeneration (wording change) | 5 new assertions suggested |
| **Total** | **10** | **10** | **8 need action** | **19 new suggested** |

### Priority Ranking of Missing Assertions

| Priority | ID | Area | Rationale |
|----------|----|------|-----------|
| **CRITICAL** | VAL-DOCS-001 | DOCS | SECURITY.md must exist for public release |
| **CRITICAL** | VAL-DOCS-006 | DOCS | README still says "safe to share" — contradicts MS1 |
| **HIGH** | VAL-DOCS-002 | DOCS | COMPATIBILITY.md needed for public release |
| **HIGH** | VAL-DOCS-004 | DOCS | KNOWN_LIMITATIONS must reflect fixed gaps |
| **HIGH** | VAL-DOCS-005 | DOCS | TEST_MATRIX must reflect new test reality |
| **HIGH** | VAL-CLI-001 | CLI | Bare invocation behavior is MS3 core deliverable |
| **HIGH** | VAL-CLI-002 | CLI | Exit code policy is critical for CI/CD users |
| **HIGH** | VAL-REDACT-003 | REDACT | Example reports must use updated wording |
| **MEDIUM** | VAL-DOCS-003 | DOCS | VALIDATION_STATUS.md for release transparency |
| **MEDIUM** | VAL-DOCS-007 | DOCS | ACCEPTANCE_REVIEW consistency |
| **MEDIUM** | VAL-DOCS-008 | DOCS | survey-context.md still has old wording |
| **MEDIUM** | VAL-DOCS-009 | DOCS | droid-wiki still has old wording |
| **MEDIUM** | VAL-CLI-003 | CLI | Error handling for nonexistent --hermes-home |
| **MEDIUM** | VAL-CLI-004 | CLI | --version still works after MS3 change |
| **MEDIUM** | VAL-CLI-005 | CLI | Explicit scan subcommand regression guard |
| **MEDIUM** | VAL-EX-005 | EX | JSON examples validate against current schema |
| **LOW** | VAL-DOCS-010 | DOCS | Roadmap accuracy |
| **LOW** | VAL-DOCS-011 | DOCS | General doc audit sweep |
| **LOW** | VAL-CLI-006 | CLI | Error message quality on bare invocation |
| **LOW** | VAL-REDACT-004 | REDACT | REDTEAM_REDACTION wording (historical artifact) |
| **LOW** | VAL-REDACT-005 | REDACT | Fixture header comments (nice-to-have) |
| **LOW** | VAL-REDACT-006 | REDACT | droid-wiki wording consistency |
| **LOW** | VAL-EX-002 | EX | All 4 scenarios (actually already met in repo) |
| **LOW** | VAL-EX-003 | EX | README references examples dir |
| **LOW** | VAL-EX-004 | EX | Console captured output format |
| **LOW** | VAL-EX-006 | EX | "EXAMPLE" designation in headers |

### Cross-Cutting Concerns

1. **"safe to share" is pervasive**: Found in 30+ locations across README, example reports, renderer source code, test files, droid-wiki, survey-context.md, ACCEPTANCE_REVIEW.md, and REDTEAM_REDACTION.md. The MS1 wording change (VAL-WORD-001 through -008) needs to cascade to ALL of these surfaces. The DOCS/REDACT/EX contract assertions should explicitly cover this cascade.

2. **Three new doc files don't exist yet**: SECURITY.md, COMPATIBILITY.md, and VALIDATION_STATUS.md are all MS3 deliverables (#18 in architecture.md). Their creation is tracked by DOCS-001 through -003, but content quality assertions should also ensure they're not just empty placeholder files.

3. **TEST_MATRIX.md is stale in two dimensions**: (a) provider gap statuses still show "KNOWN LIMITATION" for fixed gaps, (b) test/fixture counts from the QA validation pass (likely 900+ tests, 28+ files, 60+ fixtures) aren't reflected.

4. **Example reports need full regeneration**: Not just wording — they may need schema updates (Evidence type, FlueInsights, FixAction safety fields) to match the current DoctorReportSchema. VAL-EX-005 covers this.

5. **droid-wiki is auto-generated but stale**: The wiki files were generated from the codebase before MS1-MS3 changes. They contain old wording and possibly outdated architecture descriptions. Consider whether droid-wiki regeneration should be a DOCS assertion or a separate task.
