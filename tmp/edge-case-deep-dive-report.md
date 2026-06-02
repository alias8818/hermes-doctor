# Validation Contract Edge Case Deep-Dive — Review Pass 2

**Date:** 2026-05-31  
**Reviewed:** `validation-contract.md` (82 assertions, 13 areas) + codebase reality check  
**Focus:** Testability gaps, edge case coverage, negative assertions, exit code consistency, redaction consistency

---

## 1. Testability Analysis

### 1.1 Assertions That Are Hard or Impossible to Test

#### VAL-PKG-005: "No Flue import" — Hard to Test Reliably

**Claim:** Running `hermes-doctor scan` without `--flue` never imports or attempts to load `@flue/runtime` or `@hermes-doctor/flue-workflows`.

**Problem:** The contract suggests "monkey-patch or proxy `import()` / `require()`." In practice:
- The current CLI code (`scan.ts`) uses dynamic `import("@hermes-doctor/flue-workflows")` guarded behind `shouldEnableFlue()` — it will never import Flue when flue is disabled. This is structurally guaranteed by the code, not something a test needs to prove via interception.
- An instrumentation-based test (e.g., `module.createRequire` proxying, loader hooks) is fragile, Node-version-dependent, and breaks with bundlers like tsup.
- A more practical test: run the scan in an environment where `@flue/runtime` does not exist and verify the scan succeeds (this is already covered by VAL-PKG-002).

**Recommendation:** Replace the instrumentation requirement with the pragmatic test from VAL-PKG-002: "in an environment where `@flue/runtime` is not installed, default scan succeeds without errors." The structural guarantee (only importing behind `--flue` guard) can be verified via code review + a simple grep for static `import.*flue` in the CLI source (which should return zero matches — VAL-PKG-005 edge case already calls this out).

**Verdict:** Testable with a different tool (grep + VAL-PKG-002) — not testable as specified with import interceptions.

---

#### VAL-PKG-010: "Built CLI output identical to dev CLI" — Fragile Comparison

**Claim:** The tsup-bundled `dist/index.js` must produce scan output identical to the unbundled `tsc` output for the same fixture.

**Problems:**
- tsup bundles all dependencies inline; `tsc` keeps them as separate modules. The two builds run in different module resolution contexts. In practice, `tsup` bundles the Node.js built-in `path`, `fs`, etc. — identical output is impossible for any non-trivial code.
- The contract acknowledges timestamps/durations/generatedAt may differ, but timing-sensitive probes (e.g., dashboard HTTP checks) can produce different results between runs even from the SAME binary.
- The test must run both builds in the same environment. If the dev build needs `tsx` or `ts-node` to execute, that's a fundamentally different runtime than the bundled Node executable.

**Recommendation:** Change from "identical output" to "functionally equivalent output" (same finding count, same status/severity for each finding ID, same summary counts). Accept minor evidence detail differences. Use a comparison that strips volatile fields (`generatedAt`, `collectedAt`, `durationMs`, `latencyMs`).

**Verdict:** Not testable as specified with "identical" — needs relaxation to "functionally equivalent."

---

#### VAL-WORD-008: "No outbound network connections" — Hard to Test

**Claim:** The CLI in default mode makes no outbound network connections to remote hosts.

**Problem:** The contract's evidence requires "monitoring outbound connections" or "auditing source code." Monitoring is OS-dependent (needs `tcpdump`, `strace`, or Node.js `--inspect`). Source code audit is manual and not automatable in CI.

**Recommendation:** Split into two sub-assertions:
- **Static:** Grep all check/collector code for `fetch()`, `http.request()`, `net.connect()` calls and verify they target only localhost addresses (pattern: `127.0.0.1`, `::1`, `localhost`). This is automatable with grep.
- **Runtime (best-effort):** A vitest test that uses `nock` or a custom `http.Agent` to intercept all outbound HTTP and asserts no connections reach non-loopback hosts. This only covers HTTP, not raw TCP.

**Verdict:** Partially testable — the static grep is reliable, the runtime intercept is best-effort.

---

#### VAL-WORD-013: "No absolute claims in user-facing docs" — Inherently Subjective

**Claim:** README.md and other docs must not contain unqualified absolute claims.

