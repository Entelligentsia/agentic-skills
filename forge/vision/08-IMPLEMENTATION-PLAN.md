# 08 — Implementation Plan

How to build Forge, in what order, and how to know when it's ready.

---

## Build Sequence

### Track A — Meta-Definitions (the core IP)

Distill WalkInto's 28-sprint experience into abstract, project-agnostic meta-definitions.

| Step | Work | Input | Output | Effort |
|------|------|-------|--------|--------|
| A1 | Write meta-personas (6) | WalkInto workflow preambles, role descriptions | `meta/personas/` | 1 session |
| A2 | Write meta-workflows (14 — includes sprint runner) | WalkInto `.agent/workflows/` (20 files) | `meta/workflows/` | 3 sessions |
| A3 | Write meta-templates (7) | WalkInto `ai-sdlc/templates/` | `meta/templates/` | 1 session |
| A4 | Write tool specs (3) | WalkInto `engineering/tools/` (5 JS files) | `meta/tool-specs/` | 1 session |
| A5 | Write store schemas (4) | WalkInto `.store/` JSON files | `meta/store-schema/` | 1 session |

**All A-steps are independent.** Can be done in parallel or any order.
**Total: 6 sessions.**

### Track B — Init Engine (the bootstrap system)

Build the `/forge init` orchestration and its component prompts.

| Step | Work | Input | Output | Effort |
|------|------|-------|--------|--------|
| B1 | Write discovery prompts (5) | Claude Code tool capabilities, diverse project structures | `init/discovery/` | 1 session |
| B2 | Write knowledge base generation prompt | Meta-personas (A1), discovery output format | `init/generation/generate-knowledge-base.md` | 1 session |
| B3 | Write persona generation prompt | Meta-personas (A1), knowledge base format | `init/generation/generate-personas.md` | 1 session |
| B4 | Write template generation prompt | Meta-templates (A3), knowledge base format | `init/generation/generate-templates.md` | 1 session |
| B5 | Write workflow generation prompt | Meta-workflows (A2), personas, templates | `init/generation/generate-workflows.md` | 1 session |
| B6 | Write orchestration generation prompt | Meta-orchestrate (A2), generated workflows | `init/generation/generate-orchestration.md` | 1 session |
| B7 | Write command generation prompt | Generated workflows | `init/generation/generate-commands.md` | 0.5 session |
| B8 | Write tool generation prompt | Tool specs (A4), sdlc-config format | `init/generation/generate-tools.md` | 0.5 session |
| B9 | Write smoke test | All generated artifact paths | `init/smoke-test.md` | 1 session |
| B10 | Write init orchestration | All B-steps above | `init/sdlc-init.md` | 1 session |

**B1 can start immediately.** B2-B8 depend on corresponding A-steps. B9-B10 depend on all B-steps.
**Total: 9 sessions** (but B1 parallelises with Track A).

### Track C — Validation

| Step | Work | Input | Output | Effort |
|------|------|-------|--------|--------|
| C1 | Test on WalkInto | All of A + B | Compare generated vs existing workflows | 1 session |
| C2 | Test on a Django+React project | All of A + B | Verify Python generation, Django-specific reviews | 1 session |
| C3 | Test on a Go project | All of A + B | Verify Go generation, different conventions | 1 session |
| C4 | Iterate on meta-definitions | C1-C3 test results | Refined meta-definitions | 2 sessions |

**C1-C3 can run in parallel after B10.** C4 is iterative.
**Total: 5 sessions.**

---

## Dependency Graph

```
A1 (personas) ──────┬─→ B2 (knowledge base gen)
                     ├─→ B3 (persona gen)
A2 (workflows) ─────├─→ B5 (workflow gen)
                     ├─→ B6 (orchestration gen)
A3 (templates) ─────├─→ B4 (template gen)
A4 (tool specs) ────├─→ B8 (tool gen)
A5 (store schemas) ─┘
                            │
B1 (discovery) ─────────────┤
                            ↓
                     B9 (smoke test)
                            │
                     B10 (init orchestration)
                            │
                     ┌──────┼──────┐
                     ↓      ↓      ↓
                    C1     C2     C3  (validation)
                     └──────┼──────┘
                            ↓
                           C4  (iterate)
```

