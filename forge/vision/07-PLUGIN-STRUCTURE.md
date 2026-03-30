# 07 — Plugin Structure

What ships in the Forge package and how it's organised.

---

## Package Layout

```
forge/
  plugin.json                          Package metadata
  sdlc-config.schema.json              JSON Schema for project configuration
  README.md                            Installation and quick start

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

### Meta-Definitions (`meta/`)

These are the core intellectual property of Forge. They define **what** the SDLC does — the roles, algorithms, document structures, and data models — without specifying any project-specific details.

- **Read by**: the generation prompts during `/forge init`
- **Modified by**: Forge maintainers when the SDLC process evolves
- **Never modified by**: end-user projects

### Init Prompts (`init/`)

These are the orchestration logic for `/forge init`. They tell the LLM how to scan a project and how to use the meta-definitions + discovery results to generate project-specific artifacts.

- **Read by**: the LLM during `/forge init`
- **Modified by**: Forge maintainers to improve discovery accuracy or generation quality
- **Never modified by**: end-user projects

### Generated Artifacts (in the user's project)

Everything that `/forge init` produces lives in the user's project repo, not in the plugin. These are first-class project files:

```
User's project/
  sdlc-config.json                     ← generated, user reviews
  engineering/                         ← generated knowledge base, user reviews and corrects
  .agent/workflows/                    ← generated workflows, project-specific
  .claude/commands/                    ← generated commands, project-specific
  ai-sdlc/templates/                   ← generated templates, project-specific
  engineering/tools/                   ← generated tools, in project's language
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
# Install the Forge plugin
/plugin install forge@agentic-skills

# Bootstrap into your project
/forge init
```

### Manual (from Git)

```bash
# Clone the skills repo
git clone https://github.com/Entelligentsia/agentic-skills.git ~/.claude/plugins/agentic-skills

# Run init
/forge init
```

### After Installation

Forge adds one command: `/forge init`. After init completes, the generated commands (`/engineer`, `/supervisor`, `/implement`, `/sprint-plan`, etc.) are available in the project.

---

## Versioning

### Plugin Version

`plugin.json` tracks the Forge version:

```json
{
  "name": "forge",
  "version": "1.0.0",
  "description": "Self-enhancing AI software development lifecycle",
  "author": "Entelligentsia",
  "commands": ["forge"]
}
```

### Config Version

`sdlc-config.json` includes a version field:

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
/forge update-tools     # regenerate tools from latest specs
/forge regenerate       # regenerate workflows from meta-definitions + current knowledge base
```

Both commands show diffs and ask for confirmation before overwriting.

---

## Relationship to Other Agentic Skills

Forge is different from the other skills in the `agentic-skills` marketplace:

| Package | Type | How It Works |
|---------|------|-------------|
| `meta-webxr-skills` | Reference skills | Loaded into context when triggered by keywords |
| `threejs-skills` | Reference skills | Loaded into context when triggered by keywords |
| **`forge`** | **Meta-generator** | Generates project-specific artifacts at init time |

Forge's generated workflows can coexist with other skills. A project might use `threejs-skills` for 3D development guidance AND Forge for its engineering lifecycle.

---

**Next**: [08-IMPLEMENTATION-PLAN.md](08-IMPLEMENTATION-PLAN.md) — Build sequence and success criteria