**Problem:** The evidence lists specific grep patterns (`"all secrets"`, `"completely safe"`, `"zero network"`, `"guaranteed"`) which is good for automation, but natural language varies. The contract admits "best-effort."

**Recommendation:** Accept grep-based automation + manual review. The current evidence patterns are sufficient. Add a negative regex pattern like `/\b(zero|no|never|always|guaranteed|completely|100%)\b/i` with a human-reviewed allowlist.

**Verdict:** Partially testable — grep covers common patterns; full coverage requires human review.

---

#### VAL-CLI-001: "Bare invocation runs a scan" — Contradicts Current Behavior

**Claim:** Bare `hermes-doctor` (no args) runs a scan, not help.

**Problem:** The existing test `[VAL-CLI-008]` in `validation-cli-ux.test.ts` explicitly asserts bare invocation *shows help* and exits 0, with `expect(result.stdout).toContain("Commands:")`. The contract says bare invocation must scan. This is a direct contradiction in the existing tests vs. the contract.

**Recommendation:** The contract (VAL-CLI-001) is the new requirement. The existing test must be updated. But this requires changing `program.ts` to make `scan` the default command. Commander supports `program.action()` for default behavior.

**Verdict:** Testable, but needs corresponding code change + test update.

---

### 1.2 Assertions That Are Straightforward to Test

| Assertion | Why Testable |
|-----------|-------------|
| VAL-PKG-001 through VAL-PKG-004 | Shell / vitest with `execa` — package tarball inspection, CLI invocation |
| VAL-PKG-006 through VAL-PKG-008 | Static file inspection (grep, file existence) |
| VAL-PKG-009 | Shell/vitest — set env var, run with `--no-flue`, check output |
| VAL-CI-001 through VAL-CI-006 | Static YAML inspection (grep, yq, node yaml parse) |
| VAL-WORD-001 through VAL-WORD-012 | Mostly grep (source + rendered output) — word-level checks are automatable |
| VAL-PROV-HARD-001 through VAL-PROV-HARD-009 | vitest with fixtures — the test pattern in `validation-provider.test.ts` is established |
| VAL-MCP-001 through VAL-MCP-004 | vitest — well-established MCP test patterns |
| VAL-SEV-001 through VAL-SEV-006 | vitest — severity field assertions on findings |
| VAL-EVID-001 through VAL-EVID-004 | vitest — schema validation, function unit tests |
| VAL-FLUE-001 through VAL-FLUE-011 | vitest with mocked Flue — well-established test patterns |
| VAL-FIX-001 through VAL-FIX-005 | vitest — schema validation, fix field assertions |
| VAL-DOCS-001 through VAL-DOCS-007 | Shell (file existence + grep) |
| VAL-CLI-002, VAL-CLI-003 | Shell (CLI invocation + exit code + output inspection) |
| VAL-REDACT-001 through VAL-REDACT-003 | Shell (rg pattern search) |
| VAL-EX-001 | Shell (ls + grep for report structure) |

---

## 2. Edge Case Coverage per Area

### 2.1 PKG — Missing Edge Cases

| Edge Case | Missed? | Issue |
|-----------|---------|-------|
| tsup produces CJS instead of ESM | **YES** | The contract assumes ESM output (`dist/index.js` with shebang). If tsup config is misconfigured and produces CJS, the shebang test passes but `import` statements fail at runtime. Add: VAL-PKG-011 "Built output is ESM (not CJS)" — verify `dist/index.js` contains `import`/`export` (not `require`) and `package.json` has `"type": "module"`. |
| tsup produces wrong entrypoint name | **NO** | Covered by VAL-PKG-007 (shebang check on `dist/index.js`). |
| Package is published with devDependencies | **NO** | Covered by VAL-PKG-001 (no `workspace:*`) but NOT explicitly covered for devDeps. The `npm pack` output should be checked for absence of `devDependencies` too. |
| `files` field in package.json excludes dist/ | **YES** | If `package.json` has a `"files"` field that doesn't include `dist/`, npm pack won't include the built output. Add: check that `files` includes `dist` or is absent (default includes everything). |
| Multiple `--format` flags with `--output` produce files, but what if only one format is passed with `--output`? | **NO** | Already covered by VAL-CLI-011. |

