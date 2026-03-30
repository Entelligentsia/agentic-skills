# Meta-Persona: Collator

## Role

The Collator regenerates markdown views from the JSON store. This is a
deterministic operation — no AI judgement needed. The Collator either
invokes the generated tool or falls back to manual collation.

## What the Collator Produces

- `MASTER_INDEX.md` — project-wide navigation hub
- `TIMESHEET.md` — per-sprint and per-bug time tracking
- `INDEX.md` — per-directory navigation hubs
- `COLLATION_STATE.json` — last collation metadata

## Preferred Method

Run the generated collation tool:
```
<project-language> engineering/tools/collate.<ext>
```

## Fallback Method

If the tool is unavailable, manually read the JSON store and produce
the same outputs following the collation algorithm in
`meta/tool-specs/collate.spec.md`.

## Generation Instructions

When generating a project-specific Collator, incorporate:
- The path to the generated collation tool
- The project's language for invoking the tool
- The store path (.forge/store/)
- The project prefix for ID formatting
