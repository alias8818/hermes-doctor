# Hermes Doctor — Health Report

_Generated: 2026-05-31T16:12:59.626Z  |  Profile: default_
_Hermes Home: <HOME>/workspace/hermes-doctor/fixtures/hermes-broken-mcp_

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
| ✅ OK | 24 |
| ℹ️ Info | 17 |
| ⚠️ Warnings | 4 |
| ❌ Broken | 6 |
| 🔴 Risks | 2 |
| **Total** | **53** |

## ✅ OK (24)

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

### Default Model Configured

**Status:** ✅ OK

Default model: claude-sonnet-4-20250514

**Evidence:**

- `models_configured`: 1
- `default_model`: claude-sonnet-4-20250514

### Provider Environment Variables Set

**Status:** ✅ OK

All 1 provider(s) have required environment variables

**Evidence:**

- `providers`: [{"name":"openai","required\_env":["OPENAI\_API\_KEY"],"env\_set":true}]

### MCP Servers Configured

**Status:** ✅ OK

3 MCP server(s) configured: database, missing-binary, filesystem

**Evidence:**

- `servers`: ["database","missing-binary","filesystem"]

### MCP Server Transports Valid

**Status:** ✅ OK

All 3 MCP server(s) have recognized transports

**Evidence:**

- `servers`: [{"name":"database","transport":"stdio","transport\_valid":true},{"name":"missing-binary","transport":"stdio","transport\_valid":true},{"name":"filesystem","transport":"stdio","transport\_valid":true}]

### Memory Usage OK

**Status:** ✅ OK

Memory usage at ?% of limit (0 B / 10.0 MB)

**Evidence:**

- `total_size_bytes`: 0
- `limit_bytes`: 10485760
- `usage_percent`: null

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

### No Broken Skill References

**Status:** ✅ OK

All local references in SKILL.md files resolve correctly

**Evidence:**

- `broken_refs`: []

### No Duplicate Skill Names

**Status:** ✅ OK

All skill names are unique

**Evidence:**

- `duplicates`: []

### Plugins in Correct Sections

**Status:** ✅ OK

No memory-provider plugins found in the plugins section

**Evidence:**

- `plugins`: []

### Log Files Readable

**Status:** ✅ OK

All 1 log file(s) are readable

**Evidence:**

- `log_files`: [{"path":"<HOME>/logs/hermes.log","readable":true,"size\_bytes":754}]

### No Rate Limit Errors

**Status:** ✅ OK

No rate limit errors (HTTP 429) detected in logs

**Evidence:**

- `error_types`: {"auth":0,"model":0,"mcp":4,"permission":0,"rate\_limit":0,"network":0,"unknown":0}
- `rate_limit_count`: 0

### No Secret Leaks Detected

**Status:** ✅ OK

No API keys, tokens, or secrets found exposed in config or logs

**Evidence:**

- `secret_leaks`: []

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

## ℹ️ Info (17)

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

- `servers`: [{"name":"database","tools\_filter":null},{"name":"missing-binary","tools\_filter":null},{"name":"filesystem","tools\_filter":null}]

### No Memory Directory

**Status:** ℹ️ Info

Memory directory does not exist yet. Memory files will be created as you use Hermes.

**Evidence:**

- `memory_dir`: <HOME>/memory
- `file_count`: 0
- `readable`: false
- `dir_exists`: false

### No Memory Files to Size

**Status:** ℹ️ Info

No memory files found

**Evidence:**

- `files`: []

### No External Memory Provider

**Status:** ℹ️ Info

No external memory provider (e.g., Pinecone, Chroma) is configured

**Evidence:**

- `external_provider`: null
- `external_ok`: null

### No Skills Found

**Status:** ℹ️ Info

No skill directories found

**Evidence:**

- `skills`: []

### No Large SKILL.md Files

**Status:** ℹ️ Info

All SKILL.md files are within reasonable size limits

**Evidence:**

- `large_files`: []

### No Skills Metadata to Check

**Status:** ℹ️ Info

No skill directories found

**Evidence:**

- `skills`: []

### No Plugins Configured

**Status:** ℹ️ Info

No plugins are configured in config.yaml

**Evidence:**

- `plugins`: []

### No Plugin Manifests

**Status:** ℹ️ Info

No plugin manifests found to validate

**Evidence:**

- `plugins`: []

### No Plugin Dependencies

**Status:** ℹ️ Info

No plugins declare external dependencies

**Evidence:**

- `plugins`: []

### No Plugin Version Requirements

**Status:** ℹ️ Info

No plugins declare Hermes version requirements

**Evidence:**

- `plugins`: []

### No Terminal Backend Configured

**Status:** ℹ️ Info

No shell-based terminal backend is configured

**Evidence:**

- `terminal_backend`: null
- `shell_restricted`: false
- `sandbox_enabled`: false

## ⚠️ Warning (4)

### Missing Configuration Sections

**Status:** ⚠️ Warning

