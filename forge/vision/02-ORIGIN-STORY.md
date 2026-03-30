# 02 — Origin Story

Forge was distilled from a production AI-SDLC system built at WalkInto, a 360° virtual tour SaaS platform.

---

## The WalkInto AI-SDLC

WalkInto is a Node.js/Express/MongoDB application with Jade templates, AngularJS (legacy), Nuxt 4 (modern), Stripe payments, and AWS infrastructure. One developer, assisted by Claude Code agents.

Over 28 sprints, the project developed a structured multi-agent workflow system:

- **20 workflow definitions** in `.agent/workflows/` — procedural instructions for specialist agents
- **19 slash commands** in `.claude/commands/` — user entry points
- **A JSON store** (`engineering/.store/`) — structured task, sprint, bug, and event data
- **7 agent roles** — Architect, Engineer, Supervisor, Orchestrator, Collator, DevOps, Quiz
- **A knowledge base** — architecture docs, business domain docs, entity models

### What It Achieved

| Metric | Value |
|--------|-------|
| Sprints completed | 28 |
| Tasks managed | 100+ |
| Bugs triaged and fixed | 90+ |
| Agent roles | 7 |
| Workflow definitions | 20 |
| Knowledge base documents | 30+ (architecture, business domain, decisions) |

The system worked. The Supervisor caught real bugs. The Architect maintained coherence across sprints. The knowledge base became the authoritative documentation — always current because agents updated it as part of their workflow.

## The Extraction Question

After 28 sprints, the question arose: can this be extracted and made available to other projects?

### Phase 1 — Audit

A systematic audit of all 20 workflows and 19 commands catalogued **~145 WalkInto-specific references**:

| Category | Examples | Count |
|----------|---------|-------|
| Path references | `engineering/`, `routes/Tests/`, `.agent/workflows/` | ~80 |
| ID prefixes | `WI-S01-T01`, `WI-BUG-84` | ~40 |
| Tech stack checks | "Jade templates use `=` not `!=`", "AngularJS `$scope` updates trigger `$apply`" | ~15 |
| Infrastructure | `walkintodb_new`, PM2 process `walkinto`, `54.93.57.86` | ~10 |

These fell into four tiers:
- **T1 — Tokenisable** (~90): simple string substitution
- **T2 — Structural** (~30): directory layout conventions
- **T3 — Domain-embedded** (~25): stack-specific review logic woven into workflow prose
- **T4 — Non-extractable** (6 workflows): pure WalkInto ops (DevOps, Freshdesk, log scanning)

### Phase 2 — The Insight

The initial plan was tokenisation: replace `engineering/` with `{{ENGINEERING_DIR}}`, ship the tokenised workflows, resolve tokens at runtime.

Two deeper insights changed the approach:

**Insight 1: The value is the knowledge base, not the workflows.**

The workflows are procedural instructions. They're valuable, but the real power comes from the knowledge base they consult — architecture docs, entity models, review checklists. A Supervisor that says "check auth middleware" is generic. A Supervisor that says "verify `@login_required` on all DRF APIViews, check Celery tasks use `shared_task` with `bind=True`" is useful.

The knowledge base must be project-specific. But requiring teams to write it from scratch kills adoption. Solution: **auto-discover it from the codebase**.

**Insight 2: Tokenised workflows are worse than generated workflows.**

A workflow littered with `{{ENGINEERING_DIR}}` and `{{TEST_COMMAND}}` is hard to read, hard to debug, and requires a token resolution mechanism. A workflow that says `engineering/architecture/stack.md` and `pytest && npm test` is clear, greppable, and native.

Instead of shipping tokenised workflows, ship **meta-definitions** — abstract descriptions of what each workflow step achieves. The LLM reads the meta + the discovered project and generates project-specific workflows.

**Insight 3: Tools should be generated, not shipped.**

WalkInto's collation tool is a 500-line Node.js script. Shipping it creates a Node.js dependency. Instead, ship the **algorithm as a spec** and let the LLM generate an implementation in the project's language. Maya's Django project gets `collate.py`. A Go project gets `collate.go`.

### Phase 3 — The Self-Enhancing Flywheel

The third design layer: the generated system doesn't just work — it learns.

Every workflow already discovers knowledge about the project during execution. In the WalkInto system, most of that knowledge evaporated when the task ended (documented only in per-task artifacts). The retrospective captured some of it, but the feedback loop was incomplete.

Forge adds a **Knowledge Writeback** protocol: every workflow's final step reviews what it discovered and updates the knowledge base. The Supervisor adds to the review checklist when it catches a pattern. The bug fixer tags root cause categories. The retrospective promotes recurring patterns.

The stack checklist — initially generated as a 5-item stub — grows to 25 items by Sprint 3, all from real project experience. No manual curation required.

## From WalkInto to Forge

| WalkInto AI-SDLC | Forge |
|-------------------|-------|
| 20 hardcoded workflows | Meta-definitions that generate project-specific workflows |
| Manual knowledge base setup | Auto-discovery + generation |
| Node.js collation tool | Tool specs → generated in any language |
| WalkInto review checks (Jade, AngularJS, MongoDB) | Auto-generated + self-growing stack checklist |
| Works for one project | Works for any project |

WalkInto continues to use its original workflows (they work, they're battle-tested). Forge is the generalisation — the meta-system extracted from 28 sprints of practice.

---

**Next**: [03-META-GENERATOR.md](03-META-GENERATOR.md) — The meta-definition architecture
