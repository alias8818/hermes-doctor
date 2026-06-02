# Hermes Doctor — Red Team Redaction Report

**Generated:** 2026-05-31  
**Test Suite:** VAL-REDTEAM-001 through VAL-REDTEAM-012  
**Fixture:** `fixtures/validation/redaction-torture/all-surfaces`  
**Hard Gate Status:** ✅ ALL CLEAN — zero raw secrets in any output format

---

## Injection Surfaces

### 1. config.yaml — Provider API Key Redaction

Tokens injected directly into `config.yaml` under provider blocks.

| Secret Type | Value Injected | Console Redacted? | Markdown Redacted? | JSON Redacted? | Count Incremented? |
|-------------|---------------|-------------------|--------------------|----------------|--------------------|
| OpenAI key | `sk-test-1234567890abcdefghij` | ✅ `[REDACTED:OPENAI_KEY]` | ✅ `[REDACTED:OPENAI_KEY]` | ✅ `[REDACTED:OPENAI_KEY]` | ✅ ≥1 |
| Anthropic key | `sk-ant-test-1234567890abcdef` | ✅ `[REDACTED:ANTHROPIC_KEY]` | ✅ `[REDACTED:ANTHROPIC_KEY]` | ✅ `[REDACTED:ANTHROPIC_KEY]` | ✅ ≥1 |
| GitHub token | `ghp_test1234567890abcdefghijklmno` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ ≥1 |
| GitHub PAT | `github_pat_test_abc123def456ghi789jkl012mno` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ ≥1 |

**Patterns matched:** `openai_key`, `anthropic_key`, `github_token`  
**VAL-REDTEAM-001 Verdict:** ✅ PASS

---

### 2. .env File — Multi-Secret Redaction

`.env` file containing env var declarations for every secret type.

| Secret Type | Value Injected | Console Redacted? | Markdown Redacted? | JSON Redacted? | Count Incremented? |
|-------------|---------------|-------------------|--------------------|----------------|--------------------|
| OpenAI key | `sk-test-1234567890abcdefghij` | ✅ `[REDACTED:OPENAI_KEY]` | ✅ `[REDACTED:OPENAI_KEY]` | ✅ `[REDACTED:OPENAI_KEY]` | ✅ |
| Anthropic key | `sk-ant-test-1234567890abcdef` | ✅ `[REDACTED:ANTHROPIC_KEY]` | ✅ `[REDACTED:ANTHROPIC_KEY]` | ✅ `[REDACTED:ANTHROPIC_KEY]` | ✅ |
| GitHub token | `ghp_test1234567890abcdefghijklmno` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ |
| GitHub PAT | `github_pat_test_abc123def456...` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ |
| Slack bot token | `xoxb-test-1234567890-ABCDEFGHIJ` | ✅ `[REDACTED:SLACK_TOKEN]` | ✅ `[REDACTED:SLACK_TOKEN]` | ✅ `[REDACTED:SLACK_TOKEN]` | ✅ |
| Bearer token | `test-bearer-token-abc123def456ghi789jkl012` | ✅ `[REDACTED:BEARER_TOKEN]` | ✅ `[REDACTED:BEARER_TOKEN]` | ✅ `[REDACTED:BEARER_TOKEN]` | ✅ |
| Slack webhook URL | `https://hooks.slack.com/services/T0000000000/...` | ✅ host preserved, path redacted | ✅ host preserved | ✅ host preserved | ✅ |
| Discord webhook | `https://discord.com/api/webhooks/...` | ✅ host preserved, path redacted | ✅ host preserved | ✅ host preserved | ✅ |
| Password | `test-password-abc123` | ✅ `[REDACTED:PASSWORD]` | ✅ `[REDACTED:PASSWORD]` | ✅ `[REDACTED:PASSWORD]` | ✅ |

**Patterns matched:** `openai_key`, `anthropic_key`, `github_token`, `slack_token`, `bearer_token`, `webhook_token`, `password`  
**VAL-REDTEAM-002 Verdict:** ✅ PASS

---

### 3. Log Files — Secrets in Error Logs

Secrets interleaved with realistic log lines in `logs/errors.log` and `logs/hermes.log`. Requires `--include-log-snippets` flag.

| Secret Type | Value Injected | Console Redacted? | Markdown Redacted? | JSON Redacted? | Count Incremented? |
|-------------|---------------|-------------------|--------------------|----------------|--------------------|
| OpenAI key | `sk-test-1234567890abcdefghij` | ✅ `[REDACTED:OPENAI_KEY]` | ✅ | ✅ | ✅ |
| Anthropic key | `sk-ant-test-1234567890abcdef` | ✅ `[REDACTED:ANTHROPIC_KEY]` | ✅ | ✅ | ✅ |
| Bearer token | `test-bearer-token-abc123def456` | ✅ `[REDACTED:BEARER_TOKEN]` | ✅ | ✅ | ✅ |
| GitHub token | `ghp_test1234567890abcdefghijklmno` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ | ✅ | ✅ |
| Slack token | `xoxb-test-1234567890-ABCDEFGHIJ` | ✅ `[REDACTED:SLACK_TOKEN]` | ✅ | ✅ | ✅ |
| Slack webhook URL | `https://hooks.slack.com/services/T...` | ✅ path redacted | ✅ | ✅ | ✅ |
| Discord webhook | `https://discord.com/api/webhooks/...` | ✅ path redacted | ✅ | ✅ | ✅ |
| SSH key BEGIN marker | `-----BEGIN OPENSSH PRIVATE KEY-----` | ✅ `[REDACTED:SSH_PRIVATE_KEY]` | ✅ | ✅ | ✅ |
| SSH key END marker | `-----END OPENSSH PRIVATE KEY-----` | ✅ `[REDACTED:SSH_PRIVATE_KEY]` | ✅ | ✅ | ✅ |

