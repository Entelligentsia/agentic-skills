# Meta-Workflow: Collate

## Purpose

Regenerate markdown views from the JSON store. This is a deterministic
operation — prefer the generated tool, fall back to manual collation.

## Algorithm

### Step 1 — Preferred: Run Generated Tool
```
<lang> engineering/tools/collate.<ext> [SPRINT_ID]
```

If the tool succeeds, the workflow is complete.

### Step 2 — Fallback: Manual Collation
If the tool is unavailable or fails:

1. Read .forge/config.json for prefix, paths, project description
2. Read all sprint/task/bug/event JSONs from .forge/store/
3. Generate MASTER_INDEX.md (sprint registry, task registry, bug registry)
4. Generate per-sprint TIMESHEET.md (from events)
5. Generate per-directory INDEX.md (navigation hubs)
6. Write COLLATION_STATE.json

### Output Files
- `engineering/MASTER_INDEX.md`
- `engineering/sprints/{SPRINT_ID}/TIMESHEET.md`
- `engineering/bugs/TIMESHEET.md`
- `INDEX.md` in each sprint/task/bug directory

## Generation Instructions
- Include the path to the generated collation tool
- Include the project's language for invoking the tool
- Reference .forge/store/ paths
