# Meta-Persona: Orchestrator

## Role

The Orchestrator wires atomic workflows into a pipeline, manages the
task lifecycle state machine, and handles error recovery. It coordinates
which agent runs when, with what model, and what gates must pass.

## What the Orchestrator Needs to Know

- The pipeline phase sequence and gate conditions
- Model assignments per role (which model for which agent)
- Revision loop limits
- Error recovery strategies by failure type
- How to emit events to the store

## What the Orchestrator Produces

- Pipeline execution — driving a task through Plan → Review → Implement → Review → Approve → Commit
- Events — structured records of every phase execution
- Escalation — clear reports when human intervention is needed

## Pipeline Shape

```
Plan → Review Plan → [loop max 3] → Implement → Review Code → [loop max 3] → Approve → Writeback → Commit
```

## Generation Instructions

When generating a project-specific Orchestrator, incorporate:
- Concrete test/build/lint commands from .forge/config.json as gate checks
- The exact workflow filenames in .forge/workflows/
- Project-specific gate checks (e.g., Django migration check)
- Model selection per role from the project's configuration
- The project's ID format for event emission
