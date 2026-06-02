# Hermes Doctor

**Local-first diagnostic CLI for [Hermes Agent](https://github.com/FactoryAI/hermes).**

Scan your Hermes home (`~/.hermes`): install, config, dashboard, providers, MCP servers, memory, skills, plugins, logs, and security. Get a **redacted**, evidence-backed health report with copy-paste fix commands.

- **Offline by default** — no API key, no outbound network (localhost dashboard probe only)
- **55+ deterministic checks** across 11 areas
- **Console, Markdown, and JSON** output
- **Optional [Flue](https://flue.dev) AI explanations** with `--flue`

```bash
npx hermes-doctor scan
```

Full documentation, development setup, and architecture: [github.com/alias8818/hermes-doctor](https://github.com/alias8818/hermes-doctor)

## Install

```bash
# Run once (no install)
npx hermes-doctor scan

# Global install
npm install -g hermes-doctor
hermes-doctor scan
```

**Requirements:** Node.js **20+** (Node 22 LTS recommended for development tooling).

## Quick start

```bash
# Default: scan ~/.hermes, print colored report
hermes-doctor scan

# Custom Hermes home
hermes-doctor scan --hermes-home /path/to/.hermes

# Write markdown + JSON reports to a folder
hermes-doctor scan --format markdown --format json --output ./report

# Show resolved paths without scanning
hermes-doctor paths
```

Reports are **redacted for sharing** — secrets are replaced with `[REDACTED:TYPE]` before output.

## What it checks

| Area | Examples |
|------|----------|
| **System** | OS, Node version, PATH, Docker, Git |
| **Install** | Hermes binary, version, permissions |
| **Config** | YAML validity, profiles, schema alignment with Hermes |
| **Dashboard** | Bind address, localhost vs public, auth |
| **Providers** | Env vars, API key shapes, auth.json, custom providers |
| **MCP** | Server commands on PATH, transport config |
| **Memory** | Size limits, readability, huge files |
| **Skills** | SKILL.md structure, broken references |
| **Plugins** | Manifests, dependencies |
| **Logs** | Errors, optional redacted snippets |
| **Security** | Secret leaks, sandbox, public binding |

## CLI reference

### Commands

| Command | Description |
|---------|-------------|
| `scan` | Run a full health scan |
| `export` | Re-export the last scan (`export --last`) |
| `paths` | Print detected Hermes paths |
| `version` | Print version |

### Common `scan` options

| Option | Description |
|--------|-------------|
| `--hermes-home <path>` | Hermes directory (default: `$HERMES_HOME` or `~/.hermes`) |
| `--profile <name>` | Config profile (default: `default`) |
| `--format console\|markdown\|json` | Output format (repeatable) |
| `--output <dir>` | Write report files to this directory |
| `--verbose` | Extra diagnostic detail |
| `--include-log-snippets` | Include redacted log excerpts |
| `--max-log-lines <n>` | Cap lines read per log file (default: `500`) |
| `--strict-redaction` | Aggressive redaction (base64, secret-like env values) |
| `--flue` | Optional AI explanations (requires `FLUE_API_KEY` + `@flue/runtime`) |
| `--no-flue` | Force deterministic output |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Scan finished (findings may be present) |
| `1` | Tool failure (bad args, I/O error, crash) |

## Privacy

| Mode | Network | Data leaves machine? |
|------|---------|----------------------|
| Default `scan` | No outbound internet; optional `127.0.0.1` dashboard probe | No |
| `--flue` | Calls your configured LLM provider | Yes — redacted report only |

Redaction runs at collection and again on every renderer. Use `--strict-redaction` before posting reports publicly.

## Optional: Flue enrichment

```bash
npm install @flue/runtime   # optional peer
export FLUE_API_KEY="your-key"
hermes-doctor scan --flue
```

Without `@flue/runtime` or an API key, Doctor still completes the scan and warns that Flue is unavailable.

## Changelog

### 0.1.2

- CI and release workflow fixes (pnpm, CodeQL config, TruffleHog, Scorecard)
- Hardened strict redaction regex (ReDoS-safe)
- Improved markdown escaping for report output
- npm package metadata: MIT license, keywords, repository links

### 0.1.1

- Hermes v0.15.2 schema alignment (providers, MCP, dashboard, terminal, skills)
- README included in published package

### 0.1.0

- Initial public release: 55+ checks, three output formats, offline-first scans

## Contributing & issues

- **Source:** [github.com/alias8818/hermes-doctor](https://github.com/alias8818/hermes-doctor)
- **Bugs & features:** [GitHub Issues](https://github.com/alias8818/hermes-doctor/issues)
- **Security:** see [SECURITY.md](https://github.com/alias8818/hermes-doctor/blob/main/SECURITY.md) in the repo

## License

MIT — see [LICENSE](./LICENSE).
