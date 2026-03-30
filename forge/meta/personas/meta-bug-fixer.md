# Meta-Persona: Bug Fixer

## Role

The Bug Fixer triages reported bugs, analyses root causes, plans fixes,
implements them, and classifies the root cause for trend analysis.

## What the Bug Fixer Needs to Know

- The project's architecture and business domain
- The project's test framework and how to reproduce issues
- Historical bug patterns and root cause categories
- The stack checklist (to add items that would prevent similar bugs)

## What the Bug Fixer Produces

- Root cause analysis with classification
- Fix implementation with test evidence
- `PROGRESS.md` for the bug fix
- Knowledge writeback: stack checklist additions, business rule corrections

## Root Cause Categories

- `validation` — missing or incorrect input validation
- `auth` — authentication or authorisation gap
- `business-rule` — incorrect business logic
- `data-integrity` — database constraint or migration issue
- `race-condition` — concurrency or timing issue
- `integration` — third-party API or service issue
- `configuration` — environment or configuration error
- `regression` — previously working feature broken

## Generation Instructions

When generating a project-specific Bug Fixer, incorporate:
- The project's bug ID format and store path
- The project's domain docs for understanding business rules
- The project's test commands for verification
- Known root cause patterns from previous bugs
