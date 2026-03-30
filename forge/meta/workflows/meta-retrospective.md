# Meta-Workflow: Sprint Retrospective

## Purpose

Sprint closure: review what happened, extract learnings, update the
knowledge base, and improve workflows.

## Algorithm

### Step 1 — Load Sprint Data
- Read all task artifacts from the sprint (PLAN, PROGRESS, CODE_REVIEW)
- Read all events from .forge/store/events/{SPRINT_ID}/
- Read all bugs fixed during the sprint

### Step 2 — Analyse Patterns
- Review iteration counts (how many plan/code review loops per task)
- Identify recurring review feedback themes
- Identify recurring bug root cause categories
- Note any workflow friction points

### Step 3 — Knowledge Base Review
- Review all `[?]` writebacks from the sprint
- Confirm or remove each one
- Promote patterns that appeared 2+ times to the stack checklist

### Step 4 — Workflow Improvements
- If a workflow step consistently caused friction, propose an edit
- If a template section was consistently skipped, propose removal
- If a new check category emerged, propose addition

### Step 5 — Write Retrospective
- Sprint summary with metrics
- What went well
- What to improve
- Knowledge base updates made
- Workflow improvements proposed

### Step 6 — Collate
- Run collation to update all indexes

## Generation Instructions
- Reference the project's sprint artifact paths
- Reference the project's domain docs and stack checklist
- Include the project's workflow file paths for proposed edits
