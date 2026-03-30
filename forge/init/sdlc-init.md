# Forge Init — Master Orchestration

You are bootstrapping a complete AI-SDLC instance for the project in the
current working directory. Execute these 9 phases in order.

Set `$FORGE_ROOT` to the forge plugin directory (the parent of this file's
directory — the folder containing `meta/` and `init/`).

---

## Phase 1 — Discover

Run the 5 discovery prompts in parallel. Each reads from `$FORGE_ROOT/init/discovery/`.

| Prompt | File | Produces |
|--------|------|----------|
| Stack | `discover-stack.md` | Languages, frameworks, versions, runtime |
| Processes | `discover-processes.md` | Service topology, build/deploy commands |
| Database | `discover-database.md` | Entity inventory, relationships, field types |
| Routing | `discover-routing.md` | API surface map, auth strategy |
| Testing | `discover-testing.md` | Test framework, test/build/lint commands |

**Output**: `.forge/config.json` (assembled from discovery results) + internal discovery context.

Validate the config against `$FORGE_ROOT/sdlc-config.schema.json`.

---

## Phase 2 — Generate Knowledge Base

Read `$FORGE_ROOT/init/generation/generate-knowledge-base.md` and follow it.

**Input**: discovery context + meta-personas (for understanding what agents need to know)
**Output**: `engineering/architecture/`, `engineering/business-domain/`, `engineering/stack-checklist.md`

Also scaffold: `.forge/store/` directories, `engineering/sprints/`, `engineering/bugs/`, `engineering/tools/`.

---

## Phase 3 — Generate Personas

Read `$FORGE_ROOT/init/generation/generate-personas.md` and follow it.

**Input**: `$FORGE_ROOT/meta/personas/` + discovery context + generated knowledge base
**Output**: Persona context embedded into workflow generation (Phase 5)

---

## Phase 4 — Generate Templates

Read `$FORGE_ROOT/init/generation/generate-templates.md` and follow it.

**Input**: `$FORGE_ROOT/meta/templates/` + discovery context + knowledge base
**Output**: `.forge/templates/`

---

## Phase 5 — Generate Atomic Workflows

Read `$FORGE_ROOT/init/generation/generate-workflows.md` and follow it.

**Input**: `$FORGE_ROOT/meta/workflows/` + personas + templates + discovery context + knowledge base
**Output**: `.forge/workflows/` (14 project-specific workflow files)

---

## Phase 6 — Generate Orchestration

Read `$FORGE_ROOT/init/generation/generate-orchestration.md` and follow it.

**Input**: `$FORGE_ROOT/meta/workflows/meta-orchestrate.md` + generated atomic workflows
**Output**: `.forge/workflows/orchestrate_task.md`, `.forge/workflows/run_sprint.md`

---

## Phase 7 — Generate Commands

Read `$FORGE_ROOT/init/generation/generate-commands.md` and follow it.

**Input**: generated workflows
**Output**: `.claude/commands/` (standalone, non-namespaced slash commands)

---

## Phase 8 — Generate Tools

Read `$FORGE_ROOT/init/generation/generate-tools.md` and follow it.

**Input**: `$FORGE_ROOT/meta/tool-specs/` + `.forge/config.json`
**Output**: `engineering/tools/` (collate, seed-store, validate-store in project's language)

---

## Phase 9 — Smoke Test

Read `$FORGE_ROOT/init/smoke-test.md` and follow it.

Validates structural completeness, referential integrity, tool execution,
and template coherence. Self-corrects up to once per failing component.

---

## Report

After all phases complete, report to the user:
- Knowledge base: doc count, entity count, checklist item count
- Generated artifacts: workflow count, command count, template count, tool count
- Smoke test results
- Confidence rating
- Next step: review `engineering/` docs, then run `/sprint-plan`
