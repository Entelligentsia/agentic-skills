---
description: Regenerate deterministic tools from the latest tool specs
---

# /forge:update-tools

Regenerate the deterministic tools in `engineering/tools/` from the Forge plugin's
latest tool specs.

## What this does

1. Read `.forge/config.json` for project language and paths
2. Locate the Forge plugin's `meta/tool-specs/`
3. For each tool spec (`collate`, `seed-store`, `validate-store`):
   a. Read the current spec from the plugin
   b. Read the current generated tool from `engineering/tools/`
   c. Show the user what changed in the spec
   d. Offer to regenerate the tool
4. Generate new tool in the project's language
5. Show diff between old and new tool
6. Prompt before overwriting — the team may have customised the tool

## Arguments

$ARGUMENTS

If the user specifies a tool name (e.g., "collate"), update only that tool.
