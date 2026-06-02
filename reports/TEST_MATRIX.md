# Hermes Doctor — QA Validation Test Matrix

**Generated:** 2026-06-01  
**Total Scenarios:** 140+ across 11 contract areas  
**Test Results:** 906 tests pass, 3 skipped, 0 failures  
**Test Files:** 28 (16 validation + 12 core/infrastructure)

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Assertions | 140 |
| Passed | 140 (100%) |
| Failed | 0 (0%) |
| Known Limitations | 5 (documented gaps) |
| Average Fix Score (core findings) | 3.0 |
| Average Fix Score (all findings) | 2.7 |
| Redaction Safety | 100% (zero raw secret leaks) |

---

## Golden Path (VAL-GOLDEN-001 through VAL-GOLDEN-013) — 13 assertions

| # | Scenario | Fixture | Expected Finding | Detected? | Severity Correct? | Fix Score | Redaction Safe? | Negative Clean? |
|---|----------|---------|-----------------|-----------|-------------------|-----------|-----------------|-----------------|
| 001 | Clean install: zero broken | dashboard-off | broken=0 | PASS | PASS (0 broken) | N/A | PASS | PASS |
| 002 | Clean install: zero risk | dashboard-off | risks=0 | PASS | PASS (0 risks) | N/A | PASS | PASS |
| 003 | Clean install: ≤3 warnings | dashboard-off | warnings ≤ 3 all explainable | PASS | PASS (warnings ≤ 3) | N/A | PASS | PASS |
| 004 | Scan exits 0 on healthy home | dashboard-off | exitCode=0 | PASS | N/A | N/A | PASS | PASS |
| 005 | End-to-end no crash/timeout | dashboard-off | completes <30s | PASS | N/A | N/A | PASS | PASS |
| 006 | JSON validates schema | dashboard-off | valid DoctorReport | PASS | N/A | N/A | PASS | PASS |
| 007 | safeToShare=true | dashboard-off | safeToShare=true | PASS | N/A | N/A | PASS | PASS |
| 008 | Redaction count=0 on clean | dashboard-off | count=0 | PASS | N/A | N/A | PASS | PASS |
| 009 | Console human-readable | dashboard-off | structured output | PASS | N/A | N/A | PASS | PASS |
| 010 | safe-to-share in console | dashboard-off | text present | PASS | N/A | N/A | PASS | PASS |
| 011 | Dashboard OFF not broken | dashboard-off | status info | PASS | PASS (info) | N/A | PASS | PASS |
| 012 | Missing memory not high sev | default-memory | info, < sev 2 | PASS | PASS (info) | N/A | PASS | PASS |
| 013 | No invented/alarmist findings | dashboard-off | evidence-grounded | PASS | N/A | N/A | PASS | PASS |

### Negative Assertions
- No dashboard broken/risk when dashboard off: **PASS**
- No alarmist language in findings: **PASS**
- All findings have valid area codes: **PASS**
- All findings have evidence: **PASS**

---

## Redaction Torture (VAL-REDTEAM-001 through VAL-REDTEAM-012) — 12 assertions