**Suggested additions:**
- VAL-PKG-011: Built output uses ESM format
- VAL-PKG-012: npm pack includes dist/ directory (verify files field or tarball contents)

---

### 2.2 CI — Missing Edge Cases

| Edge Case | Missed? | Issue |
|-----------|---------|-------|
| Windows runner (`windows-latest`) | **YES** | The CI contract only specifies OS-agnostic steps. Windows has different path separators, shell differences, and some commands don't work (e.g., `which` vs `where`). The contract should specify whether Windows is a supported CI platform. If yes, add a Windows-specific matrix variant. If no (and Windows support is documented in COMPATIBILITY.md as unsupported), add VAL-CI-007: "CI does not run on Windows runners." |
| pnpm version pinning | **YES** | VAL-CI-003 requires `pnpm install --frozen-lockfile` but doesn't ensure pnpm itself is version-pinned. Without `packageManager` in `package.json` + `corepack`, CI could use a different pnpm version. Add: VAL-CI-007 "pnpm version is pinned via packageManager field." |
| Cache steps | **NO** | Not required by contract, nice-to-have only. |
| Concurrency/cancel-in-progress | **NO** | Not in scope. |

**Suggested additions:**
- VAL-CI-007: Windows support explicitly addressed (either supported + tested, or documented as unsupported)

---

### 2.3 WORD — Missing Edge Cases

| Edge Case | Missed? | Issue |
|-----------|---------|-------|
| `--verbose` output contains "safe to share" | **YES** | The contract checks console, markdown, and JSON output for "safe to share" but doesn't check verbose mode output. The verbose renderer path may emit additional strings. Add a cross-check: VAL-WORD-001 should also check `--verbose` output. |
| `--format json --verbose` output contains "safe to share" | **YES** | JSON verbose mode may include additional metadata. |
| export.ts fallback path (line 175) | **NO** | Covered by VAL-WORD-010. |
| Test file `describe()`/`it()` descriptions | **PARTIAL** | VAL-WORD-006 acknowledges test descriptions are "best-effort" — acceptable. |
| droid-wiki files | **PARTIAL** | VAL-WORD-012 covers this but the wiki files are untracked (git status shows `?? droid-wiki/`). They need to be committed first for the assertion to be meaningful. |

**Suggested additions:**
- Extend VAL-WORD-001 to also check `--verbose` console output
- Extend VAL-WORD-003 to also check `--verbose --format json` output

---

### 2.4 PROV-HARD — Missing Edge Cases

| Edge Case | Missed? | Issue |
|-----------|---------|-------|
| auth.json has BOM (byte order mark) | **YES** | UTF-8 BOM (`\uFEFF`) at the start of auth.json will cause JSON.parse to fail or produce wrong keys. The collector should strip BOM before parsing. Add edge case to VAL-PROV-HARD-002/004. |
| config.yaml has YAML anchors/aliases | **YES** | YAML anchors (`&anchor`) and aliases (`*anchor`) can cause duplicate object references. The `loadHermesConfig` function should handle these. If anchors cause reference cycles, deep-redaction could infinite-loop. Add edge case to VAL-PROV-HARD-001/003. |
| KNOWN_PROVIDERS list is incomplete (no `deepseek`, `xai`, etc.) | **YES** | The current `KNOWN_PROVIDERS` list has 9 entries. New providers emerge regularly. The collector silently treats unknown providers as custom — correct behavior, but should be documented. Add: VAL-PROV-HARD-010 "Unknown providers are treated as custom (not silently dropped)." |
| auth.json contains `active_provider` but the value is `null` or empty string | **YES** | Currently unspecified. Should `active_provider: null` or `active_provider: ""` trigger a conflict finding? Recommend: treat as "no active_provider" (no finding). |
| Multiple auth conflict severities (warning 2 vs broken 3) boundary | **PARTIAL** | The contract specifies: warning 2 when provider exists but mismatches; broken 3 when provider doesn't exist at all. But what if auth.json has `active_provider: "openai"` and config.yaml has `openai` defined but with *zero* models mapped to it? The provider exists but is unused — should this be warning 2 or broken 3? Currently ambiguous. |
| Custom provider with `base_url` set but unreachable | **YES** | The contract covers missing base_url (broken 3) but NOT: base_url is set but the endpoint is down. Should a custom provider with a base_url but unreachable be diagnosed? Currently the local endpoint check only probes `localhost` URLs for KNOWN providers. Add cross-reference to VAL-PROV-009 pattern. |
| Orphaned model references to deleted but still-referenced providers | **PARTIAL** | Covered by VAL-PROV-HARD-003 for non-existent providers. But what about a provider that exists but is empty (`providers.openai: {}`) — the model references it, the section exists, but has no configuration. This is borderline; the contract says it should NOT fire (provider section nominally exists). Could merit a separate "empty provider section" check. |

