export type RedactionPatternType =
  | "anthropic_key"
  | "openai_key"
  | "github_token"
  | "slack_token"
  | "telegram_token"
  | "bearer_token"
  | "auth_header"
  | "ssh_private_key"
  | "webhook_token"
  | "password"
  | "base64_string"
  | "env_var_value"
  | "strict_pattern";

export interface RedactionPattern {
  type: RedactionPatternType;
  regex: RegExp;
  replacement: string;
}

const SSH_PRIVATE_KEY =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;

export const REDACTION_PATTERNS: RedactionPattern[] = [
  {
    type: "ssh_private_key",
    regex: SSH_PRIVATE_KEY,
    replacement: "[REDACTED:SSH_PRIVATE_KEY]",
  },
  {
    type: "webhook_token",
    regex: /https?:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g,
    replacement: "https://hooks.slack.com/[REDACTED:WEBHOOK_TOKEN]",
  },
  {
    type: "webhook_token",
    regex: /https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+/g,
    replacement: "https://discord.com/api/webhooks/[REDACTED:WEBHOOK_TOKEN]",
  },
  {
    type: "webhook_token",
    regex: /([?&](?:token|key|api_key|access_token|secret)=)[^&\s"']+/gi,
    replacement: "$1[REDACTED:WEBHOOK_TOKEN]",
  },
  {
    type: "password",
    regex: /(\b[a-z][a-z0-9+.-]*:\/\/[^:/\s@]+:)([^@\s/]+)(@)/gi,
    replacement: "$1[REDACTED:PASSWORD]$3",
  },
  {
    type: "password",
    regex: /(\b(?:password|passwd|pwd)\s*[:=]\s*)("[^"]+"|'[^']+'|\S+)/gi,
    replacement: "$1[REDACTED:PASSWORD]",
  },
  {
    type: "password",
    regex: /(\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*_PASSWORD\s*[:=]\s*)("[^"]+"|'[^']+'|\S+)/gi,
    replacement: "$1[REDACTED:PASSWORD]",
  },
  {
    type: "bearer_token",
    regex: /(\bBearer\s+)[A-Za-z0-9\-._~+/]+=*/gi,
    replacement: "$1[REDACTED:BEARER_TOKEN]",
  },
  {
    type: "auth_header",
    regex: /(\bAuthorization\s*:\s*)(?!Bearer\b|\[REDACTED)([^\s][^\r\n]*)/gi,
    replacement: "$1[REDACTED:AUTH_HEADER]",
  },
  {
    type: "anthropic_key",
    regex: /\bsk-ant-[A-Za-z0-9_-]{8,}/g,
    replacement: "[REDACTED:ANTHROPIC_KEY]",
  },
  {
    type: "openai_key",
    regex: /\bsk-(?!ant-)[A-Za-z0-9_-]{8,}/g,
    replacement: "[REDACTED:OPENAI_KEY]",
  },
  {
    type: "github_token",
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}\b/g,
    replacement: "[REDACTED:GITHUB_TOKEN]",
  },
  {
    type: "github_token",
    regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    replacement: "[REDACTED:GITHUB_TOKEN]",
  },
  {
    type: "slack_token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{8,}/g,
    replacement: "[REDACTED:SLACK_TOKEN]",
  },
  {
    type: "telegram_token",
    regex: /\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/g,
    replacement: "[REDACTED:TELEGRAM_TOKEN]",
  },
];

/**
 * Strict redaction patterns — applied on top of defaults when
 * --strict-redaction is enabled.
 *
 * These patterns are more aggressive:
 * - Base64-looking strings longer than 20 chars
 * - All environment variable values (key names preserved)
 * - Contents of files with secret-suggestive filenames
 */
export const STRICT_REDACTION_PATTERNS: RedactionPattern[] = [
  {
    type: "base64_string",
    regex: /\b(?:[A-Za-z0-9+/]{32,}={0,2})\b/g,
    replacement: "[REDACTED:BASE64_STRING]",
  },
  {
    type: "strict_pattern",
    // Single bounded quantifier + fixed suffixes (no overlapping \w+ / (?:[_-]\w+)* — CodeQL js/redos).
    regex:
      /(\b[A-Za-z0-9][A-Za-z0-9_-]{0,127}?(?:SECRET|TOKEN|KEY|CREDENTIAL|PASS|SALT)\s*[:=]\s*)([^\s"']{4,})/gi,
    replacement: "$1[REDACTED:STRICT]",
  },
];
