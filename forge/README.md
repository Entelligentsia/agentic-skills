# Forge

**A self-enhancing AI software development lifecycle for Claude Code.**

Forge takes a codebase and generates a complete, project-specific engineering practice: agent personas, workflows, document templates, review checklists, and deterministic tools — all tailored to the project's stack, entities, and conventions.

It then gets smarter with every task it executes.

## What Forge Does

```
Your codebase → /forge:init → Complete SDLC instance → Self-enhancing flywheel
```

1. **Scans** your project to discover stack, entities, routes, tests, build pipeline
2. **Generates** a knowledge base (~60% accurate on Day 1, improving with every sprint)
3. **Generates** project-specific agent workflows, templates, and tools in your stack's language
4. **Runs** a multi-agent lifecycle: Engineer plans → Supervisor reviews → Engineer implements → Supervisor reviews code → Architect approves
5. **Learns** — every workflow writes back what it discovers about the project

## Installation

### Prerequisites

- [Claude Code](https://claude.ai/code) v1.0.33 or later
- The `agentic-skills` marketplace registered (one-time setup)

### Register the marketplace

If you haven't used any `agentic-skills` plugins before, register the marketplace first. Add this to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "extraKnownMarketplaces": {
    "agentic-skills": {
      "source": {
        "source": "github",
        "repo": "Entelligentsia/agentic-skills"
      }
    }
  }
}
```

### Install the plugin

```
/plugin install forge@agentic-skills
```

This installs Forge globally, making the `/forge:*` commands available in any project directory.

### Verify

Run `/help` — you should see `forge:init`, `forge:regenerate`, `forge:update-tools`, and `forge:health` listed.

## Usage: New Codebase

You have a project with code but no structured engineering practice. Forge will discover what's there and generate everything.

### 1. Run init

```
cd /path/to/your/project
/forge:init
```

Forge runs 9 phases automatically (~10-15 minutes, no interaction needed):

| Phase | What Happens |
|-------|-------------|
| 1. Discover | Scans package.json, models, routes, tests, CI config |
| 2. Knowledge Base | Generates architecture docs, entity model, stack checklist |
| 3. Personas | Generates project-specific agent identities |
| 4. Templates | Generates document templates with stack-specific sections |
| 5. Workflows | Generates 14 agent workflows with your commands and paths |
| 6. Orchestration | Wires the task pipeline and sprint scheduler |
| 7. Commands | Creates `/engineer`, `/supervisor`, `/sprint-plan`, etc. |
| 8. Tools | Generates collate/validate/seed tools in your language |
| 9. Smoke Test | Validates everything connects, self-corrects if needed |

### 2. Review the knowledge base

This is the most important step. Forge generates documentation with ~60% accuracy on Day 1. Spend 30-45 minutes reviewing:

```
engineering/
  architecture/           ← review stack.md, database.md, routing.md
  business-domain/        ← review entity-model.md
  stack-checklist.md      ← review initial review criteria
```

Lines marked `[?]` need your attention — Forge flags what it wasn't sure about.

### 3. Plan your first sprint

```
/sprint-plan
```

The Architect agent reads the knowledge base and helps you define tasks with estimates, dependencies, and a dependency graph.

### 4. Work

```
/run-task ACME-S01-T01
```

This drives the task through the full pipeline: Plan → Review → Implement → Review → Approve → Commit. Or run individual phases:

```
/engineer ACME-S01-T01       # Engineer plans the task
/supervisor ACME-S01-T01     # Supervisor reviews the plan
/implement ACME-S01-T01      # Engineer implements
```

### 5. Close the sprint

```
/retrospective S01
```

The retrospective reviews all work, confirms `[?]` writebacks, promotes recurring patterns to the stack checklist, and proposes workflow improvements. By Sprint 3, the knowledge base is ~85% accurate and the Supervisor gives sharp, project-specific reviews.

## Usage: Existing Codebase with Engineering History

You already have an `engineering/` directory with sprint artifacts, task history, or documentation from a previous workflow. Forge will discover and incorporate it.

### 1. Run init (same command)

```
cd /path/to/your/project
/forge:init
```

Forge's discovery phase detects existing structure:
- Existing `engineering/architecture/` docs are read and incorporated (not overwritten)
- Existing sprint directories in `engineering/sprints/` are preserved
- Existing bug directories in `engineering/bugs/` are preserved

### 2. Seed the store (if you have existing artifacts)

If you have sprint/task artifacts but no JSON store, seed it:

```
/collate
```

Or run the seed tool directly:

```
python engineering/tools/seed_store.py
```

This scans your existing `engineering/sprints/` and `engineering/bugs/` directories and creates the corresponding JSON records in `.forge/store/`.

### 3. Review and correct

The knowledge base generation is additive — it won't overwrite existing docs you've already written. Review the generated files for anything that conflicts with your existing documentation and correct as needed.

### 4. Continue as normal

From here the workflow is identical: `/sprint-plan`, `/run-task`, `/retrospective`.

## What Gets Generated

```
.forge/                              SDLC infrastructure
  config.json                        Project configuration (stack, commands, paths)
  store/                             JSON database (sprints, tasks, bugs, events)
  workflows/                         14 agent workflow files
  templates/                         7 document templates

