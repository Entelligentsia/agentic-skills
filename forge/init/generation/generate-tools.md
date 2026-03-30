# Generation: Tools

## Purpose

Generate deterministic tools in the project's native language from
language-agnostic tool specs.

## Inputs

- `$FORGE_ROOT/meta/tool-specs/*.spec.md` (3 tool specs)
- `.forge/config.json` — language, paths, prefix

## Outputs

`engineering/tools/` with tools in the project's primary language:

| Tool Spec | Python | Node.js | Go | Shell (fallback) |
|-----------|--------|---------|-----|-------------------|
| `collate.spec.md` | `collate.py` | `collate.js` | `collate.go` | `collate.sh` |
| `seed-store.spec.md` | `seed_store.py` | `seed-store.js` | `seed-store.go` | `seed-store.sh` |
| `validate-store.spec.md` | `validate_store.py` | `validate-store.js` | `validate-store.go` | `validate-store.sh` |

## Instructions

For each tool spec:
1. Read the spec's Algorithm, CLI Interface, and Formatting Rules
2. Generate an implementation in the project's primary language
3. Make it executable (`#!/usr/bin/env <lang>`)
4. Use the project's standard library — minimal dependencies
5. Follow the project's naming conventions
6. Read `.forge/config.json` for paths and prefix at runtime
7. Include basic error handling and usage help
8. Make the tool self-contained (single file)