**Patterns matched:** `openai_key`, `anthropic_key`, `bearer_token`, `webhook_token`, `github_token`, `slack_token`, `ssh_private_key`  
**VAL-REDTEAM-003 Verdict:** ✅ PASS

---

### 4. Memory Files — Secrets in Markdown

Secrets injected into `memory/codebase.md` and `memory/preferences.md`.

| Secret Type | Value Injected | Console Redacted? | Markdown Redacted? | JSON Redacted? | Count Incremented? |
|-------------|---------------|-------------------|--------------------|----------------|--------------------|
| OpenAI key | `sk-test-1234567890abcdef` | ✅ `[REDACTED:OPENAI_KEY]` | ✅ | ✅ | ✅ |
| Anthropic key | `sk-ant-test-1234567890abcdef` | ✅ `[REDACTED:ANTHROPIC_KEY]` | ✅ | ✅ | ✅ |
| GitHub token | `ghp_test1234567890abcdef` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ | ✅ | ✅ |
| Webhook token | `test-webhook-token-abc` | ✅ `[REDACTED:WEBHOOK_TOKEN]` | ✅ | ✅ | ✅ |

**Patterns matched:** `openai_key`, `anthropic_key`, `github_token`, `webhook_token`  
**VAL-REDTEAM-004 Verdict:** ✅ PASS

---

### 5. SKILL.md — Secrets in Skill Directories

Secrets injected into `skills/my-tool/SKILL.md`.

| Secret Type | Value Injected | Console Redacted? | Markdown Redacted? | JSON Redacted? | Count Incremented? |
|-------------|---------------|-------------------|--------------------|----------------|--------------------|
| Anthropic key | `sk-ant-test-1234567890abcdef` | ✅ `[REDACTED:ANTHROPIC_KEY]` | ✅ | ✅ | ✅ |
| GitHub token | `ghp_test1234567890abcdef` | ✅ `[REDACTED:GITHUB_TOKEN]` | ✅ | ✅ | ✅ |

**Patterns matched:** `anthropic_key`, `github_token`  
**VAL-REDTEAM-005 Verdict:** ✅ PASS

---

### 6. Plugin Manifests — Secrets in `plugin.json`

Secrets injected into plugin `plugin.json` manifest files.

| Secret Type | Value Injected | Console Redacted? | Markdown Redacted? | JSON Redacted? | Count Incremented? |
|-------------|---------------|-------------------|--------------------|----------------|--------------------|
| OpenAI key | `sk-test-1234567890abcdef` | ✅ | ✅ | ✅ | ✅ |
| GitHub token | `github_pat_test_abc123def...` | ✅ | ✅ | ✅ | ✅ |
| Bearer token | `test-bearer-token-abc123def` | ✅ | ✅ | ✅ | ✅ |
| Webhook URL | Slack webhook path | ✅ | ✅ | ✅ | ✅ |

**Patterns matched:** `openai_key`, `github_token`, `bearer_token`, `webhook_token`  
**VAL-REDTEAM-006 Verdict:** ✅ PASS

---

### 7. Renderer-Level Defense-in-Depth (VAL-REDTEAM-007)

Programmatic test that bypasses all collectors and injects secrets directly into `DoctorReport` before calling each renderer.

| Renderer | Post-Collected Secrets Caught? | Pre-redacted Content Preserved? | Double-Redaction Safe? |
|----------|-------------------------------|-------------------------------|----------------------|
| `renderConsole()` | ✅ All 5 types redacted | ✅ `[REDACTED:OPENAI_KEY]` preserved | ✅ No `[REDACTED:[REDACTED:` |
| `renderMarkdown()` | ✅ All 5 types redacted | ✅ `[REDACTED:ANTHROPIC_KEY]` preserved | ✅ No corruption |
| `renderJson()` | ✅ All 5 types redacted, count ≥5 | ✅ Patterns merged | ✅ Safe |

**Test A — Post-collector injection:** Renderer catches `sk-test-...`, `ghp_test...`, `xoxb-test-...`, webhook URLs, Bearer tokens that weren't caught at collector boundary.  
**Test B — Double-redaction safety:** `redact("Found [REDACTED:OPENAI_KEY] and [REDACTED:BEARER_TOKEN]")` returns identical string (no corruption).  