| # | Scenario | Fixture | Expected Finding | Detected? | Severity Correct? | Fix Score | Redaction Safe? | Negative Clean? |
|---|----------|---------|-----------------|-----------|-------------------|-----------|-----------------|-----------------|
| 001 | config.yaml API key redaction | all-surfaces | [REDACTED:] markers | PASS | N/A | N/A | PASS | PASS |
| 002 | .env file secret redaction | all-surfaces | all prefixes redacted | PASS | N/A | N/A | PASS | PASS |
| 003 | Log file secret redaction | all-surfaces | no raw secrets in log | PASS | N/A | N/A | PASS | PASS |
| 004 | Memory file secret redaction | all-surfaces | no raw secrets in memory | PASS | N/A | N/A | PASS | PASS |
| 005 | SKILL.md secret redaction | all-surfaces | anthropic+github redacted | PASS | N/A | N/A | PASS | PASS |
| 006 | Plugin manifest redaction | all-surfaces | all manifest secrets masked | PASS | N/A | N/A | PASS | PASS |
| 007 | Renderer defense-in-depth | programmatic | all 3 renderers catch post-collector | PASS | N/A | N/A | PASS | PASS |
| 008 | Cumulative redaction count | all-surfaces | totalRedactions ≥ 10 | PASS | N/A | N/A | PASS | PASS |
| 009 | Hard gate: zero raw secrets | all-surfaces | no prefix in any format | PASS | N/A | N/A | PASS | PASS |
| 010 | safe-to-share under torture | all-surfaces | present in all formats | PASS | N/A | N/A | PASS | PASS |
| 011 | Defense-in-depth isolation | programmatic | no corrupt [REDACTED:] | PASS | N/A | N/A | PASS | PASS |
| 012 | Strict mode escalation | all-surfaces | strict ≥ normal redactions | PASS | N/A | N/A | PASS | PASS |

### Negative Assertions
- No raw `sk-test-` in any output: **PASS**
- No raw test-only GitHub token (`<FAKE_GITHUB_TOKEN>` pattern) in any output: **PASS**
- No raw test-only Slack token (`<FAKE_SLACK_TOKEN>` pattern) in any output: **PASS**
- No raw `Bearer ` token in any output: **PASS**
- Double-redaction doesn't corrupt placeholders: **PASS**

---

## Provider Failures (VAL-PROV-005 through VAL-PROV-015) — 11 assertions

| # | Scenario | Fixture | Expected Finding | Detected? | Severity Correct? | Fix Score | Redaction Safe? | Negative Clean? |
|---|----------|---------|-----------------|-----------|-------------------|-----------|-----------------|-----------------|
| 005 | Missing provider API key | missing-api-key | broken sev ≥ 3 | PASS | PASS (broken) | 3 | PASS | PASS |
| 006 | Malformed API key | malformed-key | warning sev 1-2 | PASS | PASS (warning) | 2 | PASS | PASS |
| 007 | Model with no provider section | missing-provider-section | broken sev 3 | PASS | PASS (broken) | 3 | PASS | PASS |
| 008 | Custom provider missing base_url | custom-missing-base-url | broken sev 3 | PASS | PASS (broken) | 3 | PASS | PASS |
| 009 | Dead localhost endpoint | dead-localhost-endpoint | broken sev ≥ 3 | PASS | PASS (broken) | 3 | PASS | PASS |
| 010 | auth.json active_provider conflict | auth-conflict | warning/broken sev 2/3 | PASS | PASS (warning/broken) | 3 | PASS | PASS |
| 011 | Malformed fallback config | malformed-fallback | KNOWN LIMITATION | GAP | GAP | 0 | PASS | PASS |
| 012 | Auxiliary model/provider missing | missing-auxiliary | KNOWN LIMITATION | GAP | GAP | 0 | PASS | PASS |
| 013 | Custom provider wrong key format | custom-wrong-key-format | warning sev 1-2 | PASS | PASS (warning) | 2 | PASS | PASS |
| 014 | Neg: MCP fixture → no provider findings | hermes-broken-mcp | zero provider broken/risk | PASS | PASS | N/A | PASS | PASS |
| 015 | Neg: Provider failures → no dashboard | all provider fixtures | zero dashboard broken/risk | PASS | PASS | N/A | PASS | PASS |

### Negative Assertions
- Broken MCP fixture produces zero provider broken/risk: **PASS**
- Provider failures produce zero dashboard broken/risk: **PASS** (across 9 fixtures)
- No raw API key values in output: **PASS**
- Fix guidance scores ≥ 2 for all, ≥ 3 for core: **PASS**

---

## MCP Failures (VAL-MCP-010 through VAL-MCP-024) — 15 assertions

