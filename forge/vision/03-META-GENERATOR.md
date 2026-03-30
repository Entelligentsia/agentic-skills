# 03 — The Meta-Generator Architecture

Forge doesn't ship workflows. It ships **meta-definitions** that generate project-specific workflows.

---

## The Key Distinction

| Approach | What ships | What the project gets |
|----------|-----------|----------------------|
| **Tokenisation** | `Read {{DOMAIN_INDEX}} to identify...` | Workflows with placeholders resolved at runtime |
| **Meta-generation** | "The Engineer reads business domain docs to identify relevant entities" | `Read engineering/business-domain/INDEX.md — covers Workspace, Team, Dashboard, Subscription entities` |

Meta-generation produces workflows that are **native to the project from Day 1**. No tokens. No runtime resolution. The generated files reference the project's actual paths, entities, commands, and conventions.

---

## What Forge Ships

```
forge/
  meta/
    personas/           What each agent IS
    workflows/          What each workflow step ACHIEVES
    templates/          What each document CONTAINS
    tool-specs/         What each deterministic tool COMPUTES
    store-schema/       What the JSON data model LOOKS LIKE
  init/                 How to bootstrap into a project
```

### Meta-Personas (6)

A meta-persona defines the role's **responsibilities, knowledge requirements, outputs, and generation instructions**.

| Meta-Persona | Generates |
|--------------|-----------|
| `meta-engineer.md` | Engineer persona that knows the project's stack, test commands, build pipeline |
| `meta-supervisor.md` | Supervisor persona that reviews against the project's checklist and conventions |
| `meta-architect.md` | Architect persona that plans sprints using the project's entity model and architecture |
| `meta-orchestrator.md` | Orchestrator that wires phases with the project's specific gate conditions |
| `meta-collator.md` | Collator that regenerates views from the project's store |
| `meta-bug-fixer.md` | Bug fixer that triages using the project's domain knowledge |

#### Example: Meta-Engineer (abbreviated)

```markdown
# Meta-Persona: Engineer

## Role
The Engineer reads task requirements, plans implementation approaches,
writes code, runs tests, and documents progress.

## What the Engineer Needs to Know
- The project's technology stack and conventions
- The project's entity model and business rules
- The project's test framework and how to run tests
- The project's build pipeline
- How to verify syntax in the project's language(s)

## What the Engineer Produces
- PLAN.md — technical approach before coding
- Code changes — implementing the approved plan
- PROGRESS.md — what was done, test evidence, files changed

## Generation Instructions
When generating a project-specific Engineer persona, incorporate:
- The specific syntax check command for the project's language(s)
- The specific test command(s) and build command
- The specific auth pattern to verify
- Key entity names from the business domain
- Data access layer patterns (ORM, query builder, raw SQL convention)
```

The LLM reads this + the discovered project and generates:

> "You are the Engineer Agent. This project uses Django 4.2 with DRF for the API layer and React 18 for the frontend. Database access is through Django ORM — never raw SQL. Tests: `pytest` (backend) and `npm test` (frontend). Build: `npm run build`. Auth: `@login_required` on all views, `IsAuthenticated` on all API endpoints. Key entities: Workspace, Team, Dashboard, Subscription."

### Meta-Workflows (13)

A meta-workflow defines the **algorithm** — the sequence of steps and what each achieves. It does NOT define project-specific paths, commands, or entity names.

| Meta-Workflow | Purpose |
|---------------|---------|
| `meta-plan-task.md` | Read context → research code → produce implementation plan |
| `meta-review-plan.md` | Check feasibility, security, architecture alignment |
| `meta-implement.md` | Code → test → verify → document |
| `meta-review-implementation.md` | Correctness, security, conventions, business rules |
| `meta-update-plan.md` | Revise plan based on review feedback |
| `meta-update-implementation.md` | Fix code based on review feedback |
| `meta-approve.md` | Architect sign-off on completed task |
| `meta-commit.md` | Stage and commit task artifacts |
| `meta-fix-bug.md` | Triage, analyse, plan fix, implement fix |
| `meta-sprint-plan.md` | Initialise sprint with tasks, estimates, dependencies |
| `meta-orchestrate.md` | Wire phases into automated pipeline |
| `meta-retrospective.md` | Sprint closure, learning, knowledge base update |
| `meta-collate.md` | Regenerate markdown views from JSON store |

