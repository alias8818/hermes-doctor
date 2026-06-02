# Hermes Doctor — Health Report

_Generated: 2026-05-31T16:13:03.656Z  |  Profile: default_
_Hermes Home: <HOME>/workspace/hermes-doctor/fixtures/hermes-risky-dashboard_

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
| ✅ OK | 26 |
| ℹ️ Info | 18 |
| ⚠️ Warnings | 1 |
| ❌ Broken | 4 |
| 🔴 Risks | 4 |
| **Total** | **53** |

## ✅ OK (26)

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

- `providers`: [{"name":"anthropic","required\_env":["ANTHROPIC\_API\_KEY"],"env\_set":true}]

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

### All Skills Have SKILL.md

**Status:** ✅ OK

All 1 skill(s) have SKILL.md files

**Evidence:**

- `skills`: [{"dir":"<HOME>/skills/admin","has\_skill\_md":true}]

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

### Skill Metadata Complete

**Status:** ✅ OK

All 1 skill(s) have complete metadata

**Evidence:**

- `skills`: [{"name":"admin","metadata\_complete":true,"missing\_fields":[]}]

### Plugins in Correct Sections

**Status:** ✅ OK

No memory-provider plugins found in the plugins section

**Evidence:**

- `plugins`: [{"name":"risky-plugin","is\_memory\_provider":false}]

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

- `log_files`: [{"path":"<HOME>/logs/hermes.log","readable":true,"size\_bytes":556}]

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

## ℹ️ Info (18)

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

### Dashboard Not Probed (Remote URL)

**Status:** ℹ️ Info

Dashboard at http://0.0.0.0:8080 was not probed (remote URL; only localhost is probed)

**Evidence:**

- `url`: http://0.0.0.0:8080
- `reachable`: false

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

### No MCP Servers Configured

**Status:** ℹ️ Info

No MCP servers are configured. This is fine if you don't use MCP tools.

**Evidence:**

- `servers`: []

### No MCP Commands to Check

**Status:** ℹ️ Info

No MCP servers configured

**Evidence:**

- `servers`: []

### No MCP Environment Variables Expected

**Status:** ℹ️ Info

No MCP servers reference environment variables

**Evidence:**

- `servers`: []

### No MCP Tool Filters

**Status:** ℹ️ Info

No MCP servers configured

**Evidence:**

- `servers`: []

### No MCP Transports to Validate

**Status:** ℹ️ Info

No MCP servers configured

**Evidence:**

- `servers`: []

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

### No Large SKILL.md Files

**Status:** ℹ️ Info

All SKILL.md files are within reasonable size limits

**Evidence:**

- `large_files`: []

### No Plugin Manifests

**Status:** ℹ️ Info

No plugin manifests found to validate

**Evidence:**

- `plugins`: [{"name":"risky-plugin","manifest\_found":false,"manifest\_valid":false,"parse\_error":null}]

### No Plugin Dependencies

**Status:** ℹ️ Info

No plugins declare external dependencies

**Evidence:**

- `plugins`: [{"name":"risky-plugin","dependencies":[]}]

### No Plugin Version Requirements

**Status:** ℹ️ Info

No plugins declare Hermes version requirements

**Evidence:**

- `plugins`: [{"name":"risky-plugin","requires\_hermes":null,"compatible":null}]

## ⚠️ Warning (1)

### Malformed API Keys Detected

**Status:** ⚠️ Warning

1 API key(s) have unexpected format: anthropic

**Evidence:**

- `key_checks`: [{"provider":"anthropic","format\_ok":false}]

**Fix:**

- **Verify anthropic API key**
  ```bash
  echo "Check if your anthropic API key has the correct format and prefix"
  ```

## ❌ Broken (4)

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

### Plugin Paths Missing

**Status:** ❌ Broken

1 enabled plugin(s) are missing on disk: risky-plugin

**Evidence:**

- `plugins`: [{"name":"risky-plugin","path":"/tmp/risky-plugin","enabled":true,"exists":false}]

**Fix:**

- **Install plugin risky-plugin**
  ```bash
  mkdir -p /tmp/risky-plugin
  ```
  _Plugin "risky-plugin" is enabled in config.yaml but its directory does not exist at /tmp/risky-plugin. Create the directory or install the plugin package._

## 🔴 Risk (4)

### Dashboard Bound to All Interfaces

**Status:** 🔴 Risk

Dashboard is bound to 0.0.0.0, which exposes it to the network

**Evidence:**

- `bind_address`: 0.0.0.0
- `is_localhost`: false

**Fix:**

- **Bind dashboard to localhost only**
  ```bash
  Change bind address to 127.0.0.1 in config.yaml
  ```
  _dashboard:
  bind: 127.0.0.1_

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

### Unrestricted Terminal Backend

**Status:** 🔴 Risk

Terminal backend "unbounded-shell" has no sandbox or command restrictions — potential command injection risk

**Evidence:**

- `terminal_backend`: unbounded-shell
- `shell_restricted`: false
- `sandbox_enabled`: false

**Fix:**

- **Restrict shell access**
  ```bash
  Configure restricted commands and enable sandbox in the security section of config.yaml
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

> ⚠️ This report has been redacted. 0 secret(s) and 16 home path(s) were automatically redacted.

## Privacy

> ✅ This report has been redacted for sharing. All detected secrets have been redacted. No raw API keys, tokens, or passwords appear in this report.
