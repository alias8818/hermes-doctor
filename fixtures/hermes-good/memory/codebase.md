# Project Structure

This Hermes instance manages the Hermes Doctor project.

## Key Files

- packages/core/src/ - Core diagnostic engine
- packages/cli/src/ - CLI interface
- packages/flue-workflows/src/ - Optional Flue workflows

## Recent Context

- Implemented collector boundary redaction
- All 11 collectors return CollectorResult<T>
- Dashboard probes are localhost-only with 1500ms timeout
