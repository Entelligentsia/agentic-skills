# Generation: Templates

## Purpose

Generate project-specific document templates from meta-templates,
adding stack-specific sections.

## Inputs

- `$FORGE_ROOT/meta/templates/meta-*.md` (7 meta-templates)
- Discovery context (from Phase 1)
- Generated knowledge base (from Phase 2)

## Outputs

`.forge/templates/` with project-specific templates:
- `TASK_PROMPT_TEMPLATE.md`
- `PLAN_TEMPLATE.md`
- `PROGRESS_TEMPLATE.md`
- `CODE_REVIEW_TEMPLATE.md`
- `PLAN_REVIEW_TEMPLATE.md`
- `SPRINT_MANIFEST_TEMPLATE.md`
- `RETROSPECTIVE_TEMPLATE.md`

## Instructions

For each meta-template:
1. Read its sections and Generation Instructions
2. Add framework-specific subsections based on the detected stack
3. Reference the project's actual entity names and test output formats
4. Use the project's ID format in template headers
