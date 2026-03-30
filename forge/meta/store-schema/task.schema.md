# Store Schema: Task

## File Location

`.forge/store/tasks/{TASK_ID}.json`

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `taskId` | string | yes | e.g. `ACME-S01-T01` |
| `sprintId` | string | yes | e.g. `S01` |
| `title` | string | yes | Task title |
| `description` | string | no | Detailed description |
| `status` | enum | yes | See status values below |
| `path` | string | yes | Relative path to task artifact directory |
| `estimate` | enum | no | `S` / `M` / `L` / `XL` |
| `dependencies` | string[] | no | Task IDs this task depends on |
| `knowledgeUpdates` | object[] | no | Files updated during writeback |
| `planIterations` | integer | no | Number of plan review loops |
| `codeReviewIterations` | integer | no | Number of code review loops |
| `assignedModel` | string | no | Model used for implementation |

## Status Values

`draft` → `planned` → `plan-approved` → `implementing` → `implemented` → `review-approved` → `approved` → `committed`

Failed states: `plan-revision-required`, `code-revision-required`, `blocked`, `escalated`

## Knowledge Updates Schema

```json
{
  "file": "architecture/stack.md",
  "section": "Celery Patterns",
  "type": "addition | correction | removal"
}
```
