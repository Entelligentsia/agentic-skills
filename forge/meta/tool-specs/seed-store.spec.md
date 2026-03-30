# Tool Spec: seed-store

## Purpose

Bootstrap the JSON store from an existing `engineering/` directory structure.
Used when a project already has sprint/task artifacts but no JSON store.

## Inputs

- `.forge/config.json` — project prefix, paths
- `engineering/sprints/` — existing sprint directories
- `engineering/bugs/` — existing bug directories

## Outputs

- `.forge/store/sprints/*.json` — one per discovered sprint
- `.forge/store/tasks/*.json` — one per discovered task
- `.forge/store/bugs/*.json` — one per discovered bug

## CLI Interface

```
<tool> seed-store              # scan and create
<tool> seed-store --dry-run    # preview what would be created
```

Exit 0 on success, 1 on error.

## Algorithm

1. Read `.forge/config.json` for prefix and paths
2. Scan `engineering/sprints/` for sprint directories (pattern: S{NN})
3. For each sprint directory:
   a. Create sprint JSON with discoverable fields
   b. Scan for task directories (pattern: T{NN})
   c. For each task directory:
      - Read PLAN.md, PROGRESS.md if they exist
      - Extract title, status from artifact content
      - Create task JSON
4. Scan `engineering/bugs/` for bug directories
5. For each bug directory:
   a. Read available artifacts
   b. Create bug JSON
6. Report: N sprints, N tasks, N bugs seeded
