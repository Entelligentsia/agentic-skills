# Meta-Workflow: Plan Task

## Purpose

The Engineer reads the task prompt, researches the codebase, and produces
an implementation plan.

## Algorithm

### Step 1 — Load Context
- Read the task prompt
- Read architecture docs relevant to the task
- Read business domain docs relevant to the task
- Read the stack checklist

### Step 2 — Research
- Identify files that will need modification (Glob, Grep, Read)
- Understand existing patterns in the area being modified
- Check for related tests

### Step 3 — Plan
- Write PLAN.md using the plan template
- Include: objective, approach, files to modify, data model changes,
  testing strategy, acceptance criteria, operational impact

### Step 4 — Knowledge Writeback
- If undocumented patterns were discovered during research, update
  the relevant architecture or business domain docs

### Step 5 — Emit Event + Update State
- Write event JSON to the store
- Update task status to `planned`

## Generation Instructions
- Replace architecture doc references with the project's actual sub-doc names
- Replace entity references with the project's actual entity names
- Include the project's PLAN template path
- Reference the project's specific architecture concerns
