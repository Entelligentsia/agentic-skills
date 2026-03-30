# Store Schema: Sprint

## File Location

`.forge/store/sprints/{SPRINT_ID}.json`

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sprintId` | string | yes | e.g. `S01` |
| `title` | string | yes | Sprint title |
| `description` | string | no | Sprint goals |
| `status` | enum | yes | See status values below |
| `taskIds` | string[] | yes | Ordered list of task IDs in this sprint |
| `dependencies` | object | no | Task dependency edges for wave computation |
| `executionMode` | enum | no | `sequential` / `wave-parallel` / `full-parallel` |
| `createdAt` | string | yes | ISO 8601 timestamp |
| `completedAt` | string | no | ISO 8601 timestamp |
| `humanEstimates` | object | no | `{ total: "Xh", breakdown: { taskId: "Yh" } }` |

## Status Values

`planning` → `active` → `completed` → `retrospective-done`

Failed states: `blocked`, `partially-completed`
