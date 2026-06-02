# Hermes Doctor Changelog

## 1.0.0 — 2026-06-02

> **Local-first diagnostic CLI for Hermes Agent.** Hermes Doctor scans your Hermes Agent installation, configuration, providers, MCP servers, memory, skills, plugins, logs, and security posture, then delivers a deterministic, evidence-backed health report with actionable fix commands. It runs entirely offline with no API key required. An optional Flue integration can enrich reports with AI explanations when you explicitly pass `--flue`.

### GitHub Release

```markdown
## Hermes Doctor v1.0.0

Local-first diagnostic CLI for Hermes Agent — now ready for general use.

**11 diagnostic areas, 57 deterministic checks.** System, install, config, dashboard,
providers, MCP, memory, skills, plugins, logs, security. Every check is pass/fail/warn
with structured evidence and copy-pasteable fix commands.

**Three output formats:** colored console, GitHub/Discord-friendly markdown, and
schema-validated JSON. All formats apply a defense-in-depth redaction pass.

**Privacy first:** No outbound network calls in default mode. Dashboard probes only
127.0.0.1. All secrets are automatically detected and replaced with `[REDACTED:TYPE]`
at collection time, and a second redaction pass runs on every output format.

**Configurable thresholds:** New flags for memory warnings, file sizes, crash loop
detection, and dashboard timeouts — tune diagnostics to your environment.

**Quick start:**

```bash
npx hermes-doctor scan
```

Full docs, known limitations, and feature details in CHANGELOG.md.
```

---

### What is Hermes Doctor?

Hermes Agent is a local-first AI agent that runs on your machine, connects to LLM providers, reads and writes memory files, runs skills and plugins, manages MCP (Model Context Protocol) servers, and exposes a dashboard. Hermes Doctor is the diagnostics tool that tells you whether all of those parts are working correctly, and if not, what to do about it.

It's designed for:

- **End users** who want to verify their Hermes Agent installation is healthy
- **Developers** building skills, plugins, or providers who need to debug configuration issues
- **CI pipelines** that want to validate Hermes deployments before promoting them

Every check is deterministic, read-only, and never modifies your Hermes files.

### 11 Diagnostic Areas (57 Checks)

| Area | Checks | What's Checked |
|------|--------|----------------|
| **System** | 4 | OS, architecture, Node version, shell, PATH, Docker, Git availability |
| **Install** | 4 | Hermes executable presence, PATH, version, install method, file permissions |
| **Config** | 5 | Hermes home directory, config.yaml parseability, profiles, required sections, schema conformance |
| **Dashboard** | 4 | URL reachability (localhost only), bind address, authentication, TLS certificate |
| **Providers** | 7 | Default model, environment variables, local endpoint health, API key format, custom provider base URLs, auth.json conflicts, orphaned model references |
| **MCP** | 5 | Server configurations, command executables, environment variables, tool filters, transport validity |
| **Memory** | 8 | Directory existence, file count and sizes, usage limits, external providers, secrets in memory files, huge file detection, duplicate provider config, misconfigured sections |
| **Skills** | 5 | SKILL.md presence, broken references, duplicate skill names, large file detection, metadata |
| **Plugins** | 6 | Plugin paths and existence, manifest parseability, dependency resolution, version compatibility, misconfigured sections, hooks configuration |
| **Logs** | 4 | Recent error summary, error type classification, file readability, rate limit detection |
| **Security** | 5 | Secret leak detection, terminal backend sandboxing, file permissions, environment variable exposure, unsafe dynamic execution |

### Three Output Formats

1. **Console** (`--format console`, the default) — Colored terminal output with severity badges, grouped findings, and expandable evidence. Uses `picocolors` for cross-platform ANSI support.

2. **Markdown** (`--format markdown`) — GitHub/Discord-friendly markdown with tables, code blocks, emoji severity indicators, and a privacy section. Ideal for sharing in issues or pull requests.

3. **JSON** (`--format json`) — Schema-validated JSON (`DoctorReportSchema` via Valibot) with full structured data. Includes `"redactedForSharing": true` metadata. Suitable for CI pipelines and programmatic consumption.

You can specify multiple formats simultaneously:
```bash
npx hermes-doctor scan --format markdown --format json --output ./report
```

### Redaction System

Hermes Doctor uses a defense-in-depth redaction architecture. Secrets are caught at two stages:

1. **Collection boundary** — When collectors read data from disk, any detected secrets are immediately replaced with `[REDACTED:TYPE]` placeholders.
2. **Render boundary** — Every output format (console, markdown, JSON) applies a final `redactDeep()` pass before writing output.

**Supported pattern types:**

- Anthropic API keys (`sk-ant-...`)
- OpenAI API keys (`sk-...`)
- GitHub tokens (`ghp_`, `gho_`, `ghs_`, `ghr_`, `github_pat_`)
- Slack tokens (`xoxb-`, `xoxp-`, etc.)
- Telegram bot tokens
- Bearer tokens and Authorization headers
- SSH private keys (`-----BEGIN * PRIVATE KEY-----`)
- Webhook URLs (Slack, Discord)
- URL-embedded credentials (`scheme://user:password@host`)
- Generic `PASSWORD` environment variables
- Custom API keys matching `prefix_randomstring` formats (any provider)
- Home directory paths (normalized to `<HOME>`)