**Suggested additions:**
- VAL-PROV-HARD-010: auth.json BOM handling
- VAL-PROV-HARD-011: Custom provider with base_url but unreachable endpoint
- Edge case clarification for `active_provider: null/""` and unused-but-existing providers

---

### 2.5 FLUE — Missing Edge Cases

| Edge Case | Missed? | Issue |
|-----------|---------|-------|
| Flue returns valid JSON with wrong field types | **YES** | VAL-FLUE-007 covers "malformed JSON" (`{foo: "bar"}`). But what if Flue returns `{findings: [{findingId: "X", insight: 42}]}` — `insight` is a number, not a string? Valibot validation would reject it (schema expects string). This should be treated same as malformed (warning, exit 0, deterministic findings preserved). Add edge case to VAL-FLUE-007. |
| Flue returns findings for IDs not in the payload | **YES** | Flue might hallucinate a `findingId` that wasn't in the dispatched findings. Should the pipeline filter out unknown IDs or include them? Add edge case to VAL-FLUE-006 or a new assertion. |
| Flue runtime throws synchronously on import (not async) | **NO** | Already covered by the try/catch in `createRunner()` which catches import errors. |
| Flue returns empty findings array | **NO** | Handled naturally — `flueInsights` exists but has zero insights. Add edge case note to VAL-FLUE-006. |
| Flue dispatch called on 0 findings (all ok/info) | **YES** | If all findings are ok/info/warning, no dispatch should happen. VAL-FLUE-009 covers "at most 6 calls" but doesn't test the "0 calls" boundary. Add: when 0 broken/risk/warning findings, 0 dispatch calls. |

**Suggested additions:**
- Edge case for wrong field types (number instead of string) in VAL-FLUE-007
- Edge case for hallucinated findingIds in VAL-FLUE-006
- Boundary test for 0 dispatch calls when no findings qualify in VAL-FLUE-009

---

### 2.6 SEV — Missing Edge Cases

| Edge Case | Missed? | Issue |
|-----------|---------|-------|
| Findings with no clear severity (ambiguous) | **YES** | The severity rubric is defined (0-4) but what happens when a finding doesn't fit neatly? Is there a default severity? The contract doesn't specify a default. In code, checks always set a severity — but if a check author picks the wrong one, there's no validation beyond the 0-4 range check. Add: VAL-SEV-007 "Every finding has severity in {0,1,2,3,4} and the severity is justified by area/status (non-arbitrary)." |
| Severity 0 findings across all areas | **YES** | Severity 0 means "informational, no action needed." But some checks return severity 0 for `ok` status — this is correct. Others return severity 0 for `info` when no data is available. Is there consistency? Example: `mcp-tools-filter` currently returns `info`/0 when no servers exist; after SEV-004 fix, it returns `warning`/1 when servers exist without filters. Need cross-check that ALL `ok` findings have severity 0. |
| `broken` findings with severity < 3 | **YES** | The rubric says `broken` = severity 3 (service-inoperable). But the contract doesn't audit whether any existing `broken` findings have severity < 3 (they should not). Add cross-check. |

**Suggested additions:**
- VAL-SEV-007: Audit that all `broken` findings have severity ≥ 3 and all `risk` findings have severity 4

---

## 3. Negative Assertion Gaps

### 3.1 Current Coverage

The contract has explicit negative assertions in three areas:

| Assertion | Negative Check |
|-----------|---------------|
| VAL-PROV-HARD-005 | Custom provider check does NOT fire on built-in providers |
| VAL-PROV-HARD-006 | Auth conflict check does NOT fire when aligned |
| VAL-PROV-HARD-007 | Orphaned model check does NOT fire when references are valid |

