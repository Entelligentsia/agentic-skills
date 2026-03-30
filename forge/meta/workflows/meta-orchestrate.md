# Meta-Workflow: Orchestrate Task

## Purpose

Wire the atomic workflows into a pipeline that drives a single task through
the complete lifecycle. This is the task state machine.

## Pipeline Phases

See vision/09-ORCHESTRATION.md for the full phase schema.

Each phase has:
- `name` — identifier
- `agent` — which role executes
- `model` — which model to use
- `workflow` — which workflow file to load
- `requires` — prerequisite artifact
- `produces` — output artifact
- `max_iterations` — revision loop limit (for review phases)
- `gate_checks` — conditions that must pass before proceeding

## Default Pipeline

```
plan → review-plan → [loop max 3] → implement → review-implementation → [loop max 3] → approve → writeback → commit
```

## Error Recovery

- Test/build failure: pass error to Engineer revision workflow, retry once
- Verdict "Revision Required": enter revision loop (up to max_iterations)
- Timeout/empty response: retry subagent once with simplified prompt
- Git hook failure: diagnose, fix, create new commit
- Merge conflict: escalate to human

## Event Emission

Every phase emits a structured event to .forge/store/events/.

## Generation Instructions
- Fill in concrete test/build/lint commands from .forge/config.json
- Reference generated workflows by exact filename in .forge/workflows/
- Include stack-specific gate checks
- Set model assignments per role
