# Meta-Workflow: Fix Bug

## Purpose

Triage a reported bug, analyse the root cause, plan a fix, implement it,
and classify the root cause for trend analysis.

## Algorithm

### Step 1 — Triage
- Read the bug report
- Reproduce the issue (or understand why it can't be reproduced)
- Assess severity: Critical / Major / Minor

### Step 2 — Analyse Root Cause
- Identify the failing code path
- Determine root cause category (validation, auth, business-rule, etc.)
- Check for similar bugs in the store

### Step 3 — Plan Fix
- Write a focused fix plan
- Identify the minimal set of changes needed

### Step 4 — Implement Fix
- Write the fix
- Add/update tests that cover the bug scenario
- Run {TEST_COMMAND}

### Step 5 — Document
- Write PROGRESS.md for the bug fix
- Record root cause classification in the bug store JSON

### Step 6 — Knowledge Writeback
- Add stack-checklist item if this bug class should be caught in future reviews
- Update business domain docs if a rule was incorrect
- Tag similar bugs in the store

### Step 7 — Emit Event + Update State

## Generation Instructions
- Include the project's bug ID format and store path
- Reference the project's domain docs
- Include the project's test commands
- Reference known root cause categories from previous bugs
