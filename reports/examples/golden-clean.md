# Hermes Doctor — Health Report

_Generated: 2026-05-31T16:13:07.405Z  |  Profile: default_
_Hermes Home: <HOME>/workspace/hermes-doctor/fixtures/hermes-good_

## Environment

| Field | Value |
|-------|-------|
| OS | linux |
| Architecture | x64 |
| Node Version | v26.2.0 |
| Profile | default |

## Summary

| Status | Count |
|--------|-------|
| ✅ OK | 36 |
| ℹ️ Info | 8 |
| ⚠️ Warnings | 2 |
| ❌ Broken | 6 |
| 🔴 Risks | 1 |
| **Total** | **53** |

## ✅ OK (36)

### Docker Available

**Status:** ✅ OK

Docker is installed: Docker version 29.1.3, build 29.1.3-0ubuntu3~24.04.2

**Evidence:**

- `docker`: Docker version 29.1.3, build 29.1.3-0ubuntu3~24.04.2

### Git Available

**Status:** ✅ OK

Git is installed: git version 2.43.0

**Evidence:**

- `git`: git version 2.43.0

### Hermes Home Exists

**Status:** ✅ OK

Hermes home directory found at <HOME>

**Evidence:**

- `home_path`: <HOME>
- `home_exists`: true

### Configuration Valid

**Status:** ✅ OK

config.yaml exists and is valid YAML

**Evidence:**

- `config_path`: <HOME>/config.yaml
- `config_valid`: true

### Profiles Configured

**Status:** ✅ OK

Found 1 profile(s): default

**Evidence:**

- `profiles`: ["default"]

### All Required Sections Present

**Status:** ✅ OK

config.yaml contains all required top-level sections

**Evidence:**

- `sections`: {"providers":true,"mcp":true,"dashboard":true,"memory":true,"skills":true,"plugins":true,"security":true}

### Config Schema Conformant

**Status:** ✅ OK

Configuration follows the expected schema

**Evidence:**

- `schema_errors`: []

### Dashboard Bound to Localhost

**Status:** ✅ OK

Dashboard is bound to 127.0.0.1 (localhost only)

**Evidence:**

- `bind_address`: 127.0.0.1
- `is_localhost`: true

### Dashboard Authentication Enabled

**Status:** ✅ OK

Dashboard requires authentication

**Evidence:**

- `auth_required`: true

### Default Model Configured

**Status:** ✅ OK

Default model: claude-sonnet-4-20250514

**Evidence:**

- `models_configured`: 2
- `default_model`: claude-sonnet-4-20250514

### Provider Environment Variables Set

**Status:** ✅ OK

All 2 provider(s) have required environment variables

**Evidence:**

- `providers`: [{"name":"anthropic","required\_env":["ANTHROPIC\_API\_KEY"],"env\_set":true},{"name":"openai","required\_env":["OPENAI\_API\_KEY"],"env\_set":true}]

### MCP Servers Configured

**Status:** ✅ OK

2 MCP server(s) configured: filesystem, github

**Evidence:**

- `servers`: ["filesystem","github"]

### MCP Commands Resolved

**Status:** ✅ OK

All 2 MCP server command(s) resolve to valid executables

**Evidence:**

- `servers`: [{"name":"filesystem","command":"npx -y @modelcontextprotocol/server-filesystem","executable\_found":true},{"name":"github","command":"npx -y @modelcontextprotocol/server-github","executable\_found":true}]

### MCP Server Transports Valid

**Status:** ✅ OK

All 2 MCP server(s) have recognized transports

**Evidence:**

- `servers`: [{"name":"filesystem","transport":"stdio","transport\_valid":true},{"name":"github","transport":"stdio","transport\_valid":true}]

### Memory Files Exist

**Status:** ✅ OK

2 memory file(s) found (total: 765 B)

**Evidence:**

- `memory_dir`: <HOME>/memory
- `file_count`: 2
- `readable`: true
- `dir_exists`: true

### Memory File Sizes Normal

**Status:** ✅ OK

All 2 memory file(s) are within normal size range