**Strict mode** (`--strict-redaction`) adds additional patterns:
- Base64-encoded strings (44+ characters)
- Any value assigned to a variable whose name contains `SECRET`, `TOKEN`, `KEY`, `CREDENTIAL`, `PASS`, `SALT`, or `AUTH`

Console output shows a redaction summary footer. Markdown output includes a dedicated Privacy section. JSON output sets `redactedForSharing: true`.

### CLI Reference

**Commands:**

| Command | Description |
|---------|-------------|
| `scan` | Run a full health scan |
| `export` | Re-export the most recent scan report |
| `paths` | Print detected Hermes paths |
| `version` | Print version number |
| `--help` / `-h` | Print help information |

**Scan options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--hermes-home <path>` | Path to Hermes home directory | `$HERMES_HOME` or `~/.hermes` |
| `--profile <name>` | Hermes profile to scan | `default` |
| `--format <format>` | Output format (`console`, `markdown`, `json`). Repeatable. | `console` |
| `--output <dir>` | Directory to write report files | stdout |
| `--verbose` | Include extra diagnostic detail in output | `false` |
| `--flue` | Enable Flue AI enrichment | `false` |
| `--no-flue` | Explicitly disable Flue | default |
| `--include-log-snippets` | Include redacted log excerpts in the report | `false` |
| `--max-log-lines <n>` | Maximum lines to read per log file | `500` |
| `--strict-redaction` | Enable extra-aggressive redation (base64, env values) | `false` |

**Threshold flags (new in 1.0.0):**

| Option | Description | Default |
|--------|-------------|---------|
| `--memory-warn-threshold <percent>` | Memory usage warning threshold | `80` |
| `--memory-critical-threshold <percent>` | Memory usage critical threshold | `100` |
| `--huge-file-threshold <mb>` | File size above which a memory file is "huge" | `100` MB |
| `--crash-loop-error-threshold <count>` | Total error count for crash loop detection | `50` |
| `--crash-loop-recent-threshold <count>` | Recent error count for crash loop detection | `20` |
| `--dashboard-timeout <ms>` | Dashboard probe timeout in milliseconds | `1500` |
| `--large-file-threshold <kb>` | File size above which a memory file is "large" | `256` KB |
| `--skills-large-file-threshold <kb>` | File size above which a SKILL.md is "large" | `512` KB |

**Exit codes:**

| Code | Meaning |
|------|---------|
| `0` | Scan completed successfully (even with findings) |
| `1` | Tool or runtime failure (invalid args, write error, crash) |
| `2` | Reserved for future `--fail-on-risk` mode |

### Known Limitations

- **Dashboard probe is localhost-only.** The dashboard collector probes `127.0.0.1` only. Remote dashboard URLs are detected but not contacted. This is by design for privacy, but means remote dashboard instances won't be fully checked.
- **Threshold defaults may not fit all environments.** Default thresholds (memory warnings at 80%, crash loops at 50 errors, etc.) are reasonable for typical setups but may need tuning for heavily customized Hermes installations. Use the threshold flags to adjust.
- **API key format validation is best-effort.** Unknown or custom API key formats may pass through undetected. The generic `prefix_randomstring` pattern catches many custom formats, but not all. Use `--strict-redaction` for additional coverage.
- **Log error classification uses string matching.** Error types are categorized via simple string matching on log messages, which can misidentify error types. This is noted as a known issue and will be improved in a future release.
- **Flue integration is optional and experimental.** The `--flue` flag requires the `@flue/runtime` package and an LLM API key. Without these, it degrades gracefully to deterministic mode.
- **No CI exit code differentiation.** Exit code `0` is always returned on successful scans regardless of findings. Exit code `2` for risk detection is reserved for a future release.
- **macOS and Windows auto-detection is partial.** Hermes home auto-detection (`~/.hermes`) works on all platforms, but system-level install paths on macOS and Windows may not be detected automatically.

### Installation

**Prerequisites:** Node.js >= 20

```bash
# Run without installing
npx hermes-doctor scan

# Or install globally
npm install -g hermes-doctor
hermes-doctor scan

# Or with pnpm
pnpm add -g hermes-doctor
```

### Architecture Overview

```
Hermes Home (~/.hermes)
    |
    v
+-----------------+
|   Collectors    |  Read-only, timeout-bounded, redacted at boundary
+--------+--------+
         |
         v
+-----------------+
| HermesSnapshot  |  Typed, validated, redacted intermediate
+--------+--------+
         |
         v
+-----------------+
|     Checks      |  57 deterministic pass/fail/warn
+--------+--------+
         |
         v
+-----------------+
|  Report Builder |  Summary counts, severity mapping
+--------+--------+
         |
     +---+----+
     |        |
   --flue  --no-flue
     |        |
     v        v
+----------------------+
|    Renderers         |  Final redaction pass
| console | md | json  |
+----------------------+
```