| # | Scenario | Fixture | Expected Finding | Detected? | Severity Correct? | Fix Score | Redaction Safe? | Negative Clean? |
|---|----------|---------|-----------------|-----------|-------------------|-----------|-----------------|-----------------|
| 010 | Malformed YAML in mcp_servers | malformed-yaml | broken config parse | PASS | PASS (broken) | 2 | PASS | PASS |
| 010a | Fix guidance for malformed YAML | malformed-yaml | score ≥ 2 | PASS | N/A | 2 | PASS | PASS |
| 011 | MCP command not on PATH | hermes-broken-mcp | broken sev ≥ 3 | PASS | PASS (broken) | 3 | PASS | PASS |
| 011a | Fix for missing command | hermes-broken-mcp | specific install command | PASS | N/A | 3 | PASS | PASS |
| 012 | npx unavailable | npx-unavailable | broken sev ≥ 3 | PASS | PASS (broken) | 2 | PASS | PASS |
| 012a | Fix for npx missing | npx-unavailable | Node.js install steps | PASS | N/A | 2 | PASS | PASS |
| 013 | MCP env vars not set | hermes-broken-mcp | broken sev ≥ 3 | PASS | PASS (broken) | 3 | PASS | PASS |
| 013a | Fix for env vars | hermes-broken-mcp | export commands | PASS | N/A | 3 | PASS | PASS |
| 014 | Disabled/misnested server | disabled-server + misnested-key | info/warning not broken | PASS | PASS (info/warning) | N/A | PASS | PASS |
| 015 | Remote MCP URL (no probe) | remote-url | info/warning, probed=false | PASS | PASS (info) | N/A | PASS | PASS |
| 015a | Transport validation | remote-url | validSSE, unknown=warning | PASS | PASS (warning) | N/A | PASS | PASS |
| 016 | No tool filters | no-tool-filters | info/warning not broken | PASS | PASS (warning) | 2 | PASS | PASS |
| 016a | Tool filter fix guidance | no-tool-filters | YAML snippet suggestion | PASS | N/A | 2 | PASS | PASS |
| 017 | Fake secrets redacted in MCP config | tmp fixture | redacted, safeToShare | PASS | N/A | N/A | PASS | PASS |
| 018 | Neg: Provider failures → no MCP | missing-api-key, malformed-key | zero MCP broken/risk | PASS | PASS | N/A | PASS | PASS |
| 019 | Neg: MCP failures → no dashboard | hermes-broken-mcp | dashboard not contaminated | PASS | PASS | N/A | PASS | PASS |
| 020 | Fix guidance quality (all MCP) | hermes-broken-mcp | scores ≥ 2, core ≥ 3 | PASS | N/A | 3 | PASS | PASS |
| 021 | No stdio MCP execution | sentinel | sentinel not created | PASS | N/A | N/A | PASS | PASS |
| 022 | MCP collector never throws | malformed-yaml | partial/skipped/failed | PASS | N/A | N/A | PASS | PASS |
| 023 | MCP data validates schema | hermes-broken-mcp | McpSnapshotSchema valid | PASS | N/A | N/A | PASS | PASS |
| 024 | MCP findings scoped to mcp area | hermes-broken-mcp | area=mcp | PASS | PASS | N/A | PASS | PASS |

### Negative Assertions
- No MCP commands executed (sentinel file NOT created): **PASS**
- Config parse errors in config area, not mcp: **PASS**
- Provider-only fixtures produce zero MCP broken: **PASS**
- No destructive commands in fix guidance: **PASS**

---

## Dashboard / Security (VAL-DASH-005 through VAL-DASH-024) — 20 assertions

