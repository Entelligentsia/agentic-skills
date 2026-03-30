---
description: Assess knowledge base currency and coverage
---

# /forge:health

Assess the health and currency of the project's SDLC knowledge base.

## Checks

| Check | What It Detects |
|-------|----------------|
| **Stale docs** | Architecture sub-docs not updated in N sprints |
| **Orphaned entities** | Entities in code (ORM models, types) not in `engineering/business-domain/entity-model.md` |
| **Unused checklist items** | Stack-checklist items never triggered in reviews |
| **Coverage gaps** | Architecture areas with no sub-document |
| **Writeback backlog** | `[?]` items not yet confirmed by a retrospective |
| **Store integrity** | Run `engineering/tools/validate-store --dry-run` if the tool exists |

## How to run

1. Read `.forge/config.json` for paths
2. Read the knowledge base files in `engineering/`
3. Read the store in `.forge/store/` for sprint/task history
4. Scan the codebase for entities not in the knowledge base (Grep for model/type definitions)
5. Report findings with actionable recommendations

## Output

A health report to stdout — no files modified.

## Arguments

$ARGUMENTS
