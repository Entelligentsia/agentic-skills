# Store Schema: Bug

## File Location

`.forge/store/bugs/{BUG_ID}.json`

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bugId` | string | yes | e.g. `ACME-BUG-01` |
| `title` | string | yes | Bug title |
| `description` | string | no | Detailed description |
| `severity` | enum | yes | `critical` / `major` / `minor` |
| `status` | enum | yes | See status values below |
| `path` | string | yes | Relative path to bug artifact directory |
| `rootCauseCategory` | enum | no | See categories below |
| `similarBugs` | string[] | no | Bug IDs with similar root cause |
| `checklistItemAdded` | boolean | no | Whether a stack-checklist item was added |
| `businessRuleUpdated` | boolean | no | Whether business domain docs were updated |
| `reportedAt` | string | yes | ISO 8601 timestamp |
| `resolvedAt` | string | no | ISO 8601 timestamp |

## Status Values

`reported` → `triaged` → `in-progress` → `fixed` → `verified`

## Root Cause Categories

`validation` / `auth` / `business-rule` / `data-integrity` / `race-condition` / `integration` / `configuration` / `regression`
