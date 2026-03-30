# Meta-Workflow: Implement Plan

## Purpose

The Engineer implements the approved plan: write code, run tests, verify,
and document progress.

## Algorithm

### Step 1 — Load Context
- Read architecture docs relevant to the task
- Read business domain docs relevant to the task
- Read the approved PLAN.md

### Step 2 — Implement
- Follow the plan. Write code.
- Work incrementally — compile/check after each significant change

### Step 3 — Verify
- Run syntax verification: {SYNTAX_CHECK}
- Run test suite: {TEST_COMMAND}
- Run build if frontend assets modified: {BUILD_COMMAND}

### Step 4 — Document
- Write PROGRESS.md with:
  - What was done
  - Test evidence (copy test output)
  - Files changed manifest

### Step 5 — Knowledge Writeback
- Update architecture/business-domain/stack-checklist if discoveries made
- Tag updates: `<!-- Discovered during {TASK_ID} — {date} -->`

### Step 6 — Emit Event + Update State

## Generation Instructions
- Replace {SYNTAX_CHECK} with project's checker (py_compile, node --check, go vet...)
- Replace {TEST_COMMAND} with project's test runner
- Replace {BUILD_COMMAND} with project's build step
- Reference specific architecture sub-documents by name
- Reference specific entity names from business domain
- Include project-specific verification steps (Django: makemigrations --check)