These cover the three new provider checks adequately.

### 3.2 Missing Negative Assertions

#### PKG Area

| Gap | Issue |
|-----|-------|
| No negative for VAL-PKG-005 (no Flue import) | Need: "When `@flue/runtime` IS installed but `--flue` is NOT passed, Flue is still not imported." The presence of the installed package should not cause incidental loading. The code already handles this (guard in `shouldEnableFlue`), but no test confirms it. |
| No negative for VAL-PKG-002 (no Flue installed, no --flue) | Covered by VAL-PKG-002 itself (it IS the negative for the Flue path). |

#### MCP Area

| Gap | Issue |
|-----|-------|
| No negative for VAL-MCP-001 (remote-only not flagged) | Need: "When ALL MCP servers are remote-only (no commands), `mcp-commands-exist` produces `ok` (not `broken`)." Currently, if all servers are remote-only, the check returns `ok` because `missingCmds` is empty — but no test validates this exact scenario. |
| No negative for VAL-MCP-002 (local still flagged) | Covered by VAL-MCP-002 itself. |

#### SEV Area

| Gap | Issue |
|-----|-------|
| No negative for VAL-SEV-004 (warning not broken for missing filters) | Need: "When all MCP servers have tool filters, `mcp-tools-filter` returns `ok`/0, not `warning`/1." After the fix, the check should still be `ok` when filters are present. |
| No negative for VAL-SEV-002 (only risk findings have severity 4) | Need: "Security findings with status `ok`, `info`, or `warning` do NOT have severity 4." Severity 4 should be reserved for `risk` status only. |

#### WORD Area

| Gap | Issue |
|-----|-------|
| VAL-WORD-001/002/003 check absence of "safe to share" — but no assertion confirms the NEW wording IS present | VAL-WORD-004 partially covers this but is broad ("redacted for sharing" or equivalent). No assertion like: "Console output does NOT contain 'safe to share' AND DOES contain 'redacted for sharing' in the privacy footer." |
| No negative for VAL-WORD-009 (schema field rename) | Need: "JSON output does NOT contain `safeToShare` key." The current test still checks `expect(parsed.safeToShare).toBe(true)`. |

### 3.3 Summary Table

| Area | Negative Assertions Present | Missing |
|------|---------------------------|---------|
| PKG | 0 of 10 | 1: no Flue import when installed but --flue not passed |
| CI | 0 of 6 | None needed (static assertions, no false-positive risk) |
| WORD | 0 of 13 | 2: absence of old word + presence of new word; schema field rename negative |
| PROV-HARD | 3 of 9 | Adequate |
| MCP | 0 of 4 | 1: all remote-only → ok |
| SEV | 0 of 6 | 2: filters-present → ok; non-risk security → sev < 4 |
| EVID | 0 of 4 | None needed |
| FLUE | 0 of 11 | 1: 0 findings → 0 dispatch calls |
| FIX | 0 of 5 | None needed |
| DOCS | 0 of 7 | None needed |
| CLI | 0 of 3 | None needed |
| REDACT | 0 of 3 | None needed |

---

## 4. Exit Code Consistency

### 4.1 Contract Exit Code Map

| Assertion | Scenario | Expected Exit |
|-----------|----------|---------------|
| VAL-PKG-002 | Scan without `@flue/runtime` | 0 |
| VAL-PKG-003 | `--flue` without `@flue/runtime` installed | 0 |
| VAL-PKG-004 | `--flue` without API key | 0 |
| VAL-FLUE-007 | Flue returns malformed JSON | 0 |
| VAL-FLUE-011 | Flue timeout | 0 |
| VAL-CLI-002 | Scan on valid home | 0 |
| VAL-CLI-002 | Scan on nonexistent home | 1 |
| VAL-CLI-003 | `--help` | 0 |
| MCP-001 (implicit) | Remote-only server | 0 (no crash) |

### 4.2 Consistency Analysis

**Finding: Consistent but with one ambiguity**

All graceful degradation paths (missing dependency, missing API key, malformed Flue, Flue timeout) exit 0 — consistent. The contract's philosophy is clear: Flue is an optional enhancement; any Flue failure must not fail the scan.