engineering/                         Project knowledge (human-readable)
  architecture/                      Stack, processes, database, routing, deployment docs
  business-domain/                   Entity model, domain rules
  stack-checklist.md                 Self-growing review checklist
  MASTER_INDEX.md                    Project navigation hub
  sprints/                           Task work artifacts (PLAN.md, PROGRESS.md, etc.)
  bugs/                              Bug work artifacts
  tools/                             Generated tools in your language

.claude/
  commands/                          Standalone slash commands (/engineer, /sprint-plan, etc.)
```

## Forge Commands

| Command | Purpose |
|---------|---------|
| `/forge:init` | Bootstrap the SDLC for the current project |
| `/forge:regenerate` | Re-generate workflows/templates from the enriched knowledge base |
| `/forge:update-tools` | Apply updated tool specs, show diff before overwriting |
| `/forge:health` | Assess knowledge base currency and coverage |

## Generated Project Commands

After init, these standalone commands are available (no namespace prefix):

| Command | Agent | Purpose |
|---------|-------|---------|
| `/engineer {TASK_ID}` | Engineer | Plan a task |
| `/implement {TASK_ID}` | Engineer | Implement the approved plan |
| `/supervisor {TASK_ID}` | Supervisor | Review plan or implementation |
| `/fix-bug {BUG_ID}` | Engineer | Triage and fix a bug |
| `/approve {TASK_ID}` | Architect | Final sign-off |
| `/commit {TASK_ID}` | Engineer | Stage and commit |
| `/sprint-plan` | Architect | Plan a new sprint |
| `/run-task {TASK_ID}` | Orchestrator | Drive a task through the full pipeline |
| `/run-sprint {SPRINT_ID}` | Orchestrator | Execute a sprint (sequential or parallel) |
| `/collate [SPRINT_ID]` | Collator | Regenerate markdown views from the store |
| `/retrospective {SPRINT_ID}` | Architect | Sprint closure and learning |

## The Self-Enhancement Flywheel

Forge doesn't just generate a static system. Every agent writes back what it discovers:

- The **Supervisor** adds to the stack checklist when it catches a new pattern
- The **Bug Fixer** tags root cause categories and adds preventive checks
- The **Retrospective** promotes recurring patterns and prunes stale rules
- The **Engineer** updates architecture docs when it discovers undocumented patterns

The stack checklist starts with 5-10 auto-detected items. By Sprint 3, it has 25+ items — all earned from real project experience.

```
Sprint 1:  "Check @login_required on APIViews"
Sprint 3:  + "Celery tasks use shared_task with bind=True"
           + "Stripe webhooks verify event signature"
           + "Date fields stored as UTC, converted in templates only"
           + "API responses use { status, data, message } envelope"
```

## Supported Stacks

Forge works with any codebase Claude Code can read. The discovery phase detects and adapts to:

- **Python** — Django, FastAPI, Flask
- **JavaScript/TypeScript** — Express, Next.js, Nuxt, React, Vue
- **Go** — standard library, Gin, Echo
- **Ruby** — Rails
- **Rust** — Actix, Axum
- **Any combination** — full-stack projects with multiple languages

Generated tools are produced in the project's primary language. The knowledge base and workflows are Markdown — language-agnostic.

## Development

### Test locally without installing

```bash
claude --plugin-dir ./forge
```

Then run `/forge:init` in any project directory.

### Reload after changes

```
/reload-plugins
```

## Origin

Forge was distilled from the AI-SDLC system built at [WalkInto](https://walkinto.in), a 360° virtual tour SaaS platform. After 28 sprints, 100+ tasks, and 90+ bugs managed through a multi-agent system with 7 roles and 20 workflows, the patterns were generalised into a meta-system that can bootstrap itself into any codebase.

## Vision Documents

| Document | Purpose |
|----------|---------|
| [01-OVERVIEW.md](vision/01-OVERVIEW.md) | What Forge is and why it exists |
| [02-ORIGIN-STORY.md](vision/02-ORIGIN-STORY.md) | How WalkInto's AI-SDLC became Forge |
| [03-META-GENERATOR.md](vision/03-META-GENERATOR.md) | The meta-definition architecture |
| [04-INIT-FLOW.md](vision/04-INIT-FLOW.md) | The 9 phases of `/forge:init` |
| [05-SELF-ENHANCEMENT.md](vision/05-SELF-ENHANCEMENT.md) | The learning flywheel |
| [06-TOOL-GENERATION.md](vision/06-TOOL-GENERATION.md) | Spec-driven tool generation |
| [07-PLUGIN-STRUCTURE.md](vision/07-PLUGIN-STRUCTURE.md) | What ships in the package |
| [08-IMPLEMENTATION-PLAN.md](vision/08-IMPLEMENTATION-PLAN.md) | Build sequence and success criteria |
| [09-ORCHESTRATION.md](vision/09-ORCHESTRATION.md) | Configurable task pipeline and parallel sprint scheduler |

## License

MIT
