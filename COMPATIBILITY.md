# Hermes Doctor — Compatibility Guide

## Node.js

Hermes Doctor requires **Node.js >= 20** (LTS recommended).

| Node.js Version | Support |
|----------------|---------|
| 20.x | ✅ Fully supported (LTS) |
| 22.x | ✅ Fully supported (LTS) |
| 18.x | ❌ Not supported (end-of-life) |
| < 18 | ❌ Not supported |

## Hermes Agent

Hermes Doctor is designed to diagnose **Hermes Agent** installations. The tool is version-agnostic at the scan level — it adapts to whatever Hermes installation it finds.

| Hermes Version | Support |
|----------------|---------|
| 1.x | ✅ Supported (all sub-versions) |
| 0.x | ⚠️ May work but not tested |

Hermes Doctor supports any Hermes Agent installation that follows the standard `~/.hermes` directory layout, including:

- `config.yaml` — Provider and model configuration
- `auth.json` — Authentication and active provider settings
- `mcp_servers.json` / `mcp_servers.yaml` — MCP server configuration
- `memory/` — Memory storage files
- `plugins/` — Plugin manifests
- `logs/` — Diagnostic log files
- `skills/` — Skill definitions
- Dashboard service (local HTTP)

## Package Managers

| Tool | Usage |
|------|-------|
| **pnpm** | Development — required for working on the monorepo (`pnpm install`, `pnpm test`, etc.) |
| **npx** | Ad-hoc usage — `npx hermes-doctor scan` runs without installing |
| **npm** | Install published package — `npm install -g hermes-doctor` |

## Operating Systems

| OS | Status | Notes |
|----|--------|-------|
| **Linux** | ✅ Fully supported | Primary development and testing platform |
| **macOS** | ✅ Fully supported | All features work on macOS (Darwin) |
| **Windows** | ⚠️ Community support | Core diagnostics work; some path auto-detection for Windows-specific install paths may be limited |

### Platform-Specific Considerations

- **Linux**: Full support. All 11 diagnostic areas are tested against Linux fixtures.
- **macOS**: Full support. PATH resolution, shell detection, and home directory handling work identically to Linux.
- **Windows**: Hermes Doctor uses Node.js cross-platform APIs. File system operations, path resolution, and environment variable handling work on Windows. Some features like shell detection and `PATH` resolution may behave differently on Windows vs Unix. Windows installer path auto-detection is planned for a future release.

## Output Formats

| Format | Compatibility |
|--------|---------------|
| Console (colored) | All terminals with ANSI color support |
| Markdown | GitHub, GitLab, Discord, most Markdown renderers |
| JSON | Any JSON parser; validates against the DoctorReport schema |

## Dependencies

Hermes Doctor is a **zero-runtime-dependency** tool (beyond Node.js itself) in default mode:

- Default scan (`--no-flue`): No runtime dependencies — all checks are self-contained
- Flue-enriched scan (`--flue`): Requires `@flue/runtime` (optional peer dependency) and a valid `FLUE_API_KEY` environment variable

**Last updated:** 2026-06-01
