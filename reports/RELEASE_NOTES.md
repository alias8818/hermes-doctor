## v0.1.2 — Release hygiene & npm metadata

**Release date:** 2026-06-01  
**Release type:** Patch release  

### Overview

Workflow and security-hardening release. CI, CodeQL, TruffleHog, and Scorecard pipelines are green. npm package now includes MIT license, keywords, repository links, and an npm-oriented README.

### Changes

- Fix CI pnpm version conflict; CodeQL path filters; ReDoS-safe strict redaction
- Fix TruffleHog duplicate `--fail` flag; pin Scorecard action to v2.4.3
- npm: `license`, `repository`, `homepage`, `bugs`, `keywords`, `engines`

---

## v0.1.1 — Schema Compatibility Fixes

**Release date:** 2026-06-01  
**Release type:** Patch Release  
**Target audience:** All users of v0.1.0  

### Overview

v0.1.1 is a targeted schema compatibility fix. Seven Hermes config schema mismatches were discovered during production testing against Hermes v0.15.2, all resolved. This release aligns Doctor's config read paths with the actual Hermes schema, eliminating false positives and blind spots that affected provider, MCP, dashboard, terminal, and skills detection.

### Fixes

1. **Custom providers not detected** — Doctor now reads the `custom_providers` array instead of the nonexistent `model.providers` key.
2. **Default model not detected** — Doctor now reads `model.default.model` instead of treating `model.default` as a string.
3. **Dashboard binding not detected** — Doctor now reads `display.platforms.api_server` instead of `dashboard.enabled` + `dashboard.port`.
4. **MCP servers not detected** — Doctor now reads the top-level `mcp_servers` key instead of `mcp.servers`.
5. **Terminal backend not detected** — Doctor now reads the top-level `terminal.backend` key.
6. **Bogus auth.json provider conflict false positives** — Doctor no longer cross-references `auth.json` `active_provider` with model providers.
7. **Skills metadata false positives** — Doctor no longer requires YAML front matter in SKILL.md files; only a `# Title` heading is required.

### Verification

- **909 tests pass** (full test suite, Node 20/22)
- **Verified against live production** at hermes-ai.exe.xyz
- **Verified against fresh Hermes install** (Hermes v0.15.2)

---

# Release Notes — v0.1.0-rc.1

**Release date:** 2026-06-01  
**Release type:** Release Candidate (limited beta)  
**Target audience:** Hermes/Flue test group (3-5 users)

## Overview

Hermes Doctor is a local, deterministic diagnostic CLI for Hermes Agent. It scans your Hermes installation — config, providers, MCP servers, memory, skills, plugins, logs, dashboard, and security posture — and generates a redacted-for-sharing health report.

This is the first public release candidate.

## Quick Start

```bash
# Install
npm install -g hermes-doctor

# Or run without installing
npx hermes-doctor

# Or from source
git clone https://github.com/exedev/hermes-doctor.git
cd hermes-doctor && pnpm install && pnpm build
node packages/cli/dist/index.js
```

## What's New

### Diagnostics (55+ checks across 11 areas)
- **Install**: Hermes binary presence, version, permissions
- **Config**: Config file validity, structure, schema
- **Providers**: API keys, key formats, custom endpoints, auth conflicts, orphaned model references
- **MCP Servers**: Command availability, env vars, transports, tool filters
- **Memory**: Size limits, file permissions, secret detection, content analysis
- **Skills & Plugins**: SKILL.md presence, references, duplicates, manifests
- **Dashboard**: Binding, reachability, auth, TLS configuration
- **Security**: File permissions, secret leaks, public exposure, env exposure
- **Logs**: Error classification, rate limits, readability

### Report Formats
- **Console**: ANSI-colored human-readable output
- **Markdown**: GitHub/Discord-friendly with tables
- **JSON**: Structured data for automation

### Redaction
All reports are redacted for sharing — API keys, tokens, and secrets are replaced with `[REDACTED:TYPE]` markers. Paths are normalized (home directories → `<HOME>`).

### Experimental Flue Insights
Optional AI-enhanced findings summary via the `--flue` flag. Requires `@flue/runtime` and a `FLUE_API_KEY`. Falls back to deterministic mode gracefully if unavailable.

### Severity Levels
| Level | Meaning |
|-------|---------|
| OK (0) | No issues |
| Info (1) | Informational |
| Warning (2) | Best practice concern |
| Broken (3) | Service-inoperable configuration |
| Critical/Risk (4) | Security or privacy risk |

### Fix Actions
Every finding includes actionable fix guidance with risk levels, confirmation requirements, manual steps, and rollback instructions where applicable.

## Requirements

- **Node.js**: >= 20 (LTS)
- **Hermes Agent**: 1.x (0.x may work, not tested)
- **Platform**: Linux, macOS (Windows community support)

## Known Limitations

See [KNOWN_LIMITATIONS.md](reports/KNOWN_LIMITATIONS.md) for a complete list. Key items:

- **Malformed fallback provider config** — not detected
- **Auxiliary provider validation** — partially implemented
- **Redaction is regex-based** — unknown secret formats may pass through
- **No network isolation guarantee** — localhost diagnostics probe configured endpoints

## What's Changed Since Pre-Release

This release candidate includes a comprehensive hardening pass:

- **Packaging**: Single-file bundled CLI for `npx hermes-doctor`
- **Wording**: All "safe to share" claims replaced with honest "redacted for sharing"
- **Provider Checks**: 3 new checks (custom base_url, auth.json conflicts, orphaned models)
- **MCP Fix**: Remote-only servers no longer flagged for missing executables
- **Severity Calibration**: 6 corrections for accurate severity assignment
- **Structured Evidence**: Label, detail, source, confidence, redacted fields
- **Flue Insights**: Real LLM workflow with finding filtering and graceful degradation
- **FixAction Safety**: Risk levels, confirmation gates, manual steps, rollbacks
- **CLI**: Bare invocation scans by default
- **Docs**: SECURITY.md, COMPATIBILITY.md, VALIDATION_STATUS.md
- **CI**: GitHub Actions with Node 20/22 matrix

## Feedback

This is a release candidate. Please report issues via GitHub Issues.

When sharing reports, remember: reports are redacted but not guaranteed safe. Review before sharing externally.
