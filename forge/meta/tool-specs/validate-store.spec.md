# Tool Spec: validate-store

## Purpose

Check store integrity: required fields present, referential integrity
between sprints/tasks/bugs/events, no orphaned records.

## Inputs

- `.forge/config.json` — paths
- `.forge/store/` — all JSON files

## Outputs

- Validation report to stdout
- Exit 0 if valid, 1 if errors found

## CLI Interface

```
<tool> validate-store              # full validation
<tool> validate-store --dry-run    # same checks, just report
<tool> validate-store --fix        # auto-fix where possible (add missing defaults)
```

## Validation Rules

### Required Fields
- Sprint: sprintId, title, status
- Task: taskId, sprintId, title, status
- Bug: bugId, title, severity, status
- Event: eventId, taskId, role, action, startTimestamp

### Referential Integrity
- Every task.sprintId references an existing sprint
- Every event.taskId references an existing task
- Every event.sprintId references an existing sprint
- Every bug.similarBugs[] references existing bugs

### Orphan Detection
- Task directories in `engineering/sprints/` without corresponding store JSON
- Store JSON without corresponding artifact directory

### Status Consistency
- Task status matches artifact presence (e.g., `committed` tasks should have all artifacts)
- Sprint status consistent with task statuses

## Auto-Fix Rules (--fix mode)
- Add missing optional fields with defaults
- Create missing `.gitkeep` files in empty directories
- Do NOT delete orphaned records — only report them
