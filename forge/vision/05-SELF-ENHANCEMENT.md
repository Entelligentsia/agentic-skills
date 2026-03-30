# 05 — Self-Enhancement

The generated SDLC instance is not static. It gets smarter with every task it executes.

---

## The Flywheel

```
Agents work on tasks
    → Agents discover project knowledge while working
        → Agents write discoveries back to the knowledge base
            → Next task benefits from richer context
                → Agents discover more nuanced knowledge
                    → ...
```

Every revolution of the flywheel makes the system more accurate, the reviews more specific, and the plans more informed.

---

## Knowledge Writeback Protocol

Every agent workflow includes a **Knowledge Writeback** step as its final action before producing its primary artifact.

### What Each Agent Writes Back

| Agent | Discovers While Working | Writes Back To |
|-------|------------------------|----------------|
| **Engineer (plan)** | Architecture gaps, undocumented patterns | `architecture/` sub-docs |
| **Engineer (implement)** | Build/test surprises, business rule clarifications, new conventions | `architecture/`, `business-domain/`, `stack.md` |
| **Supervisor (plan review)** | Issues that should be caught during planning | `stack-checklist.md` |
| **Supervisor (code review)** | Code convention patterns, architecture drift, business rule errors | `stack-checklist.md`, `architecture/`, `business-domain/` |
| **Bug fixer** | Root cause classes, missing validation rules, failure modes | `business-domain/`, `stack-checklist.md`, `architecture/` |
| **Retrospective** | Sprint-wide patterns, repeated review feedback, workflow friction | All of the above + workflow files themselves |

### Writeback Mechanics

The writeback step in each workflow:

```markdown
## Step N — Knowledge Writeback

Before writing your primary artifact, review what you learned:

1. **Architecture**: Did you discover undocumented patterns, processes, or conventions?
   → Update the relevant sub-document in engineering/architecture/
2. **Business rules**: Did you clarify or discover any rule not in the domain docs?
   → Update the relevant sub-document in engineering/business-domain/
3. **Stack checklist**: Did you find an issue that should be caught EARLIER?
   → Add it to engineering/stack-checklist.md

Tag all updates:
<!-- Discovered during {TASK_ID} — {date} -->
```

### Writeback Quality Control

Not every discovery is worth persisting. The writeback step applies a filter:

- **High confidence**: A business rule was wrong in the docs and the correct behaviour was verified in code or confirmed by tests → **update immediately**
- **Medium confidence**: An undocumented pattern was observed → **add with [?] marker for review in retrospective**
- **Low confidence**: An assumption was made but not verified → **do not persist, note in task artifact only**

The retrospective reviews all `[?]` writebacks from the sprint and either confirms or removes them.

---

## The Stack Checklist: Self-Writing Review Guide

The most impactful self-enhancing feature. The stack checklist starts as a generated stub and grows through agent experience.

### Growth Timeline

**Day 1 — Auto-generated from stack detection**

```markdown
# Stack Review Checklist

## Authentication
- [ ] All API views use @login_required or IsAuthenticated

## Database
- [ ] Django ORM querysets used — no raw SQL
- [ ] Migrations are reversible

## Frontend
- [ ] React components include error boundaries
- [ ] No dangerouslySetInnerHTML without sanitisation

## Build
- [ ] npm run build succeeds after frontend changes
- [ ] python manage.py check passes
```

**After Sprint 1 — Supervisor discovered patterns**

```markdown
## API Conventions
<!-- Discovered during ACME-S01-T02 — 2026-04-15 -->
- [ ] All API responses use { "status": "ok"|"error", "data": ..., "message": ... } envelope
- [ ] Pagination uses ?page=N&page_size=M with max 100

## Celery Tasks
<!-- Discovered during ACME-S01-T03 — 2026-04-16 -->
- [ ] Celery tasks are idempotent (safe to retry)
- [ ] Task timeouts set via soft_time_limit
```