---

## Effort Summary

| Track | Sessions | Parallelisable |
|-------|----------|----------------|
| A — Meta-definitions | 7 | Yes (all independent) |
| B — Init engine | 9 | Partially (B1 independent, B2-B8 depend on A) |
| C — Validation | 5 | Partially (C1-C3 parallel, C4 sequential) |
| **Total** | **21** | **Critical path: ~13 sessions** |

A "session" is one focused work period with Claude Code — typically 1-3 hours.

---

## Milestones

### M1 — Meta-Definitions Complete

All files in `meta/` exist and are reviewed. The meta-definitions are the core IP — they must be precise enough to generate useful project-specific artifacts across diverse stacks.

**Deliverable**: `meta/personas/` (6), `meta/workflows/` (13), `meta/templates/` (7), `meta/tool-specs/` (3), `meta/store-schema/` (4).

### M2 — Init Engine Complete

`/forge init` can be run and produces output. The generation quality may not be perfect yet — that's what validation is for.

**Deliverable**: `init/` fully wired. `/forge init` runs end-to-end on a test project.

### M3 — First Successful Init

`/forge init` on a real project produces a working SDLC instance. The developer can review the knowledge base, run `/sprint-plan`, and execute a task through the full pipeline.

**Deliverable**: one project (likely WalkInto) running on Forge-generated workflows.

### M4 — Cross-Stack Validation

`/forge init` works on at least 3 different stacks (Node.js, Python, Go). Generated tools execute correctly. Generated workflows reference the correct stack-specific commands.

**Deliverable**: validation reports from 3 projects.

### M5 — Self-Enhancement Validated

A project runs 3 sprints on Forge. The stack checklist grows. The knowledge base accuracy increases. The Supervisor's reviews reference project-specific patterns discovered during work.

**Deliverable**: before/after comparison of knowledge base at Sprint 1 vs Sprint 3.

---

## Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | `/forge init` → working SDLC in under 1 hour | Time from command to first `/sprint-plan` |
| 2 | Generated workflows reference the project's actual stack, entities, commands | Manual review — no generic placeholders |
| 3 | Generated tools work in Python, Node.js, and Go | Tool executes and produces correct output |
| 4 | Smoke test catches structural issues and self-corrects | Init report shows corrections |
| 5 | Stack checklist grows across 3 sprints without manual curation | Line count comparison |
| 6 | Supervisor reviews cite project-specific patterns by Sprint 2 | Review content analysis |
| 7 | Second developer joins and uses the SDLC with no additional setup | Onboarding test |
| 8 | WalkInto's workflow behaviour is reproducible from meta-definitions | Output comparison |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Meta-definitions are too abstract → generated workflows are generic | Medium | High | Test on 3 diverse stacks early. Include concrete examples in generation instructions. |
| Discovery accuracy too low for complex projects | Medium | Medium | Conservative confidence ratings. `[?]` markers. Human review step is mandatory, not optional. |
| Generated tools have bugs in untested languages | Medium | Medium | LLM fallback for all tools. Generated tools include basic self-tests. |
| Context window limits during init (many files to scan) | Low | Medium | Discovery prompts scope their scans. Don't try to read every file — sample. |
| Teams customise generated workflows then can't update | Low | Low | `/forge regenerate` shows diffs. Never auto-overwrite. |
| Knowledge writeback produces noise | Medium | Medium | Start conservative (high-confidence only). Retrospective reviews and prunes. |

---

## What Comes After v1

Ideas for future versions (not in scope for initial release):

- **`/forge health` dashboard** — knowledge base currency and coverage metrics
- **Multi-repo support** — monorepo with multiple services, each with its own SDLC instance
- **Team mode** — role assignment to team members (Alice is Engineer, Bob is Supervisor)
- **Integration with external trackers** — sync sprint/task state with Linear, Jira, GitHub Projects
- **Community meta-definitions** — stack-specific meta-workflow extensions (Django pack, Rails pack, Go pack)
- **Metrics dashboard** — sprint velocity, bug trends, review iteration rates over time

---

**Back to**: [README.md](../README.md)