**Ambiguity: VAL-PKG-003 exit 0 when `--flue` is passed but runtime is missing**

The user explicitly asked for `--flue`. Should the scan exit 0 silently, or should it exit 0 with a warning on stderr? The contract says exit 0 + warning on stderr — consistent with the "Flue is optional" philosophy. But consider: what if the user has `HERMES_DOCTOR_USE_FLUE=1` set in env and `--flue` is passed by a CI script? The CI would pass (exit 0) but Flue insights would be silently missing. 

**Recommendation:** Add a requirement that when `--flue` is explicitly passed but Flue cannot run, stderr MUST contain a warning (already in VAL-PKG-003 evidence). Consider also writing the warning to stdout so it's visible in CI logs.

**No contradictions found.** All exit code expectations are consistent: 0 for success/degraded-success, 1 for input errors (bad path, bad format), 0 for help.

### 4.3 What's NOT Covered

| Gap | Issue |
|-----|-------|
| What exit code when `--flue` is passed AND `@flue/runtime` is installed AND API key is set BUT the Flue API returns a 500 error? | Not specified. Following the philosophy, it should be 0 (graceful degradation). But the contract only covers timeout (VAL-FLUE-011) and malformed JSON (VAL-FLUE-007). Network errors (ECONNREFUSED, 5xx) should also be covered. |
| What exit code when Redaction itself throws an error? | Not specified. If `redactDeep` encounters a circular reference, it could infinite-loop or throw. Should be 0 with unredacted output + stderr warning, or 1 to signal data integrity issue? |

---

## 5. Redaction Consistency

### 5.1 Current Redaction Architecture

The redaction system (`packages/core/src/redaction/redact.ts`) works by:
1. Applying regex patterns (`REDACTION_PATTERNS` in `patterns.ts`) to all string values
2. Home path normalization (`/home/user/...` → `<HOME>/...`)
3. Deep-walking objects via `redactDeep()`, which recursively processes all strings, array elements, and object values

**Key insight:** `redactDeep()` is called in `finalize()` which wraps every collector result. This means ANY new data added to ProviderData (or any other snapshot data) is automatically redacted if it passes through `finalize()`.

### 5.2 VAL-PROV-HARD-004 Scope Analysis

The contract requires auth.json content redaction. But the ProviderData schema (`snapshot.ts`) currently has these fields:
- `defaultModel` — a string, automatically redacted by deep-walk
- `providers` — array of `{name, requiredEnv, envSet}`, automatically redacted
- `localEndpoints` — array of `{url, reachable, latencyMs}`, automatically redacted
- `keyChecks` — array of `{provider, formatOk}`, automatically redacted

If the collector is extended to also read:
- **auth.json** (`active_provider`, credentials) — would be added to ProviderData or a new snapshot section
- **customProviders** — list of custom provider names and their `base_url` settings
- **modelReferences** — model→provider mapping data

All of these would be automatically deep-redacted by `finalize()` because it calls `redactDeep(data, options)`. **But**, the redaction is pattern-based, not structural. If auth.json contains a secret that doesn't match any `REDACTION_PATTERNS` regex, it will NOT be redacted.

### 5.3 Specific Redaction Gaps

| Gap | Issue |
|-----|-------|
| auth.json non-standard secrets | The redaction patterns cover known formats (OpenAI, Anthropic, GitHub, Slack, Bearer, etc.). But auth.json could contain a provider-specific key like `cohere_api_key: "abc123..."` or a custom token that doesn't match any pattern. **No regex for Cohere keys, Groq keys** (though Groq has `gsk_` prefix — the patterns don't include it). |
| `active_provider` field value | The field value itself is a provider name (not a secret). The contract correctly says it's safe to show. No issue. |
| modelReferences / customProviders data | These would contain provider names, base_url values, mapping data. If they enter the ProviderData, `redactDeep` handles them automatically. But `base_url` values could be sensitive if they contain API keys in the URL (e.g., `https://user:pass@api.example.com`). The `password` pattern in REDACTION_PATTERNS handles URL credentials. |
| auth.json path in evidence | `addEvidence()` in the collector stores a `detail` string. If the auth.json path contains the user's home directory, home-path redaction converts it to `<HOME>/auth.json`. This is correct. |
| Strict redaction mode | VAL-PROV-HARD-004 doesn't mention `--strict-redaction`. If strict mode is enabled, `base64_string` patterns would additionally redact base64-looking strings in auth.json. This is probably desirable but not specified. |

