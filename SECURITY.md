# Hermes Doctor — Security Policy

## Privacy Model

Hermes Doctor is designed with a **defense-in-depth** approach to data privacy. All reports are redacted before they reach any output format — console, Markdown, or JSON. However, **no automated redaction system is infallible**.

> ⚠️ **Reports are redacted but not guaranteed safe.** Review all output before sharing it with anyone outside your organization.

### What Redaction Covers

- **API keys and tokens**: Pattern-matched secrets (OpenAI `sk-*`, Anthropic `sk-ant-*`, GitHub tokens, bearer tokens, etc.) are replaced with `[REDACTED:TYPE]` markers.
- **Home paths**: Local user home paths are normalized to `<HOME>`.
- **Log content**: Log snippets are optional (`--include-log-snippets`) and always redacted.
- **Strict mode**: Use `--strict-redaction` for extra-aggressive redaction of base64 strings and environment variable values.

### Redaction Limitations

- **Undisclosed secret formats**: If a secret uses a pattern not recognized by the redaction engine, it may pass through unredacted.
- **Custom provider keys**: Keys for lesser-known or custom provider formats may not be detected.
- **Embedded secrets in unexpected locations**: Secrets embedded in config keys, plugin metadata, or file paths may evade pattern matching.
- **Flue mode**: When `--flue` is explicitly enabled, report data is sent to a configured LLM provider. Flue is **never** enabled by default.

### Recommendations for Safe Sharing

1. **Always audit reports manually** before sharing externally, especially when sharing Markdown or JSON files that may contain raw diagnostic data.
2. **Use `--strict-redaction`** when generating reports intended for external audiences.
3. **Avoid including `--include-log-snippets`** in reports shared outside your team — log content may contain contextual data beyond what pattern-based redaction can catch.
4. **Prefer Markdown or JSON output** for sharing — these formats are easier to inspect and redact further if needed.
5. **Verify with a second pair of eyes** — have a colleague review reports for any missed sensitive information before publication.

## Reporting Security Issues

If you discover a security vulnerability in Hermes Doctor — including redaction bypass, unintended data exposure, or unsafe default behavior — please report it privately.

- **Do not** file a public GitHub issue for security vulnerabilities.
- **Do not** post sensitive details in public forums, Discord servers, or social media.
- **GitHub Security Advisories** (this repository): [github.com/alias8818/hermes-doctor/security/advisories](https://github.com/alias8818/hermes-doctor/security/advisories)
- **Email** (Hermes Agent ecosystem): [security@factory.ai](mailto:security@factory.ai)

The npm package metadata points at this repository (`alias8818/hermes-doctor`). Use the GitHub advisory flow above for issues in the Doctor CLI itself.

We aim to acknowledge receipt within 48 hours and provide an initial assessment within 5 business days.

### Credential hygiene

Never commit real API keys, OAuth tokens, or webhook secrets to this repository — including under `fixtures/`. If production credentials were ever committed, **revoke and rotate them immediately**; removing files from `main` does not erase git history.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | ✅ Active maintenance |
| Older releases | ❌ No security patches — upgrade to latest |

## Scope

Hermes Doctor is a **local-first diagnostic tool** designed to operate offline with **no outbound internet calls (local diagnostics only)** in default mode. The security model assumes:

- The Hermes home directory being scanned belongs to the user running the tool
- The tool is executed on the user's local machine or a trusted CI environment
- Flue mode is only enabled by explicit user action (`--flue` flag)

## Responsible Disclosure

We encourage responsible disclosure of any security issues. Contributors who follow this policy will be acknowledged in release notes (with permission).

**Last updated:** 2026-06-01
