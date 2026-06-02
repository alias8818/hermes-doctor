# Final Security Review — v0.1.0-rc.1

**Generated:** 2026-06-01  
**Review type:** Repo-wide static analysis  
**Scope:** All committed source, docs, and configuration files

## Summary

**Verdict: CLEAN** — No raw secrets, no hardcoded credentials, no exposed keys in committed files. All findings are expected artifacts (redaction patterns, test fixtures, placeholder values).

## Secret Pattern Scan

| Pattern | Matches | Verdict |
|---------|---------|---------|
| `sk-` (OpenAI keys) | Source: redaction patterns, test fixtures, KNOWN_PROVIDERS list | EXPECTED |
| `sk-ant-` (Anthropic keys) | Source: redaction patterns, test fixtures | EXPECTED |
| `ghp_` (GitHub tokens) | `reports/REDTEAM_REDACTION.md`, test fixtures, memory check | EXPECTED |
| `github_pat_` | `reports/REDTEAM_REDACTION.md`, redaction patterns | EXPECTED |
| `xoxb-` (Slack tokens) | `reports/REDTEAM_REDACTION.md`, memory check, redaction tests | EXPECTED |
| `Bearer` tokens | Redaction test fixtures only | EXPECTED |
| `BEGIN.*PRIVATE KEY` | `reports/REDTEAM_REDACTION.md`, wiki docs (reference tables) | EXPECTED |
| `exe1.` (exe.dev tokens) | No matches | CLEAN |
| `hooks.slack.com` | `reports/REDTEAM_REDACTION.md`, wiki docs (reference) | EXPECTED |
| `discord.com/api/webhooks` | `reports/REDTEAM_REDACTION.md`, redaction patterns, wiki | EXPECTED |

All documentation references use abbreviated placeholder formats:
- `<FAKE_OPENAI_KEY>`, `<FAKE_ANTHROPIC_KEY>`, `<FAKE_GITHUB_TOKEN>`, `<FAKE_SLACK_TOKEN>`
- `sk-test-...example` — clearly abbreviated, not real-length

## Documentation Claims Audit

| Claim Area | Old Wording | New Wording | Status |
|-----------|-------------|-------------|--------|
| Report safety | "safe to share" | "redacted for sharing" | ✅ Fixed |
| Network | "zero network calls" | "no outbound internet calls (local diagnostics only)" | ✅ Fixed |
| Schema field | `safeToShare` | `redactedForSharing` | ✅ Fixed |
| Flue status | — | "experimental", "optional" | ✅ Accurate |
| Privacy model | absolute claims | qualified, limitations documented | ✅ Fixed |

## Redaction Coverage

The Doctor redacts 15+ secret patterns across all reports:
- OpenAI, Anthropic, Google, Groq, Mistral, Cohere keys
- GitHub tokens (classic + fine-grained)
- Slack bot tokens, Discord webhooks
- SSH private keys, JWT tokens
- Bearer tokens, generic API keys

**Known gaps** (documented in SECURITY.md):
- Custom/undisclosed secret formats pass through uncaught
- Embedded secrets in binary or encoded files
- Flue mode sends redacted report content to LLM API

## Authentication & Secrets Management

- **API keys**: Read from environment variables only (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.)
- **auth.json**: Parsed for `active_provider` field; all credential fields redacted
- **Flue**: Requires `FLUE_API_KEY` env var; degrades gracefully without
- **No hardcoded credentials** in any source file

## Supply Chain

| Dependency | Purpose | Risk |
|-----------|---------|------|
| `commander` | CLI argument parsing | Low |
| `picocolors` | Terminal coloring | Low |
| `valibot` | Schema validation | Low |
| `execa` | Process execution | Low |
| `fast-glob` | File matching | Low |
| `yaml` | YAML parsing | Low |
| `@flue/runtime` | LLM integration (optional peer) | Low (externalized) |

All dependencies are well-known, actively maintained packages.

## Recommendations

1. **Pre-publish**: Run `npm audit` before publishing to npm
2. **CI**: Add `npm audit --audit-level=high` to CI workflow (P2)
3. **User guidance**: SECURITY.md already advises users to review reports before sharing
4. **Future**: Consider structural redaction (not just regex-based) for custom provider key formats