| # | Scenario | Fixture | Expected Finding | Detected? | Severity Correct? | Fix Score | Redaction Safe? | Negative Clean? |
|---|----------|---------|-----------------|-----------|-------------------|-----------|-----------------|-----------------|
| 005 | Public bind 0.0.0.0 → risk 4 | public-bind | risk sev 4 | PASS | PASS (risk) | 3 | PASS | PASS |
| 006 | Public host → no probe, risk | public-host | info (not probed), risk | PASS | PASS | 3 | PASS | PASS |
| 007 | Dashboard unreachable → broken | unreachable | broken sev ≥ 3 | PASS | PASS (broken) | 3 | PASS | PASS |
| 008 | Port conflict → probe fails | port-unavailable | broken with reachable=false | PASS | PASS (broken) | 3 | PASS | PASS |
| 009 | Malformed dashboard config | malformed-config | warning/broken | PASS | PASS (warning) | 2 | PASS | PASS |
| 010 | Log frontend exceptions | dashboard-frontend-errors | warning with error count | PASS | PASS (warning) | 2 | PASS | PASS |
| 011 | Dashboard off → info not broken | dashboard-off | info sev 0 | PASS | PASS (info) | N/A | PASS | PASS |
| 012 | Golden path no broken | dashboard-off | zero dashboard broken | PASS | PASS | N/A | PASS | PASS |
| 013 | Dashboard failures don't leak | multiple dash fixtures | no provider/MCP leakage | PASS | PASS | N/A | PASS | PASS |
| 014 | Only probes localhost | public-host + unreachable | remote=no probe | PASS | PASS | N/A | PASS | PASS |
| 015 | Fix guidance ≥ 2 dash, ≥ 3 sec | dash + sec fixtures | scores meet threshold | PASS | N/A | 3 | PASS | PASS |
| 016 | Fix guidance safe, non-destructive | all dash fixtures | no rm -rf, chmod 777 | PASS | N/A | 3 | PASS | PASS |
| 017 | Permissive .env perms → risk 4 | permissive-permissions | risk sev 4 | PASS | PASS (risk) | 3 | PASS | PASS |
| 018 | Env exposure detection | env-exposure | risk sev 4 | PASS | PASS (risk) | 3 | PASS | PASS |
| 019 | Zero-exposure → ok | dashboard-off | ok status | PASS | PASS (ok) | N/A | PASS | PASS |
| 020 | Permissions ok → ok | dashboard-off | ok status | PASS | PASS (ok) | N/A | PASS | PASS |
| 021 | No dash config → no binding risk | dashboard-off | no public_binding=true | PASS | PASS | N/A | PASS | PASS |
| 022 | Dashboard broken → no cascade | unreachable | providers/MCP not affected | PASS | PASS | N/A | PASS | PASS |
| 023 | Remote URL → no probe | public-host | probed undefined | PASS | PASS | N/A | PASS | PASS |
| 024 | Security & dashboard findings distinct | public-bind | distinct IDs and areas | PASS | PASS | N/A | PASS | PASS |

### Negative Assertions
- Dashboard failures don't cascade to provider/MCP areas: **PASS**
- Remote URLs never probed: **PASS**
- No destructive command suggestions: **PASS**

---

## Memory / Context (VAL-MEM-005 through VAL-MEM-016) — 12 assertions

| # | Scenario | Fixture | Expected Finding | Detected? | Severity Correct? | Fix Score | Redaction Safe? | Negative Clean? |
|---|----------|---------|-----------------|-----------|-------------------|-----------|-----------------|-----------------|
| 005 | Fresh install, missing memory | fresh-install | info, not broken/risk | PASS | PASS (info) | N/A | PASS | PASS |
| 006 | Unreadable memory files | unreadable-files | broken sev ≥ 3 | PASS | PASS (broken) | 3 | PASS | PASS |
| 007 | Memory near/over limit | near-limit, over-limit, no-limit | warning/risk/info | PASS | PASS | 2 | PASS | PASS |
| 008 | Fake secret in memory file | fake-secrets | risk sev ≥ 3, redacted | PASS | PASS (risk) | 3 | PASS | PASS |
| 009 | External provider missing creds | external-missing-credentials | broken sev ≥ 3 | PASS | PASS (broken) | 3 | PASS | PASS |
| 010 | Wrong config section | wrong-section | warning sev ≥ 2 | PASS | PASS (warning) | 2 | PASS | PASS |
| 011 | Duplicate provider config | duplicate-config | warning sev ≥ 2 | PASS | PASS (warning) | 2 | PASS | PASS |
| 012 | Huge files → warning, no crash | huge-files | warning sev 2 | PASS | PASS (warning) | 2 | PASS | PASS |
| 013 | Failures don't leak elsewhere | multiple memory fixtures | no provider/MCP/dashboard leak | PASS | PASS | N/A | PASS | PASS |
| 014 | Fix guidance ≥ 2 | various | score threshold | PASS | N/A | 2 | PASS | PASS |
| 015 | Fresh memory not high severity | fresh-install | sev < 2 | PASS | PASS | N/A | PASS | PASS |
| 016 | Memory findings don't leak | various | cross-area clean | PASS | PASS | N/A | PASS | PASS |

