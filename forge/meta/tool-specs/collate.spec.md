# Tool Spec: collate

## Purpose

Regenerate markdown views from the JSON store. Deterministic — no AI needed.

## Inputs

- `.forge/config.json` — project prefix, paths, description
- `.forge/store/sprints/*.json`
- `.forge/store/tasks/*.json`
- `.forge/store/bugs/*.json`
- `.forge/store/events/{SPRINT_ID}/*.json`
- Existing `engineering/MASTER_INDEX.md` (to preserve static sections)

## Outputs

1. `engineering/MASTER_INDEX.md`
2. `engineering/sprints/{SPRINT_ID}/TIMESHEET.md` (per sprint)
3. `engineering/bugs/TIMESHEET.md`
4. `INDEX.md` (per sprint, task, bug directory)
5. `.forge/store/COLLATION_STATE.json`

## CLI Interface

```
<tool> collate              # all sprints
<tool> collate S01          # single sprint + master index
<tool> collate --dry-run    # preview only
```

Exit 0 on success, 1 on validation error.

## Algorithm

1. Read `.forge/config.json` for prefix, paths, project description
2. Validate store: tasks/ has JSON files, required fields present
3. Load all sprint JSON, sort by sprint number ascending
4. Load all task JSON, group by sprintId
5. Load all bug JSON, sort by bug number
6. Read existing `engineering/MASTER_INDEX.md`, extract preserved sections by `##` heading
7. Build Sprint Registry: table with progress (completed/total)
8. Build Task Registry: grouped by sprint (most recent first)
9. Build Bug Registry: open first (asc), then resolved (desc)
10. Write `engineering/MASTER_INDEX.md`: config header → preserved → generated
11. For each sprint: events → estimates table + activity log → TIMESHEET.md
12. For each directory: discover artifacts → INDEX.md navigation hub
13. Write `.forge/store/COLLATION_STATE.json`

## Formatting Rules

- Markdown pipe tables
- Timestamps truncated to minutes
- Duration: <60m → "Nm", >=60m → "Nh Mm"
- IDs hyperlink to INDEX.md via relative paths
- Generated files start with `<!-- GENERATED -->` comment
