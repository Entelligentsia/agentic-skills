# Meta-Workflow: Approve Task

## Purpose

The Architect gives final sign-off on a completed task after Supervisor
approval. This is the last gate before commit.

## Algorithm

### Step 1 — Load Context
- Read the task prompt
- Read PLAN.md (final version)
- Read CODE_REVIEW.md (approved)
- Read PROGRESS.md

### Step 2 — Architectural Review
- Verify the implementation aligns with project architecture
- Check for cross-cutting concerns (does this affect other modules?)
- Assess operational impact (deployment changes, migration needed?)

### Step 3 — Sign Off
Write ARCHITECT_APPROVAL.md with:
- Approval status
- Any deployment notes
- Any follow-up items for future sprints

### Step 4 — Update Task State
- Set task status to `approved`
- Record in store

## Generation Instructions
- Reference the project's architecture docs
- Include the project's deployment concerns
- Use the project's store paths and status values