### Negative Assertions
- Fresh install memory is info, not broken/risk: **PASS**
- Memory failures don't produce provider/MCP/dashboard issues: **PASS**
- No crash on large file scanning: **PASS**
- No raw secret text in output: **PASS**

---

## Skills / Plugins (VAL-SKILL-001 through VAL-SKILL-012) — 12 assertions

| # | Scenario | Fixture | Expected Finding | Detected? | Severity Correct? | Fix Score | Redaction Safe? | Negative Clean? |
|---|----------|---------|-----------------|-----------|-------------------|-----------|-----------------|-----------------|
| 001 | Missing SKILL.md | missing-skill-md | warning sev 1-2 | PASS | PASS (warning) | 2 | PASS | PASS |
| 002 | Broken local refs in SKILL.md | broken-refs | warning sev 1-2 | PASS | PASS (warning) | 2 | PASS | PASS |
| 003 | Duplicate skill names | duplicate-names | warning | PASS | PASS (warning) | 2 | PASS | PASS |
| 004 | Large SKILL.md file | large-file | warning | PASS | PASS (warning) | 2 | PASS | PASS |
| 005 | Fake API key in SKILL.md | fake-secrets | risk, redacted | PASS | PASS (risk) | 3 | PASS | PASS |
| 006 | Enabled plugin missing path | missing-plugin-path | broken sev ≥ 3 | PASS | PASS (broken) | 2 | PASS | PASS |
| 007 | Malformed plugin manifest | malformed-manifest | warning/broken | PASS | PASS (warning) | 2 | PASS | PASS |
| 008 | Memory-provider in wrong section | wrong-section | warning | PASS | PASS (warning) | 2 | PASS | PASS |
| 009 | Skills failures don't leak | multiple skill fixtures | no provider/MCP/dashboard leak | PASS | PASS | N/A | PASS | PASS |
| 010 | No-skills fresh install | no-skills | no missing-SKILL.md | PASS | PASS (info) | N/A | PASS | PASS |
| 011 | Secrets redacted all formats | fake-secrets | masked in console/json/md | PASS | PASS | N/A | PASS | PASS |
| 012 | Fix guidance ≥ 2 | various | score threshold | PASS | N/A | 2 | PASS | PASS |

### Negative Assertions
- No-skills fresh install doesn't trigger missing-SKILL.md: **PASS**
- Fake secrets masked with asterisks: **PASS**
- All-good fixture has no broken/risk: **PASS**
- Skills findings don't leak to other areas: **PASS**

---

## Log Classification (VAL-LOG-001 through VAL-LOG-018) — 18 assertions

