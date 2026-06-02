# Hermes Doctor — Health Report

_Generated: 2026-05-31T16:12:55.052Z  |  Profile: default_
_Hermes Home: <HOME>/workspace/hermes-doctor/fixtures/validation/provider/missing-api-key_

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
| ✅ OK | 23 |
| ℹ️ Info | 26 |
| ❌ Broken | 4 |
| **Total** | **53** |

## ✅ OK (23)

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

- `sections`: {"providers":true,"mcp":true,"dashboard":false,"memory":true,"skills":true,"plugins":true,"security":false}

### Config Schema Conformant

**Status:** ✅ OK

Configuration follows the expected schema

**Evidence:**

- `schema_errors`: []

### Default Model Configured

**Status:** ✅ OK

Default model: claude-opus-4-20250514

**Evidence:**

- `models_configured`: 2
- `default_model`: claude-opus-4-20250514

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

### No Log File

**Status:** ✅ OK

No Hermes log file was found

**Evidence:**

- `error_count`: 0
- `log_file`: null
- `recent_errors`: []

### No Errors to Classify

**Status:** ✅ OK

No errors found in logs

**Evidence:**

- `error_types`: {"auth":0,"model":0,"mcp":0,"permission":0,"rate\_limit":0,"network":0,"unknown":0}

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

### File Permissions OK

**Status:** ✅ OK

No overly permissive file permissions detected

**Evidence:**

- `permission_issues`: []

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

## ℹ️ Info (26)

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

### No Dashboard Configured

**Status:** ℹ️ Info

No dashboard URL is configured

**Evidence:**

- `url`: null
- `reachable`: false

### Dashboard Binding Unknown

**Status:** ℹ️ Info

No binding information available for the dashboard

**Evidence:**

- `bind_address`: null
- `is_localhost`: false

### No Dashboard Configured

**Status:** ℹ️ Info

No dashboard is configured, so authentication is not applicable

**Evidence:**

- `auth_required`: false

### No Dashboard Configured

**Status:** ℹ️ Info

No TLS check needed (no dashboard configured)

**Evidence:**

- `tls`: false

### No Local Provider Endpoints

**Status:** ℹ️ Info

No local provider endpoints are configured

**Evidence:**

- `local_endpoints`: []

### No API Key Format Checks

**Status:** ℹ️ Info

No API keys to validate format for

**Evidence:**

- `key_checks`: []

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

### No Log Files

**Status:** ℹ️ Info

No Hermes log files found

**Evidence:**

- `log_files`: []

### No Terminal Backend Configured

**Status:** ℹ️ Info

No shell-based terminal backend is configured

**Evidence:**

- `terminal_backend`: null
- `shell_restricted`: false
- `sandbox_enabled`: false

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

### Missing Provider Environment Variables

**Status:** ❌ Broken

2 provider(s) missing required environment variables: anthropic, openai

**Evidence:**

- `providers`: [{"name":"anthropic","required\_env":["ANTHROPIC\_API\_KEY"],"env\_set":false},{"name":"openai","required\_env":["OPENAI\_API\_KEY"],"env\_set":false}]

**Fix:**

- **Set anthropic environment variables**
  ```bash
  export ANTHROPIC_API_KEY="your-key-here"
  ```
  _Add ANTHROPIC_API_KEY to your shell profile or .env file_
- **Set openai environment variables**
  ```bash
  export OPENAI_API_KEY="your-key-here"
  ```
  _Add OPENAI_API_KEY to your shell profile or .env file_

## Redaction

> ⚠️ This report has been redacted. 0 secret(s) and 16 home path(s) were automatically redacted.

## Privacy

> ✅ This report has been redacted for sharing. All detected secrets have been redacted. No raw API keys, tokens, or passwords appear in this report.
