# Store Schema: Event

## File Location

`.forge/store/events/{SPRINT_ID}/{EVENT_ID}.json`

## Event ID Format

`{ISO_TIMESTAMP}_{TASK_ID}_{ROLE}_{ACTION}`

Example: `20260415T141523000Z_ACME-S02-T03_engineer_implement`

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventId` | string | yes | Unique event identifier |
| `taskId` | string | yes | Task this event belongs to |
| `sprintId` | string | yes | Sprint this event belongs to |
| `role` | string | yes | Agent role (Engineer, Supervisor, Architect) |
| `action` | string | yes | Command invoked (e.g. `/implement`) |
| `phase` | string | yes | Pipeline phase (plan, review-plan, implement, etc.) |
| `iteration` | integer | yes | Which iteration of this phase (1-based) |
| `startTimestamp` | string | yes | ISO 8601 |
| `endTimestamp` | string | yes | ISO 8601 |
| `durationMinutes` | number | yes | Computed duration |
| `model` | string | no | Model used (sonnet, opus, haiku) |
| `verdict` | string | no | For review phases: Approved / Revision Required |
| `notes` | string | no | Free-form notes |