**Evidence:**

- `files`: [{"name":"codebase.md","size\_bytes":398,"large":false},{"name":"preferences.md","size\_bytes":367,"large":false}]

### Memory Usage OK

**Status:** ✅ OK

Memory usage at 0.0% of limit (765 B / 10.0 MB)

**Evidence:**

- `total_size_bytes`: 765
- `limit_bytes`: 10485760
- `usage_percent`: 0

### No Secrets in Memory Files

**Status:** ✅ OK

No API keys, tokens, or secrets detected in memory files

**Evidence:**

- `memory_dir`: <HOME>/memory
- `secrets_count`: 0
- `secrets`: []

### No Huge Memory Files

**Status:** ✅ OK

No memory files exceed 100 MB

**Evidence:**

- `huge_files`: []

### Memory Provider Config OK

**Status:** ✅ OK

No duplicate or conflicting memory provider configurations detected

**Evidence:**

- `external_provider`: null
- `has_duplicate_providers`: null
- `duplicate_provider_names`: null

### Memory Config Section OK

**Status:** ✅ OK

No memory providers found in non-standard config sections

**Evidence:**

- `misplaced_config`: null
- `misplaced_config_details`: null

### All Skills Have SKILL.md

**Status:** ✅ OK

All 2 skill(s) have SKILL.md files

**Evidence:**

- `skills`: [{"dir":"<HOME>/skills/code-review","has\_skill\_md":true},{"dir":"<HOME>/skills/shell","has\_skill\_md":true}]

### No Duplicate Skill Names

**Status:** ✅ OK

All skill names are unique

**Evidence:**

- `duplicates`: []

### Skill Metadata Complete

**Status:** ✅ OK

All 2 skill(s) have complete metadata

**Evidence:**

- `skills`: [{"name":"code-review","metadata\_complete":true,"missing\_fields":[]},{"name":"shell","metadata\_complete":true,"missing\_fields":[]}]

### Plugin Paths Exist

**Status:** ✅ OK

All 2 enabled plugin(s) have valid paths

**Evidence:**

- `plugins`: [{"name":"code-assist","path":"<HOME>/plugins/code-assist","enabled":true,"exists":true},{"name":"terminal-tools","path":"<HOME>/plugins/terminal-tools","enabled":true,"exists":true}]

### Plugin Manifests Valid

**Status:** ✅ OK

All 2 plugin manifest(s) are parseable

**Evidence:**

- `plugins`: [{"name":"code-assist","manifest\_found":true,"manifest\_valid":true,"parse\_error":null},{"name":"terminal-tools","manifest\_found":true,"manifest\_valid":true,"parse\_error":null}]

### Plugin Hermes Compatibility OK

**Status:** ✅ OK

All 2 plugin(s) with version requirements are compatible

**Evidence:**

- `plugins`: [{"name":"code-assist","requires\_hermes":">=1.0","compatible":null},{"name":"terminal-tools","requires\_hermes":">=0.9","compatible":null}]

### Plugins in Correct Sections

**Status:** ✅ OK

No memory-provider plugins found in the plugins section

**Evidence:**

- `plugins`: [{"name":"code-assist","is\_memory\_provider":false},{"name":"terminal-tools","is\_memory\_provider":false}]

### No Recent Errors

**Status:** ✅ OK

No errors found in Hermes logs

**Evidence:**

- `error_count`: 0
- `log_file`: <HOME>/logs/hermes.log
- `recent_errors`: []

### No Errors to Classify

**Status:** ✅ OK

No errors found in logs

**Evidence:**

- `error_types`: {"auth":0,"model":0,"mcp":0,"permission":0,"rate\_limit":0,"network":0,"unknown":0}

### Log Files Readable

**Status:** ✅ OK

All 1 log file(s) are readable

**Evidence:**

- `log_files`: [{"path":"<HOME>/logs/hermes.log","readable":true,"size\_bytes":994}]

### No Rate Limit Errors

**Status:** ✅ OK

No rate limit errors (HTTP 429) detected in logs

**Evidence:**