**VAL-REDTEAM-007 Verdict:** ✅ PASS

---

### 8. Cumulative Redaction (VAL-REDTEAM-008)

All seven injection surfaces combined in a single scan with `--include-log-snippets`.

| Metric | Observed | Threshold | Verdict |
|--------|----------|-----------|---------|
| `totalRedactions` | ≥ 20 | ≥ 10 | ✅ |
| `patterns` superset | Contains all 8+ types | ≥ 7 types | ✅ |
| Console raw secrets | 0 matches | 0 | ✅ |
| Markdown raw secrets | 0 matches | 0 | ✅ |
| JSON raw secrets | 0 matches | 0 | ✅ |
| `safeToShare` | `true` | `true` | ✅ |

**VAL-REDTEAM-008 Verdict:** ✅ PASS

---

### 9. Hard Gate: Zero Raw Secrets (VAL-REDTEAM-009)

Grep-based verification across all three output formats for every injected value.

| Secret Substring | Console Present? | Markdown Present? | JSON Present? | Verdict |
|-----------------|-----------------|-------------------|---------------|---------|
| `sk-test-1234567890abcdefghij` | ❌ | ❌ | ❌ | ✅ PASS |
| `sk-ant-test-1234567890abcdef` | ❌ | ❌ | ❌ | ✅ PASS |
| `ghp_test1234567890abcdefghijklmno` | ❌ | ❌ | ❌ | ✅ PASS |
| `xoxb-test-1234567890-ABCDEFGHIJ` | ❌ | ❌ | ❌ | ✅ PASS |
| `test-bearer-token-abc123def456` | ❌ | ❌ | ❌ | ✅ PASS |
| `BEGIN OPENSSH PRIVATE KEY` | ❌ | ❌ | ❌ | ✅ PASS |
| `test-password-abc123` | ❌ | ❌ | ❌ | ✅ PASS |
| Slack webhook path token `T0000000000` | ❌ | ❌ | ❌ | ✅ PASS |
| Discord webhook path `123456789012345678` | ❌ | ❌ | ❌ | ✅ PASS |

**VAL-REDTEAM-009 Verdict:** ✅ PASS (Zero raw secrets across all formats)

---

### 10. Safe-to-Share Under Torture (VAL-REDTEAM-010)

| Output Format | "safe to share" Present? | Verdict |
|---------------|------------------------|---------|
| Console | ✅ Present | ✅ |
| Markdown | ✅ Present | ✅ |
| JSON (`safeToShare`) | ✅ `true` | ✅ |

**VAL-REDTEAM-010 Verdict:** ✅ PASS

---

### 11. Defense-in-Depth Layer Isolation (VAL-REDTEAM-011)

| Test | Description | Verdict |
|------|-------------|---------|
| Test A | Post-collector injection caught by renderer, count increases | ✅ PASS |
| Test B | Double-redaction doesn't corrupt `[REDACTED:...]` | ✅ PASS |

**VAL-REDTEAM-011 Verdict:** ✅ PASS

---

### 12. Strict Mode Escalation (VAL-REDTEAM-012)

| Metric | Normal Mode | Strict Mode | Verdict |
|--------|------------|-------------|---------|
| `totalRedactions` | ≥ 10 | ≥ normal | ✅ Strict ≥ Normal |
| Raw secrets in JSON | 0 | 0 | ✅ |
| Raw secrets in console | 0 | 0 | ✅ |
| `safeToShare` | `true` | `true` | ✅ |

**VAL-REDTEAM-012 Verdict:** ✅ PASS

---

## Overall Redaction Summary

| Surface | Secret Types Injected | Total Injections | Redacted Console | Redacted Markdown | Redacted JSON |
|---------|---------------------|-----------------|-----------------|-------------------|---------------|
| config.yaml | 4 (openai, anthropic, github, github_pat) | 4+ | ✅ | ✅ | ✅ |
| .env file | 9 (all types) | 9+ | ✅ | ✅ | ✅ |
| Log files | 9 (with SSH key blocks) | 9+ | ✅ | ✅ | ✅ |
| Memory files | 4 | 4+ | ✅ | ✅ | ✅ |
| SKILL.md | 2 | 2+ | ✅ | ✅ | ✅ |
| Plugin manifests | 4 | 4+ | ✅ | ✅ | ✅ |
| Renderer depth | 5 (post-collector) | 5+ | ✅ | ✅ | ✅ |

**Total unique secret patterns detected:** 8 (`openai_key`, `anthropic_key`, `github_token`, `slack_token`, `bearer_token`, `webhook_token`, `ssh_private_key`, `password`)  
**Strict mode additional patterns:** `auth_header`  
**Defense-in-depth layers confirmed working:**
1. Collector-boundary redaction (config YAML parse-time)
2. Collector-field redaction (env value masking)
3. Report-level `redactDeep()` pass
4. Renderer-level final pass (console, markdown, JSON)
5. Strict mode escalation

**FINAL VERDICT:** ✅ **ALL 12 REDTEAM ASSERTIONS PASS — Zero raw secrets survive in any output format.**
