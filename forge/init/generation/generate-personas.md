# Generation: Personas

## Purpose

Generate project-specific agent persona context from meta-personas,
the discovery context, and the generated knowledge base.

## Inputs

- `$FORGE_ROOT/meta/personas/meta-*.md` (6 meta-personas)
- Discovery context (from Phase 1)
- Generated knowledge base (from Phase 2)

## Outputs

Persona context is NOT written as separate files. It is incorporated
into the generated workflows (Phase 5) as the opening section of each
workflow that establishes the agent's identity, knowledge, and constraints.

This phase produces an intermediate persona context document used as
input to Phase 5.

## Instructions

For each meta-persona, read its Generation Instructions section and
produce a project-specific version that incorporates:
- The project's actual stack, test commands, build commands
- The project's actual entity names and business rules
- The project's actual auth patterns and conventions
- The project's actual directory structure and paths
