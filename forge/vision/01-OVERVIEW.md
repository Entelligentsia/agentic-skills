# 01 — Overview

**Forge** is a meta-system that generates project-specific software development lifecycles for Claude Code.

---

## The Problem

AI coding assistants are powerful but stateless. They don't know your project's conventions, entities, review standards, or deployment pipeline. Every session starts from zero. The developer carries the context.

Teams that want structured multi-agent workflows (plan → review → implement → review → approve → ship) face a bootstrapping problem: the workflows need deep project knowledge to be useful, but building that knowledge base is a manual, time-consuming process that most teams never start.

## The Solution

Forge eliminates the bootstrapping problem. It:

1. **Scans** the existing codebase to discover what's already there
2. **Generates** a project-specific SDLC instance — not generic templates, but workflows that reference your actual stack, entities, and commands
3. **Gets smarter** with every task — agents write back what they discover about the project

## What Forge Is NOT

- **Not a CI/CD tool** — it doesn't build, deploy, or run pipelines. It orchestrates AI agents that plan, write, and review code.
- **Not a project management tool** — it doesn't replace Jira, Linear, or GitHub Projects. It provides the engineering lifecycle underneath.
- **Not a linter or formatter** — it doesn't enforce style. It generates agent personas that understand your style.
- **Not a one-time scaffolder** — the generated instance is alive. It evolves with the project.

## Who It's For

- **Solo developers** who want structured engineering practice without the overhead of maintaining it manually
- **Small teams (2-8)** who want consistent code quality across contributors without writing review guidelines from scratch
- **Any team adopting AI-assisted development** who wants agents that know their project, not just their language

## How It Works (30-Second Version)

```
Install Forge → Run /forge:init → Review generated knowledge base → Run /sprint-plan → Work
```

Under the hood:

```
/forge:init
  ├─ Scans codebase (Glob, Grep, Read)
  ├─ Generates knowledge base (architecture, entities, review checklist)
  ├─ Generates agent personas (Engineer, Supervisor, Architect — project-specific)
  ├─ Generates workflows (plan, implement, review — with your test/build commands)
  ├─ Generates orchestration (pipeline wiring phases together)
  ├─ Generates tools (collation, validation — in your language)
  ├─ Generates commands (/engineer, /supervisor, /implement, /commit...)
  └─ Runs smoke test (verifies everything connects)
```

Then, every sprint:

```
Agents work → Agents discover project knowledge → Agents write it back → Next sprint is better
```

---

**Next**: [02-ORIGIN-STORY.md](02-ORIGIN-STORY.md) — How WalkInto's AI-SDLC became Forge