### 5.4 Recommendations

1. **Add missing key patterns** to `REDACTION_PATTERNS`: Groq keys (`gsk_`), Cohere keys (no known prefix — would need structural redaction), and any new provider key prefixes.

2. **Add structural redaction for auth.json**: Instead of relying solely on regex patterns, the auth.json reader should structurally identify credential fields (any key matching `/key|token|secret|password|credential/i`) and redact their values BEFORE adding to evidence. This is defense-in-depth.

3. **Clarify in the contract** that modelReferences, customProviders, and any new ProviderData fields are subject to the same redaction as auth.json data — since they all flow through `finalize()` → `redactDeep()`.

---

## 6. Final Assessment

### 6.1 Contract Strengths

- **Comprehensive scope**: 82 assertions across 13 areas is thorough.
- **Negative assertion coverage in PROV-HARD**: The three new checks have corresponding negative assertions — well-designed.
- **Tool specification**: Each assertion specifies its test tool (vitest, shell, grep), making implementation planning straightforward.
- **Evidence requirements**: Concrete pass/fail criteria with edge case notes.
- **Edge case awareness**: Most assertions include edge case discussions.

### 6.2 Contract Gaps

| Category | Severity | Count |
|----------|----------|-------|
| Hard-to-test assertions | Medium | 5 (VAL-PKG-005, VAL-PKG-010, VAL-WORD-008, VAL-WORD-013, VAL-CLI-001) |
| Missing edge cases | Medium | 12 across all areas |
| Missing negative assertions | Medium | 6 (PKG:1, WORD:2, MCP:1, SEV:2) |
| Exit code ambiguities | Low | 2 (Flue API errors, redaction errors) |
| Redaction scope gaps | Medium | 3 (missing key patterns, no structural redaction, strict mode not addressed) |

### 6.3 Verdict

**The contract is comprehensive enough for implementation**, with the following required amendments before implementation begins:

1. **MUST FIX**: Resolve VAL-CLI-001 vs VAL-CLI-008 contradiction (bare invocation: scan vs help)
2. **MUST FIX**: Relax VAL-PKG-010 from "identical" to "functionally equivalent"
3. **MUST FIX**: Add Groq (`gsk_`) and other missing API key patterns to REDACTION_PATTERNS
4. **SHOULD FIX**: Add the 6 missing negative assertions
5. **SHOULD FIX**: Add edge cases for Flue wrong field types (VAL-FLUE-007) and 0-findings dispatch (VAL-FLUE-009)
6. **SHOULD FIX**: Add PKG edge case for ESM format verification and `files` field checking
7. **NICE TO HAVE**: Add auth.json BOM handling, YAML anchor handling, Windows CI decision
8. **NICE TO HAVE**: Cover Flue network errors (5xx, ECONNREFUSED) in exit code expectations

### 6.4 Implementation Readiness by Area

| Area | Ready? | Blockers |
|------|--------|----------|
| PKG | ✅ (with PKG-010 relaxation) | PKG-010 "identical" requirement |
| CI | ✅ | None |
| WORD | ✅ | None (grep-based, straightforward) |
| PROV-HARD | ⚠️ Partially | Needs auth.json reading in paths + collector extension; missing redaction patterns |
| MCP | ✅ | Just the `!s.executableFound` → `=== false` fix |
| SEV | ✅ | Just changing numbers in check functions |
| EVID | ✅ | Schema + adapter code |
| FLUE | ✅ | Mocked Flue testing |
| FIX | ⚠️ Partially | Schema doesn't have `risk`, `requiresConfirmation`, `manualSteps`, `rollback` yet |
| DOCS | ✅ | File creation + grep checks |
| CLI | ⚠️ Partially | VAL-CLI-001 contradicts current behavior; needs code change |
| REDACT | ✅ | grep checks on docs |
| EX | ✅ | Example report generation |
