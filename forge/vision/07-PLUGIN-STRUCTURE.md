# 07 — Plugin Structure

What ships in the Forge package and how it's organised.

---

## Package Layout

```
forge/
  .claude-plugin/
    plugin.json                        Package metadata (manifest)
  sdlc-config.schema.json              JSON Schema for project configuration
  README.md                            Installation and quick start

  commands/                            ── FORGE COMMANDS (user-invoked) ──
    init.md                            /forge:init — bootstrap a project
    regenerate.md                      /forge:regenerate — re-generate from enriched knowledge base
    update-tools.md                    /forge:update-tools — apply updated tool specs
    health.md                          /forge:health — knowledge base currency report

  meta/                                ── THE CORE IP ──
    personas/                          Agent role definitions
      meta-engineer.md                 What an Engineer does, knows, produces
      meta-supervisor.md               What a Supervisor reviews and how
      meta-architect.md                What an Architect plans and approves
      meta-orchestrator.md             How the pipeline wires phases together
      meta-collator.md                 What collation produces and from what
      meta-bug-fixer.md                How bugs are triaged and fixed

    workflows/                         Lifecycle step algorithms
      meta-plan-task.md                Read context → research code → produce plan
      meta-review-plan.md              Check feasibility, security, architecture
      meta-implement.md                Code → test → verify → document
      meta-review-implementation.md    Review correctness, security, conventions
      meta-update-plan.md              Revise plan from feedback
      meta-update-implementation.md    Fix code from feedback
      meta-approve.md                  Architect sign-off
      meta-commit.md                   Stage and commit artifacts
      meta-fix-bug.md                  Triage → analyse → plan → fix
      meta-sprint-plan.md              Initialise sprint with tasks
      meta-orchestrate.md              Wire phases into pipeline
      meta-retrospective.md            Sprint closure and learning
      meta-collate.md                  Regenerate markdown views

    templates/                         Document structure definitions
      meta-task-prompt.md              What a task prompt contains
      meta-plan.md                     What an implementation plan contains
      meta-progress.md                 What a progress report contains
      meta-code-review.md              What a code review contains
      meta-plan-review.md              What a plan review contains
      meta-sprint-manifest.md          What a sprint manifest contains
      meta-retrospective.md            What a retrospective contains

    tool-specs/                        Deterministic tool algorithms
      collate.spec.md                  JSON store → markdown views
      seed-store.spec.md               Bootstrap store from existing structure
      validate-store.spec.md           Store integrity check

    store-schema/                      JSON data model
      task.schema.md                   Task fields, statuses, transitions
      sprint.schema.md                 Sprint fields
      bug.schema.md                    Bug fields
      event.schema.md                  Event fields

  init/                                ── THE BOOTSTRAP ENGINE ──
    sdlc-init.md                       Master orchestration (9 phases)

    discovery/                         Phase 1: scan the project
      discover-stack.md                Languages, frameworks, versions
      discover-processes.md            Services, topology, build tools
      discover-database.md             ORM models, schemas, migrations
      discover-routing.md              API routes, auth patterns
      discover-testing.md              Test frameworks, CI config

    generation/                        Phases 2-8: generate the instance
      generate-knowledge-base.md       Phase 2: architecture + business domain docs
      generate-personas.md             Phase 3: project-specific agent identities
      generate-templates.md            Phase 4: project-specific document formats
      generate-workflows.md            Phase 5: project-specific atomic workflows
      generate-orchestration.md        Phase 6: pipeline wiring
      generate-commands.md             Phase 7: slash commands
      generate-tools.md               Phase 8: deterministic tools in project language

    smoke-test.md                      Phase 9: validate and self-correct

  vision/                              Design documents (this folder)
    01-OVERVIEW.md
    02-ORIGIN-STORY.md
    03-META-GENERATOR.md
    04-INIT-FLOW.md
    05-SELF-ENHANCEMENT.md
    06-TOOL-GENERATION.md
    07-PLUGIN-STRUCTURE.md
    08-IMPLEMENTATION-PLAN.md
```

---

## File Categories

### Forge Commands (`commands/`)

User-invoked slash commands, namespaced under `forge:`. These are the only interface between the user and the plugin. Each command loads the relevant orchestration from `init/` and reads from `meta/` as needed during execution.

| Command | Purpose |
|---------|---------|
| `/forge:init` | Run the 9-phase bootstrap on the current project |
| `/forge:regenerate` | Re-generate workflows/templates from the enriched knowledge base |
| `/forge:update-tools` | Apply updated tool specs, show diff, prompt before overwriting |
| `/forge:health` | Assess knowledge base currency and coverage |

- **Invoked by**: the user, explicitly
- **Modified by**: Forge maintainers to improve UX or orchestration entry points

### Meta-Definitions (`meta/`)

