# Smoke Test

## Purpose

Validate the generated SDLC instance before handing off to the developer.
Self-correct up to once per failing component.

## Checks

### 1. Structural — all expected files exist

- `.forge/config.json`
- `engineering/architecture/INDEX.md` and sub-docs
- `engineering/business-domain/INDEX.md` and `entity-model.md`
- `engineering/stack-checklist.md`
- All 14 workflows in `.forge/workflows/`
- All commands in `.claude/commands/`
- All templates in `.forge/templates/`
- All tools in `engineering/tools/`

### 2. Referential — internal links resolve

- Orchestrator's workflow paths point to existing files
- Templates referenced in workflows exist
- Architecture INDEX.md links resolve
- Commands reference existing workflow files

### 3. Tool execution

- `engineering/tools/validate-store --dry-run` runs without error (if tool exists)

### 4. Template coherence

- Templates reference entities that exist in `engineering/business-domain/entity-model.md`

### 5. Config validation

- `.forge/config.json` validates against `sdlc-config.schema.json`

## Self-Correction

If a check fails:
1. Log the specific failure
2. Attempt to regenerate the failing component (re-read the relevant
   generation prompt and re-execute)
3. Re-run the failed check
4. If still failing, report to user with diagnostic

## Report

Output a summary:
- Knowledge base: doc count, entity count, checklist items
- Generated artifacts: workflow count, command count, template count, tool count
- Smoke test: pass/fail per check, any self-corrections applied
- Confidence rating (percentage)
- Lines marked `[?]` that need human verification
- Next step: review `engineering/` docs, then run `/sprint-plan`
