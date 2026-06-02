---
name: my-tool
description: A tool with broken local references
---

# My Tool

This tool references local files that don't exist:

- [Non-existent file](./nonexistent-file.md)
- [Missing config](./missing-config.json)
- [External link](https://example.com) (this should NOT be flagged)

This file exists and references itself.
