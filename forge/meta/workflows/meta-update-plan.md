# Meta-Workflow: Update Plan

## Purpose

The Engineer revises the implementation plan based on Supervisor feedback.

## Algorithm

### Step 1 — Load Context
- Read the original PLAN.md
- Read PLAN_REVIEW.md (the revision feedback)
- Read any architecture/domain docs referenced in the feedback

### Step 2 — Address Each Item
- Go through each numbered revision item
- Research additional context if needed
- Update the plan to address the feedback

### Step 3 — Update PLAN.md
- Revise the plan in place
- Add a revision history section noting what changed and why

### Step 4 — Emit Event + Update State

## Generation Instructions
- Same project-specific references as meta-plan-task.md
- Include the project's plan template path