These are the core intellectual property of Forge. They define **what** the SDLC does — the roles, algorithms, document structures, and data models — without specifying any project-specific details.

- **Read by**: `/forge:init` and `/forge:regenerate` during execution (via Read tool)
- **Modified by**: Forge maintainers when the SDLC process evolves
- **Never modified by**: end-user projects

### Init Prompts (`init/`)

These are the orchestration logic for `/forge:init`. They tell the LLM how to scan a project and how to use the meta-definitions + discovery results to generate project-specific artifacts.

- **Read by**: the LLM during `/forge:init` (via Read tool)
- **Modified by**: Forge maintainers to improve discovery accuracy or generation quality
- **Never modified by**: end-user projects

### Generated Artifacts (in the user's project)

Everything that `/forge:init` produces lives in the user's project repo, not in the plugin. These are first-class project files:

```
User's project/
  .forge/
    config.json                        ← generated, user reviews
    store/                             ← SDLC database (sprints, tasks, bugs, events)
    workflows/                         ← generated workflows, project-specific
    templates/                         ← generated templates, project-specific
  engineering/                         ← knowledge base, user reviews and corrects
    architecture/
    business-domain/
    stack-checklist.md
    MASTER_INDEX.md
    sprints/                           ← task work artifacts (PLAN.md, PROGRESS.md, etc.)
    bugs/                              ← bug work artifacts
    tools/                             ← generated tools, team-owned
  .claude/
    commands/                          ← generated commands, project-specific
```

- **Read by**: agents during normal SDLC operation
- **Modified by**: agents (knowledge writeback), developers (corrections), retrospective (improvements)
- **Owned by**: the project team

---

## What the Plugin Does NOT Ship

| Category | Why Not |
|----------|---------|
| Executable code | Generated at init time in project's language |
| Project-specific workflows | Generated from meta-definitions |
| DevOps runbooks | Too infrastructure-specific; projects add their own |
| Helpdesk integrations | Business tooling varies per organisation |
| IDE plugins | Forge works through Claude Code's existing plugin system |

---

## Installation

### From the Agentic Skills Marketplace

```bash
# Install the Forge plugin (user scope — available in all projects)
/plugin install forge@agentic-skills
```

This installs Forge globally, making the `/forge:*` commands available in any project directory.

### Bootstrap a project

Navigate to your project and run:

```bash
/forge:init
```

### After Installation

Forge adds four namespaced commands: `/forge:init`, `/forge:regenerate`, `/forge:update-tools`, `/forge:health`.

After `/forge:init` completes, the **generated** project commands are available as non-namespaced standalone commands (short names, no plugin prefix):

```
/engineer      /supervisor      /implement
/sprint-plan   /fix-bug         /collate
/retrospective /run-task        /run-sprint
```

These live in `.claude/commands/` in the project repo. They're first-class project files — not Forge commands.

### Development / Testing

```bash
# Load the plugin locally without installing
claude --plugin-dir ./forge
```

---

## Versioning

### Plugin Version

`.claude-plugin/plugin.json` tracks the Forge version:

```json
{
  "name": "forge",
  "version": "1.0.0",
  "description": "Self-enhancing AI software development lifecycle",
  "author": {
    "name": "Entelligentsia"
  }
}
```

### Config Version

`.forge/config.json` includes a version field:

```json
{
  "version": "1.0",
  ...
}
```

When the plugin evolves and the config schema changes, the version enables migration.

### Store Schema Version

The store schema is versioned in the schema docs. If Forge adds new fields to the task JSON (e.g., `knowledgeUpdates`), existing stores remain compatible — new fields are optional with defaults.

### Generated Artifact Updates

Generated workflows, templates, and tools are **not auto-updated** when the plugin updates. The user controls when to regenerate:

```bash
/forge:update-tools     # regenerate tools from latest specs
/forge:regenerate       # regenerate workflows from meta-definitions + current knowledge base
```

Both commands show diffs and ask for confirmation before overwriting.

---

## Relationship to Other Agentic Skills

Forge is different from the other skills in the `agentic-skills` marketplace:

| Package | Plugin Type | Commands | How It Works |
|---------|------------|----------|-------------|
| `meta-webxr-skills` | Skills (`skills/`) | None | Model-invoked via Skill tool when keywords match |
| `threejs-skills` | Skills (`skills/`) | None | Model-invoked via Skill tool when keywords match |
| **`forge`** | **Commands (`commands/`)** | `/forge:init`, `/forge:regenerate`, `/forge:update-tools`, `/forge:health` | User-invoked; reads plugin files at runtime to bootstrap or update a project |

Forge's generated workflows can coexist with other skills. A project might use `threejs-skills` for 3D development guidance AND Forge for its engineering lifecycle.

---

**Next**: [08-IMPLEMENTATION-PLAN.md](08-IMPLEMENTATION-PLAN.md) — Build sequence and success criteria