- `error_types`: {"auth":0,"model":0,"mcp":0,"permission":0,"rate\_limit":0,"network":0,"unknown":0}
- `rate_limit_count`: 0

### No Secret Leaks Detected

**Status:** ✅ OK

No API keys, tokens, or secrets found exposed in config or logs

**Evidence:**

- `secret_leaks`: []

### Terminal Backend Sandboxed

**Status:** ✅ OK

Terminal backend "restricted-shell" is sandboxed for security

**Evidence:**

- `terminal_backend`: restricted-shell
- `shell_restricted`: true
- `sandbox_enabled`: true

### Environment Variables Secure

**Status:** ✅ OK

No sensitive environment variables appear to be exposed

**Evidence:**

- `env_exposure`: false

### No Unsafe Dynamic Execution

**Status:** ✅ OK

No eval/exec patterns detected in configuration

**Evidence:**

- `dynamic_exec_blocks`: []

## ℹ️ Info (8)

### System Information

**Status:** ℹ️ Info

OS: linux, Architecture: x64, Node.js: v26.2.0

**Evidence:**

- `os`: linux
- `arch`: x64
- `node`: v26.2.0

### Shell Environment

**Status:** ℹ️ Info

Shell: /bin/bash

**Evidence:**

- `shell`: /bin/bash
- `path`: ["<HOME>/.factory/bin","<HOME>/.local/bin","<HOME>/.local/bin","<HOME>/.local/bin","<HOME>/.nvm/versions/node/v26.2.0/bin","<HOME>/.local/bin","/bin","/usr/bin","/sbin","/usr/sbin","/exe.dev/bin","/usr/local/bin","/snap/bin"]

### Install Method Unknown

**Status:** ℹ️ Info

Could not determine how Hermes was installed

**Evidence:**

- `install_method`: unknown

### Dashboard Uses Plain HTTP

**Status:** ℹ️ Info

Dashboard is served over plain HTTP. Consider enabling HTTPS for production.

**Evidence:**

- `tls`: false

**Fix:**

- **Enable HTTPS**
  ```bash
  Add TLS configuration to config.yaml dashboard section
  ```
  _See documentation for certificate generation_

### No Local Provider Endpoints

**Status:** ℹ️ Info

No local provider endpoints are configured

**Evidence:**

- `local_endpoints`: []

### No MCP Tool Filters

**Status:** ℹ️ Info

No MCP servers have tool filters configured

**Evidence:**

- `servers`: [{"name":"filesystem","tools\_filter":null},{"name":"github","tools\_filter":null}]

### No External Memory Provider

**Status:** ℹ️ Info

No external memory provider (e.g., Pinecone, Chroma) is configured

**Evidence:**

- `external_provider`: null
- `external_ok`: null

### No Large SKILL.md Files

**Status:** ℹ️ Info

All SKILL.md files are within reasonable size limits

**Evidence:**

- `large_files`: []

## ⚠️ Warning (2)

### Malformed API Keys Detected

**Status:** ⚠️ Warning

2 API key(s) have unexpected format: anthropic, openai

**Evidence:**

- `key_checks`: [{"provider":"anthropic","format\_ok":false},{"provider":"openai","format\_ok":false}]

**Fix:**

- **Verify anthropic API key**
  ```bash
  echo "Check if your anthropic API key has the correct format and prefix"
  ```
- **Verify openai API key**
  ```bash
  echo "Check if your openai API key has the correct format and prefix"
  ```

### Broken Skill References Detected

**Status:** ⚠️ Warning

2 broken reference(s) found in SKILL.md files

**Evidence:**

- `broken_refs`: [{"source\_skill":"code-review","referenced\_path":"./config/settings.md","reason":"referenced path does not exist"},{"source\_skill":"shell","referenced\_path":"./docs/usage.md","reason":"referenced path does not exist"}]

**Fix:**

- **Fix broken reference in code-review: ./config/settings.md**
  ```bash
  mkdir -p $(dirname ./config/settings.md)
  ```
  _The referenced path "./config/settings.md" does not exist (reason: referenced path does not exist). Either create the missing file or update the link in SKILL.md._
