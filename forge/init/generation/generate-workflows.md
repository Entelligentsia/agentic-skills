# Generation: Atomic Workflows

## Purpose

Generate project-specific workflow files from meta-workflows, incorporating
persona context, templates, and the knowledge base.

## Inputs

- `$FORGE_ROOT/meta/workflows/meta-*.md` (13 meta-workflows)
- Persona context (from Phase 3)
- Generated templates (from Phase 4)
- Discovery context (from Phase 1)
- Generated knowledge base (from Phase 2)

## Outputs

`.forge/workflows/` with 14 project-specific workflow files:
- `engineer_plan_task.md`
- `engineer_implement_plan.md`
- `engineer_update_plan.md`
- `engineer_update_implementation.md`
- `engineer_fix_bug.md`
- `engineer_commit_task.md`
- `supervisor_review_plan.md`
- `supervisor_review_implementation.md`
- `architect_sprint_plan.md`
- `architect_approve.md`
- `architect_review_sprint_completion.md`
- `collator_agent.md`
- `sprint_retrospective.md`
- `quiz_agent.md`

## Instructions

For each meta-workflow:
1. Read its Algorithm and Generation Instructions
2. Embed the project-specific persona as the opening section
3. Replace all placeholders with concrete project values:
   - `{SYNTAX_CHECK}` → project's syntax checker
   - `{TEST_COMMAND}` → project's test runner
   - `{BUILD_COMMAND}` → project's build step
4. Reference architecture sub-docs by their actual names
5. Reference entities by their actual names
6. Reference templates by their actual paths in `.forge/templates/`
7. Include the Knowledge Writeback step in every workflow
8. Include the Event Emission step in every workflow
