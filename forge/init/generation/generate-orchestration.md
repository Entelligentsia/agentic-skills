# Generation: Orchestration

## Purpose

Generate the task pipeline orchestrator and sprint runner from meta-orchestrate,
wiring in the generated atomic workflows.

## Inputs

- `$FORGE_ROOT/meta/workflows/meta-orchestrate.md`
- Generated atomic workflows (from Phase 5) — their exact filenames
- `.forge/config.json` — commands, paths, pipeline configuration

## Outputs

- `.forge/workflows/orchestrate_task.md` — single-task pipeline (run-task)
- `.forge/workflows/run_sprint.md` — sprint scheduler

## Instructions

### orchestrate_task.md
1. Define each pipeline phase with concrete values:
   - Workflow file paths (the exact filenames generated in Phase 5)
   - Gate checks (test command, build command, lint command from config)
   - Model assignments per role
   - Max iteration counts
2. Include error recovery strategies
3. Include event emission format with project ID prefix

### run_sprint.md
1. Define execution modes (sequential, wave-parallel, full-parallel)
2. Include wave computation algorithm
3. Include worktree management commands
4. Include merge strategy
5. Include sprint lifecycle hooks (collate, report, suggest)
6. Include resume semantics