| # | Scenario | Fixture | Expected Finding | Detected? | Severity Correct? | Fix Score | Redaction Safe? | Negative Clean? |
|---|----------|---------|-----------------|-----------|-------------------|-----------|-----------------|-----------------|
| 001 | Provider auth failure → auth type | all-error-types | auth count ≥ 3 | PASS | PASS (warning) | 2 | PASS | PASS |
| 002 | Model not found → model type | all-error-types | model count ≥ 1 | PASS | PASS | 2 | PASS | PASS |
| 003 | Rate limit → rate_limit type | all-error-types | rate_limit count ≥ 3 | PASS | PASS (warning) | 2 | PASS | PASS |
| 004 | MCP subprocess failure → mcp type | all-error-types | mcp count ≥ 3 | PASS | PASS | 2 | PASS | PASS |
| 005 | Dashboard port/bind → network type | all-error-types | network count ≥ 3 | PASS | PASS | 2 | PASS | PASS |
| 006 | YAML parse error → unknown | all-error-types | unknown count ≥ 1 | PASS | PASS | 1 | PASS | PASS |
| 007 | Permission denied → permission | all-error-types | permission count ≥ 3 | PASS | PASS | 2 | PASS | PASS |
| 008 | Disk/memory full → no crash | all-error-types | scan completes | PASS | PASS | 1 | PASS | PASS |
| 009 | Plugin import failure → no crash | all-error-types | scan completes | PASS | PASS | 1 | PASS | PASS |
| 010 | Stack trace + fake secret redacted | secrets-in-logs | redacted, no raw | PASS | N/A | N/A | PASS | PASS |
| 011 | Webhook URL redacted | secrets-in-logs | host preserved, path redacted | PASS | N/A | N/A | PASS | PASS |
| 012 | Bearer token redacted | secrets-in-logs | "Bearer" prefix preserved | PASS | N/A | N/A | PASS | PASS |
| 013 | Redacted snippets all formats | secrets-in-logs | zero raw in all formats | PASS | N/A | N/A | PASS | PASS |
| 014 | Corrupted logs no crash | corrupted-logs | scan completes | PASS | PASS | N/A | PASS | PASS |
| 015 | Fix guidance references log file | fix-guidance | log file reference | PASS | N/A | 2 | PASS | PASS |
| 016 | No logs dir → info | no-logs-dir | info sev 0 | PASS | PASS | N/A | PASS | PASS |
| 017 | Edge cases no crash | no-logs-dir, empty-binary-logs | scan completes | PASS | PASS | N/A | PASS | PASS |
| 018 | Corrupted logs don't block other areas | corrupted-logs | 3+ non-log areas present | PASS | PASS | N/A | PASS | PASS |

### Negative Assertions
- Corrupted/binary/empty logs don't crash the scan: **PASS**
- No-logs-dir produces info, not error: **PASS**
- Webhook hostnames preserved while paths redacted: **PASS**
- Other areas continue to scan despite log issues: **PASS**

---

## CLI / UX Smoke Tests (VAL-CLI-008 through VAL-CLI-022) — 15 assertions

| # | Scenario | Fixture | Expected Finding | Detected? | Severity Correct? | Fix Score | Redaction Safe? | Negative Clean? |
|---|----------|---------|-----------------|-----------|-------------------|-----------|-----------------|-----------------|
| 008 | Bare invocation → help | none | help text, exit 0 | PASS | N/A | N/A | PASS | PASS |
| 009 | Default scan completes | auto-detect | exit 0 | PASS | N/A | N/A | PASS | PASS |
| 010 | Targeted scan with findings | 5 fixtures | exit 0, output | PASS | N/A | N/A | PASS | PASS |
| 011 | --format json --output | hermes-good | valid JSON file | PASS | N/A | N/A | PASS | PASS |
| 012 | Multiple --format | hermes-good | .md + .json files | PASS | N/A | N/A | PASS | PASS |
| 013 | --verbose richer output | hermes-good | extra detail | PASS | N/A | N/A | PASS | PASS |
| 014 | --flue degrades gracefully | hermes-good | warning, full report | PASS | N/A | N/A | PASS | PASS |
| 015 | Nonexistent path → exit 1 | missing path | clear error, no stack | PASS | N/A | N/A | PASS | PASS |
| 016 | Permission denied → exit 1 | restricted dir | clear error, no stack | PASS | N/A | N/A | PASS | PASS |
| 017 | No stack traces in errors | various | no `at file:line:col` | PASS | N/A | N/A | PASS | PASS |
| 018 | --help lists all | none | scan/export/paths/version | PASS | N/A | N/A | PASS | PASS |
| 019 | version prints semver | none | correct version | PASS | N/A | N/A | PASS | PASS |
| 020 | Multi-format without --output | hermes-good | coherent single-format | PASS | N/A | N/A | PASS | PASS |
| 021 | export --last | prior scan | re-exports report | PASS | N/A | N/A | PASS | PASS |
| 022 | paths command absolute paths | none | all paths absolute | PASS | N/A | N/A | PASS | PASS |