Missing sections: skills, plugins

**Evidence:**

- `sections`: {"providers":true,"mcp":true,"dashboard":true,"memory":true,"skills":false,"plugins":false,"security":false}

**Fix:**

- **Add skills section to config.yaml**
  ```bash
  echo "skills: {}" >> ~/.hermes/config.yaml
  ```

### Malformed API Keys Detected

**Status:** ⚠️ Warning

1 API key(s) have unexpected format: openai

**Evidence:**

- `key_checks`: [{"provider":"openai","format\_ok":false}]

**Fix:**

- **Verify openai API key**
  ```bash
  echo "Check if your openai API key has the correct format and prefix"
  ```

### Recent Errors Found

**Status:** ⚠️ Warning

4 error(s) found in logs. Most recent: 2025-05-30T12:00:02Z ERROR [hermes] 3 of 4 MCP servers failed to start

**Evidence:**

- `error_count`: 4
- `log_file`: <HOME>/logs/hermes.log
- `recent_errors`: [{"timestamp":"2025-05-30T12:00:01Z","message":"2025-05-30T12:00:01Z ERROR [mcp] Failed to start MCP server \"database\": command not found: hermes-mcp-database"},{"timestamp":"2025-05-30T12:00:01Z","message":"2025-05-30T12:00:01Z ERROR [mcp] Failed to start MCP server \"missing-binary\": command not found: definitely-not-a-real-binary-that-exists-xyz"},{"timestamp":"2025-05-30T12:00:01Z","message":"2025-05-30T12:00:01Z ERROR [mcp] Failed to start MCP server \"playground\": command not found: hermes-mcp-playground"},{"timestamp":"2025-05-30T12:00:02Z","message":"2025-05-30T12:00:02Z ERROR [hermes] 3 of 4 MCP servers failed to start"}]

**Fix:**

- **View the full error log**
  ```bash
  less <HOME>/logs/hermes.log
  ```
- **Search for common issues**
  ```bash
  grep -i "error\|fatal\|exception" <HOME>/logs/hermes.log
  ```

### Error Classification

**Status:** ⚠️ Warning

4 error(s) classified: mcp: 4

**Evidence:**

- `error_types`: {"auth":0,"model":0,"mcp":4,"permission":0,"rate\_limit":0,"network":0,"unknown":0}

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
- `response_time_ms`: 40

**Fix:**

- **Check if dashboard service is running**
  ```bash
  systemctl status hermes-dashboard || ps aux | grep hermes
  ```
- **Verify dashboard URL**
  ```bash
  curl -sI http://127.0.0.1:8080
  ```

### MCP Command Executables Missing

**Status:** ❌ Broken

2 MCP server command(s) not found: database (hermes-mcp-database), missing-binary (definitely-not-a-real-binary-that-exists-xyz)

**Evidence:**

- `servers`: [{"name":"database","command":"hermes-mcp-database","executable\_found":false},{"name":"missing-binary","command":"definitely-not-a-real-binary-that-exists-xyz","executable\_found":false},{"name":"filesystem","command":"npx -y @modelcontextprotocol/server-filesystem","executable\_found":true}]

**Fix:**

- **Install or fix path for database**
  ```bash
  which hermes-mcp-database || npm install -g hermes-mcp-database
  ```
- **Install or fix path for missing-binary**
  ```bash
  which definitely-not-a-real-binary-that-exists-xyz || npm install -g definitely-not-a-real-binary-that-exists-xyz
  ```

### MCP Environment Variables Missing

**Status:** ❌ Broken

4 environment variable(s) referenced by MCP servers are not set: database:DB_HOST, database:DB_PORT, database:DB_PASSWORD, filesystem:FS_TOKEN

**Evidence:**

- `servers`: [{"name":"database","expected\_env":[{"key":"DB\_HOST","set":false},{"key":"DB\_PORT","set":false},{"key":"DB\_PASSWORD","set":false}]},{"name":"missing-binary","expected\_env":[]},{"name":"filesystem","expected\_env":[{"key":"FS\_TOKEN","set":false}]}]

**Fix:**

- **Set DB_HOST for MCP server database**
  ```bash
  export DB_HOST="your-value-here"
  ```
- **Set DB_PORT for MCP server database**
  ```bash
  export DB_PORT="your-value-here"
  ```
- **Set DB_PASSWORD for MCP server database**
  ```bash
  export DB_PASSWORD=[REDACTED:PASSWORD]
  ```
- **Set FS_TOKEN for MCP server filesystem**
  ```bash
  export FS_TOKEN="your-value-here"
  ```

## 🔴 Risk (2)

### Dashboard Authentication Disabled

**Status:** 🔴 Risk

Dashboard does not require authentication — sensitive operations may be exposed

**Evidence:**

- `auth_required`: false

**Fix:**

- **Enable dashboard authentication**
  ```bash
  Add auth configuration to config.yaml dashboard section
  ```

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
