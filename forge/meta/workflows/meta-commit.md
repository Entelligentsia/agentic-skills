# Meta-Workflow: Commit Task

## Purpose

Stage all task artifacts and code changes, create a well-formatted commit.

## Algorithm

### Step 1 — Verify Prerequisites
- ARCHITECT_APPROVAL.md exists and shows approval
- All tests pass (re-run {TEST_COMMAND} as a final check)

### Step 2 — Stage Changes
- Stage code changes
- Stage task artifacts (PLAN.md, PROGRESS.md, CODE_REVIEW.md, etc.)
- Stage knowledge base updates (if any)
- Stage store updates (task JSON, event JSONs)

### Step 3 — Commit
- Format commit message: `{TYPE}: {SUMMARY} [{TASK_ID}]`
- Include co-author line
- Do NOT use --no-verify

### Step 4 — Update Task State
- Set task status to `committed`
- Record final event

## Generation Instructions
- Use the project's ID format in commit messages
- Include the project's commit conventions
- Reference the store paths for staging