- **Fix broken reference in shell: ./docs/usage.md**
  ```bash
  mkdir -p $(dirname ./docs/usage.md)
  ```
  _The referenced path "./docs/usage.md" does not exist (reason: referenced path does not exist). Either create the missing file or update the link in SKILL.md._

## ❌ Broken (6)

### Hermes Executable Not Found

**Status:** ❌ Broken

Hermes is not installed or not on PATH

**Evidence:**

- `executable_path`: null
- `on_path`: false

**Fix:**

- **Install Hermes via npm**
  ```bash
  npm install -g @anthropic/hermes
  ```
- **Add to PATH**
  ```bash
  export PATH="$PATH:$(npm bin -g)"
  ```
  _Then run: hermes --version_

### Hermes Version Not Detected

**Status:** ❌ Broken

Could not determine Hermes version. The executable may be missing or broken.

**Fix:**

- **Install Hermes**
  ```bash
  npm install -g @anthropic/hermes
  ```
- **Check installation**
  ```bash
  which hermes && hermes --version
  ```

### Executable Permission Issue

**Status:** ❌ Broken

Hermes executable is not readable or executable by the current user

**Evidence:**

- `permission_ok`: false

**Fix:**

- **Fix permissions**
  ```bash
  chmod +x <hermes-path>
  ```
- **Reinstall Hermes**
  ```bash
  npm install -g @anthropic/hermes
  ```

### Dashboard Unreachable

**Status:** ❌ Broken

Dashboard at http://127.0.0.1:8080 is not reachable

**Evidence:**

- `url`: http://127.0.0.1:8080
- `reachable`: false
- `response_time_ms`: 50

**Fix:**

- **Check if dashboard service is running**
  ```bash
  systemctl status hermes-dashboard || ps aux | grep hermes
  ```
- **Verify dashboard URL**
  ```bash
  curl -sI http://127.0.0.1:8080
  ```

### MCP Environment Variables Missing

**Status:** ❌ Broken

2 environment variable(s) referenced by MCP servers are not set: filesystem:FS_TOKEN, github:GITHUB_TOKEN

**Evidence:**

- `servers`: [{"name":"filesystem","expected\_env":[{"key":"FS\_TOKEN","set":false}]},{"name":"github","expected\_env":[{"key":"GITHUB\_TOKEN","set":false}]}]

**Fix:**

- **Set FS_TOKEN for MCP server filesystem**
  ```bash
  export FS_TOKEN="your-value-here"
  ```
- **Set GITHUB_TOKEN for MCP server github**
  ```bash
  export GITHUB_TOKEN="your-value-here"
  ```

### Unresolved Plugin Dependencies

**Status:** ❌ Broken

2 plugin dependenc(ies) are not resolved

**Evidence:**

- `plugins`: [{"name":"code-assist","dependencies":[{"name":"typescript","version":"^5.7.0","resolved":false},{"name":"eslint","version":"^9.0.0","resolved":false}]},{"name":"terminal-tools","dependencies":[]}]

**Fix:**

- **Install dependency typescript for plugin code-assist**
  ```bash
  npm install typescript@^5.7.0
  ```
- **Install dependency eslint for plugin code-assist**
  ```bash
  npm install eslint@^9.0.0
  ```

## 🔴 Risk (1)

### Overly Permissive File Permissions

**Status:** 🔴 Risk

1 file(s) have overly permissive permissions

**Evidence:**

- `permission_issues`: [{"path":"<HOME>/.env","current\_mode":"644","suggested\_mode":"600"}]

**Fix:**

- **Fix permissions for <HOME>/.env**
  ```bash
  chmod 600 <HOME>/.env
  ```
  _Current mode: 644, suggested: 600_

## Redaction

> ⚠️ This report has been redacted. 0 secret(s) and 17 home path(s) were automatically redacted.

## Privacy

> ✅ This report has been redacted for sharing. All detected secrets have been redacted. No raw API keys, tokens, or passwords appear in this report.
