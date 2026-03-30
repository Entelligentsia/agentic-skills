# Meta-Workflow: Update Implementation

## Purpose

The Engineer fixes code based on Supervisor review feedback.

## Algorithm

### Step 1 — Load Context
- Read CODE_REVIEW.md (the revision feedback)
- Read the relevant code files referenced in the feedback

### Step 2 — Address Each Item
- Go through each numbered revision item
- Fix the code
- Re-run syntax check and tests after each fix

### Step 3 — Verify
- Run full verification: {SYNTAX_CHECK}, {TEST_COMMAND}, {BUILD_COMMAND}
- Confirm all revision items are addressed

### Step 4 — Update PROGRESS.md
- Append revision section with what was changed
- Update test evidence with latest run

### Step 5 — Emit Event + Update State

## Generation Instructions
- Same project-specific commands as meta-implement.md
