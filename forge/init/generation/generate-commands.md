# Generation: Commands

## Purpose

Generate standalone slash commands in `.claude/commands/` that serve as
entry points to the generated workflows.

## Inputs

- Generated workflows (from Phase 5) — their exact filenames and paths
- `.forge/config.json` — project prefix, paths

## Outputs

`.claude/commands/` with non-namespaced commands:
- `engineer.md` → `/engineer {TASK_ID}`
- `supervisor.md` → `/supervisor {TASK_ID}`
- `implement.md` → `/implement {TASK_ID}`
- `fix-bug.md` → `/fix-bug {BUG_ID}`
- `sprint-plan.md` → `/sprint-plan`
- `run-task.md` → `/run-task {TASK_ID}`
- `run-sprint.md` → `/run-sprint {SPRINT_ID} [--parallel]`
- `collate.md` → `/collate [SPRINT_ID]`
- `retrospective.md` → `/retrospective {SPRINT_ID}`
- `approve.md` → `/approve {TASK_ID}`
- `commit.md` → `/commit {TASK_ID}`

## Instructions

Each command file should:
1. Set appropriate model in frontmatter (sonnet for Engineer, opus for Supervisor/Architect)
2. Load the corresponding workflow from `.forge/workflows/`
3. Load `engineering/MASTER_INDEX.md` for context
4. Pass `$ARGUMENTS` as the task/sprint/bug ID
5. Be clear, greppable, and self-contained
