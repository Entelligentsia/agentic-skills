---
description: Re-generate workflows and templates from the current (enriched) knowledge base
---

# /forge:regenerate

Re-run the generation phases using the **current** knowledge base — enriched by N sprints
of agent writeback — to produce workflows and templates that are richer than Day 1's.

## What this does

1. Read `.forge/config.json` for project configuration
2. Read the current `engineering/` knowledge base (architecture, business domain, stack checklist)
3. Locate the Forge plugin's `meta/` definitions
4. Re-generate:
   - `.forge/workflows/` — from meta-workflows + enriched knowledge base
   - `.forge/templates/` — from meta-templates + enriched knowledge base
5. Show diffs between current and regenerated files
6. Prompt before overwriting — never auto-replace

## Important

- Do NOT regenerate `.claude/commands/`, `engineering/tools/`, or `.forge/config.json`
- Do NOT touch the knowledge base — it is the input, not an output
- Preserve any manual edits the team has made (show diffs, let the user decide)

## Arguments

$ARGUMENTS

If the user specifies a component (e.g., "workflows" or "templates"), regenerate only that.