**After 3 bugs — Bug fixer identified a class**

```markdown
## Known Pitfalls
<!-- Promoted from bug pattern — 3 occurrences across S01-S03 -->
- [ ] Stripe webhook handlers verify event signature before processing
- [ ] Date fields stored as UTC, converted to user timezone only in templates
```

**Sprint 10 — The checklist IS the project's quality standard**

25-30 items, all earned from real experience. New developers read it and understand the project's conventions without asking. The Supervisor's reviews are precise because they're grounded in documented, project-specific patterns.

### Who Adds to the Checklist

| Agent | When | What |
|-------|------|------|
| Supervisor (code review) | Catches an issue | Adds the check that would have prevented it |
| Bug fixer | Identifies root cause class | Adds the validation/check that would catch similar bugs |
| Retrospective | Reviews all CODE_REVIEW.md from sprint | Promotes patterns that appeared 2+ times |

---

## Structured Self-Enhancement Metadata

The JSON store gains fields that enable trend analysis:

### Task Store Extensions

```json
{
  "taskId": "ACME-S02-T03",
  "knowledgeUpdates": [
    { "file": "architecture/stack.md", "section": "Celery Patterns", "type": "addition" },
    { "file": "business-domain/entity-model.md", "section": "Workspace", "type": "correction" }
  ],
  "planIterations": 1,
  "codeReviewIterations": 2
}
```

### Bug Store Extensions

```json
{
  "bugId": "ACME-BUG-05",
  "rootCauseCategory": "validation",
  "similarBugs": ["ACME-BUG-02"],
  "checklistItemAdded": true,
  "businessRuleUpdated": true
}
```

These fields enable:
- **The collator** to surface trends (iteration counts, bug categories)
- **The retrospective** to identify systemic patterns
- **The architect** to adjust sprint planning based on historical complexity

---

## Knowledge Base Health Monitor

A `/forge:health` command (or part of the collator) assesses knowledge base currency:

| Check | What It Detects |
|-------|----------------|
| **Stale docs** | Architecture sub-docs not updated in N sprints |
| **Orphaned entities** | Entities in code (ORM models) not in entity-model.md |
| **Unused checklist items** | Stack-checklist items never triggered in reviews (stale rules) |
| **Coverage gaps** | Architecture areas with no sub-document |
| **Writeback backlog** | `[?]` items not yet confirmed by retrospective |

---

## Regeneration

The generated workflows and templates are version-controlled project files. They evolve through:

1. **Continuous writeback** — small updates during every task
2. **Retrospective improvements** — the retrospective can propose edits to workflow files themselves
3. **On-demand regeneration** — `/forge:regenerate` re-runs the generation phases using the **current** knowledge base (enriched by N sprints of writeback), producing workflows that are much richer than Day 1's

Sprint 1's generated Supervisor says: "Check @login_required on APIViews."
Sprint 10's regenerated Supervisor says: "Check @login_required on APIViews. Verify Celery tasks use shared_task with bind=True. Confirm Stripe webhook signature verification. Ensure date fields use UTC storage. Check API responses follow the envelope format."

---

## The Accumulating Asset

Over time, the knowledge base becomes the most valuable documentation the project has:

| Sprint | Knowledge Base State |
|--------|---------------------|
| Day 1 | ~60% accurate. Auto-generated drafts. Useful but imprecise. |
| Sprint 3 | ~85% accurate. Stack checklist has 25 items. Entity model complete. |
| Sprint 5 | ~90% accurate. Architecture docs reflect reality. Review quality is sharp. |
| Sprint 10 | ~95% accurate. The knowledge base IS the project documentation. Always current. |

This is documentation that writes itself. Not because someone decided to update it, but because the agents update it as a natural part of doing their work.

---

**Next**: [06-TOOL-GENERATION.md](06-TOOL-GENERATION.md) — Spec-driven tool generation
