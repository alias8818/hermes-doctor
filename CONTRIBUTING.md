# Contributing to Hermes Doctor

## Development Environment

Hermes Doctor is a TypeScript monorepo managed with pnpm workspaces.

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Setup

```bash
pnpm install
pnpm build
```

This installs all workspace dependencies and compiles TypeScript across all packages.

### Running Tests

```bash
pnpm test
```

Tests use Vitest. Run in watch mode during development:

```bash
pnpm test:watch
```

### Linting

```bash
pnpm lint
```

ESLint is configured at the workspace root. The config applies to all packages.

### Type Checking

```bash
pnpm typecheck
```

Runs `tsc -b` across the project references to validate all types.

### Running the CLI Locally

```bash
pnpm dev -- scan
```

Uses tsx for on-the-fly TypeScript execution. Pass `--help` to see available commands and flags.

## Commit Conventions

No strict conventional commits format is enforced. Write clear, descriptive commit messages that explain what changed and why. Keep commits focused. Avoid bundling unrelated changes in a single commit.

## Reporting Bugs

Open an issue on the GitHub repository. Include:

- The exact command you ran and its full output
- Your Node.js version (`node --version`)
- Your operating system
- Steps to reproduce the issue

## Reporting Security Issues

Do not open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

## Pull Requests

- Keep PRs focused and reasonably sized.
- Ensure tests pass (`pnpm test`) and lint is clean (`pnpm lint`) before opening.
- Add tests for new behavior where practical.
- Update relevant documentation if your change affects user-facing behavior.
