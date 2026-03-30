# Meta-Workflow: Review Plan

## Purpose

The Supervisor reviews the Engineer's implementation plan for feasibility,
security, and architecture alignment.

## Algorithm

### Step 1 — Load Context
- Read the task prompt (to understand intent)
- Read the PLAN.md (to review the approach)
- Read relevant architecture docs
- Read the stack checklist

### Step 2 — Review
Evaluate against these categories:
1. **Feasibility** — is the approach realistic?
2. **Completeness** — are all acceptance criteria addressed?
3. **Security** — are auth and validation covered?
4. **Architecture alignment** — does it follow established patterns?
5. **Testing strategy** — adequate coverage planned?
6. **Risk** — are edge cases and failure modes considered?

### Step 3 — Verdict
Write PLAN_REVIEW.md with:
- Verdict: `Approved` or `Revision Required`
- If revision required: numbered, actionable items
- If approved: any advisory notes for implementation

### Step 4 — Knowledge Writeback
- If the review identified a check that should be caught earlier,
  add it to stack-checklist.md

### Step 5 — Emit Event + Update State

## Generation Instructions
- Include project-specific architecture sub-docs to cross-reference
- Include stack-specific security checks from the checklist
- Reference the project's conventions for plan quality
