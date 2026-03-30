# Forge

**A self-enhancing AI software development lifecycle for Claude Code.**

Forge takes an existing codebase and generates a complete, project-specific engineering practice: agent personas, workflows, document templates, review checklists, and deterministic tools — all tailored to the project's stack, entities, and conventions.

It then gets smarter with every task it executes.

## What Forge Does

```
Your codebase → /forge init → Complete SDLC instance → Self-enhancing flywheel
```

1. **Scans** your project to discover stack, entities, routes, tests, build pipeline
2. **Generates** a knowledge base (~60% accurate on Day 1, improving with every sprint)
3. **Generates** project-specific agent workflows, templates, and tools in your stack's language
4. **Runs** a multi-agent lifecycle: Engineer plans, Supervisor reviews, Engineer implements, Supervisor reviews code, Architect approves
5. **Learns** — every workflow writes back what it discovers about the project

## Origin

Forge was distilled from the AI-SDLC system built at [WalkInto](https://walkinto.in), a 360° virtual tour SaaS platform. After 28 sprints, 100+ tasks, and 90+ bugs managed through this system, the workflows, personas, and patterns were generalised into a meta-system that can bootstrap itself into any codebase.

## Status

**Vision phase.** See [vision/](./vision/) for the complete design.

## Quick Taste

After installation, Maya runs:

```
/forge init
```

Forge scans her Django+React codebase, discovers 47 models and 89 API views, detects pytest+jest, reads her CI config, spots `@login_required` on 71/89 views, and generates:

- Architecture docs, entity model, and a review checklist
- An Engineer persona that knows Django/DRF conventions
- A Supervisor persona that checks `@login_required` on APIViews
- Workflows with `pytest && npm test` in the test gates
- A Python collation tool for index regeneration
- Slash commands: `/engineer`, `/supervisor`, `/implement`, `/commit`, `/sprint-plan`...

She reviews the knowledge base (~45 minutes), runs `/sprint-plan`, and is productive.

By Sprint 3, the stack checklist has 25 items — all discovered by agents during real work, not manually curated. The Supervisor gives sharp, project-specific reviews. A new developer reads the knowledge base and is productive on Day 1.

## Vision Documents

| Document | Purpose |
|----------|---------|
| [01-OVERVIEW.md](vision/01-OVERVIEW.md) | What Forge is and why it exists |
| [02-ORIGIN-STORY.md](vision/02-ORIGIN-STORY.md) | How WalkInto's AI-SDLC became Forge |
| [03-META-GENERATOR.md](vision/03-META-GENERATOR.md) | The meta-definition architecture |
| [04-INIT-FLOW.md](vision/04-INIT-FLOW.md) | The 9 phases of `/forge init` |
| [05-SELF-ENHANCEMENT.md](vision/05-SELF-ENHANCEMENT.md) | The learning flywheel |
| [06-TOOL-GENERATION.md](vision/06-TOOL-GENERATION.md) | Spec-driven tool generation |
| [07-PLUGIN-STRUCTURE.md](vision/07-PLUGIN-STRUCTURE.md) | What ships in the package |
| [08-IMPLEMENTATION-PLAN.md](vision/08-IMPLEMENTATION-PLAN.md) | Build sequence and success criteria |
| [09-ORCHESTRATION.md](vision/09-ORCHESTRATION.md) | Configurable task pipeline and parallel sprint scheduler |

## License

MIT
