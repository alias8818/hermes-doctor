# Repository Guidelines

## Project Structure & Module Organization

Hermes Doctor is a TypeScript monorepo managed with **pnpm workspaces**.

```
packages/
  cli/           CLI entry point, commands, output formatters (tsup-built)
  core/          Diagnostic engine: schemas, collectors, checks, redaction, report (tsc-built)
  flue-workflows/  Optional Flue AI workflows for findings explanation
scripts/         Dev utilities and automation
fixtures/        Test fixture data (ignored by ESLint)
reports/         Generated diagnostic reports
research/        Exploratory and design research
```

Source files use `src/` directories. Tests are co-located in `__tests__/` subdirectories.

## Build, Test, and Development Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm build` | Type-check (`tsc -b`) then build the CLI (`tsup`) |
| `pnpm typecheck` | Run `tsc -b` across all project references |
| `pnpm test` | Run Vitest suite (`vitest run`) |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm lint` | Run ESLint across the workspace |
| `pnpm dev -- scan` | Run the CLI against a local Hermes Agent installation |

## Coding Style & Naming Conventions

- **TypeScript** with strict `tsc -b` project references (no tsconfig `files` needed).
- **ESM** modules only (`"type": "module"`). Use `.ts` extensions.
- **ESLint** with `@eslint/js` recommended and `typescript-eslint` recommended configs.
- No trailing semicolons, single quotes preferred (Prettier is not enforced, but follow existing file style).
- Package names: `@hermes-doctor/<name>` for internal packages.
- Export barrels from `src/index.ts` in each package.

## Testing Guidelines

- **Framework**: Vitest with `vitest run --passWithNoTests`.
- Tests live in `__tests__/` folders next to the code they test.
- Test file pattern: `*.test.ts`.
- Integration and validation tests in `packages/cli/src/__tests__/` use the CLI through its programmatic API.
- Unit tests for core logic live in `packages/core/src/<module>/__tests__/`.

## Commit & Pull Request Guidelines

- Write clear, descriptive commit messages. No strict conventional commits enforced.
- Keep PRs focused and reasonably sized.
- Ensure `pnpm test` and `pnpm lint` pass before opening a PR.
- Add tests for new behavior where practical.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on `alias8818/hermes-doctor` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical Matt Pocock triage labels used as-is (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