#### Example: Meta-Implement (abbreviated)

```markdown
# Meta-Workflow: Implement Plan

## Algorithm

Step 1 — Load Context
  Read architecture docs relevant to the task.
  Read business domain docs relevant to the task.
  Read the approved PLAN.md.

Step 2 — Implement
  Follow the plan. Write code.

Step 3 — Verify
  Run syntax verification: {SYNTAX_CHECK}
  Run test suite: {TEST_COMMAND}
  Run build if frontend assets modified: {BUILD_COMMAND}

Step 4 — Document
  Write PROGRESS.md with test evidence and file manifest.

Step 5 — Knowledge Writeback
  Update architecture/business-domain/stack-checklist if discoveries made.

Step 6 — Emit Event + Update State

## Generation Instructions
- Replace {SYNTAX_CHECK} with project's checker (py_compile, node --check, go vet...)
- Replace {TEST_COMMAND} with project's test runner
- Replace {BUILD_COMMAND} with project's build step
- Reference specific architecture sub-documents by name
- Reference specific entity names from business domain
- Include project-specific verification steps (Django: makemigrations --check)
```

### Meta-Templates (7)

A meta-template defines **what sections** a document needs. The generated template adds project-specific sections.

| Meta-Template | Generated Template Adds |
|---------------|------------------------|
| `meta-task-prompt.md` | Entity references, stack-specific acceptance criteria patterns |
| `meta-plan.md` | "Django Models", "DRF Serializers", "React Components" sections (for Django+React) |
| `meta-progress.md` | Test evidence expects pytest + jest output |
| `meta-code-review.md` | Loads stack-checklist.md for review criteria |
| `meta-plan-review.md` | Architecture sub-docs referenced by name |
| `meta-sprint-manifest.md` | Task ID format uses project prefix |
| `meta-retrospective.md` | References project's specific tech debt areas |

### Tool Specs (3)

Language-agnostic algorithms for deterministic operations:

| Spec | Algorithm |
|------|-----------|
| `collate.spec.md` | JSON store → MASTER_INDEX.md, TIMESHEET.md, INDEX.md files |
| `seed-store.spec.md` | Existing engineering/ directory → initial store JSON files |
| `validate-store.spec.md` | Store integrity check (required fields, referential integrity) |

### Store Schemas (4)

The JSON data model — same for every project:

| Schema | Key Fields |
|--------|-----------|
| `task.schema.md` | taskId, sprintId, title, status, path, knowledgeUpdates |
| `sprint.schema.md` | sprintId, title, status, taskIds, humanEstimates |
| `bug.schema.md` | bugId, title, severity, status, rootCauseCategory, similarBugs |
| `event.schema.md` | eventId, taskId, role, action, timestamps, duration |

---

## How Generation Works

The LLM at init time reads:

1. **The meta-definition** — what the component should be
2. **The discovery context** — what was found in the project (stack, entities, commands)
3. **The generated knowledge base** — architecture and business domain docs

And produces a project-specific artifact. The meta-definition includes a `## Generation Instructions` section that tells the LLM what to incorporate from the discovery context.

```
meta-engineer.md          ─┐
                            ├─ LLM generates → .agent/workflows/engineer_plan_task.md
discovery context          ─┤                   (references Django, pytest, Workspace entity...)
                            │
knowledge base (generated) ─┘
```

The generation is **one-shot per component**. After init, the generated files are first-class project artifacts — version-controlled, editable, debuggable. The meta-definitions are only consulted during init and regeneration.

---

**Next**: [04-INIT-FLOW.md](04-INIT-FLOW.md) — The 9 phases of `/forge init`