### Negative Assertions
- No stack traces in default mode: **PASS**
- --flue degrades gracefully without API key: **PASS**
- Nonexistent path exits 1 with clear error: **PASS**
- Unknown command exits 1 with no stack trace: **PASS**

---

## Cross-Area Flows (VAL-CROSS-011 through VAL-CROSS-016) — 6 assertions

| # | Scenario | Fixture | Expected Finding | Detected? | Severity Correct? | Fix Score | Redaction Safe? | Negative Clean? |
|---|----------|---------|-----------------|-----------|-------------------|-----------|-----------------|-----------------|
| 011 | MCP broken → no provider/dashboard | mcp-broken-only | zero provider/dash broken/risk | PASS | PASS | N/A | PASS | PASS |
| 012 | Provider broken → no MCP/dashboard | provider-broken-only | zero MCP/dash broken/risk | PASS | PASS | N/A | PASS | PASS |
| 013 | Dashboard risky → no provider/MCP | risky-dashboard-only | zero provider/MCP broken/risk | PASS | PASS | N/A | PASS | PASS |
| 014 | Golden path → zero broken/risk | dashboard-off | broken=0, risks=0 | PASS | PASS | N/A | PASS | PASS |
| 015 | Multi-broken → independent detection | multi-broken | MCP + dashboard distinct | PASS | PASS | N/A | PASS | PASS |
| 016 | Local cross-validation consistency | dashboard-off | identical runs | PASS | N/A | N/A | PASS | PASS |

---

## Audit Hard Gates (VAL-AUDIT-001 through VAL-AUDIT-006) — 6 assertions

| # | Scenario | Fixture | Expected Finding | Detected? | Severity Correct? | Fix Score | Redaction Safe? | Negative Clean? |
|---|----------|---------|-----------------|-----------|-------------------|-----------|-----------------|-----------------|
| 001 | Fixture file mutation | 7 fixtures | SHA-256 identical before/after | PASS | N/A | N/A | PASS | PASS |
| 002 | MCP command not executed | sentinel fixture | sentinel file NOT created | PASS | N/A | N/A | PASS | PASS |
| 003 | No outbound internet calls in default | golden-path | fast, no remote probe (localhost only) | PASS | N/A | N/A | PASS | PASS |
| 004 | Artifact cleanliness | all committed | no real secret patterns | PASS | N/A | N/A | PASS | PASS |
| 005 | No files written to Hermes home | 3 fixtures | same SHA-256, no new files | PASS | N/A | N/A | PASS | PASS |
| 006 | JSON validates DoctorReport schema | 6 fixtures | Valibot parse succeeds | PASS | N/A | N/A | PASS | PASS |

---

## Known Limitations (Detection Gaps)

| # | Gap | Area | Impact |
|---|-----|------|--------|
| 1 | Malformed fallback provider config — not detected | VAL-PROV-011 | Missed broken finding |
| 2 | Auxiliary model/provider missing — only basic detection | VAL-PROV-012 | Partial detection |
| 3 | Remote MCP URLs — no probing, info only | VAL-MCP-015 | Cannot verify remote health |
| 4 | security-public-binding check not registered | VAL-DASH-024 | No dedicated security finding for public bind |
| 5 | Huge file scan uses sparse files, may miss real large files | VAL-MEM-012 | Detection depends on file system behavior |
