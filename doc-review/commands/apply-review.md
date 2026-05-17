---
description: "Read a doc-review JSON file, build a plan of pending edits, ask for approval, and apply them to the document source. Generic: edits target the document the user opened with /review-doc."
allowed-tools: ["Read", "Edit", "Write", "Bash", "Grep", "Glob", "AskUserQuestion"]
argument-hint: "[<path to .review.json>]"
---

You are applying a doc-review JSON file produced by the doc-review overlay.

The argument is `{argument_1}`. If empty, locate pending review files automatically under `./.doc-review/*.review.json` (cwd, then walk up to find a directory containing `.doc-review/`). If multiple candidates have open comments, ask the user which one.

## Phase 1 - Read and triage

Read the JSON. Confirm the structure: top-level `doc`, `doc_path`, `doc_relpath`, `project_root`, `comments[]`. Each comment has `id`, `selected_text`, `context_before`, `context_after`, `severity` (`typo` | `edit` | `rewrite` - older files may also carry `substantive` | `register`; treat those as `rewrite` and `edit` respectively), `comment`, optional `suggested`, `status`.

Filter to comments with `status` missing, `open`, or `reopened`. Skip `applied`, `dismissed`, `deferred`.

**Reopened comments carry history.** If `status === "reopened"`, fields `applied_at` and `applied_note` from a prior pass remain. Surface the prior `applied_note` to the user as part of the plan; the reviewer is amending because the prior application was incomplete.

## Phase 2 - Locate and anchor

The edit target is the document file itself - `doc_path` from the JSON. No project-specific routing.

For each open comment, build a unique anchor string from `context_before + selected_text + context_after`. If `context_before`/`context_after` are empty (paragraph-click anchors), fall back to `selected_text` alone, or with surrounding lines pulled from the source file via Grep.

If the anchor appears more than once in the source file, flag the comment as ambiguous - surface both occurrences and ask the user which to edit.

## Phase 3 - Present the plan

Print a compact table:

```
PLAN - <doc_relpath>  (N open comments)

#  id      sev      file                                   action
1  c-xxx   typo     <doc_relpath>                          replace "X" -> "Y"
2  c-xxx   edit     <doc_relpath>                          per comment
3  c-xxx   rewrite  <doc_relpath>                          rewrite per comment
```

Then ask via AskUserQuestion: approve all, reject all, or per-comment review. For per-comment, walk one comment at a time.

## Phase 4 - Apply

For each approved comment, use the Edit tool against `doc_path`:

- `old_string` = the unique anchor (context_before + selected_text + context_after, trimmed to whatever is needed to be unique in the file)
- `new_string`:
  - `suggested` is an optional hint. If present, treat it as the authoritative replacement: substitute it for `selected_text` inside the anchor and keep `context_before` / `context_after` unchanged.
  - If `suggested` is empty, the `comment` field is the instruction. Read enough surrounding context from `doc_path` to act on it, then infer the minimal change that satisfies `comment`. Present the inferred replacement in the plan so the user can approve/edit before applying.
  - If the instruction is too vague to act on (e.g. "fix this" with no direction), ask the user for the exact replacement before editing.

If a doc-review server is running for this document, use PATCH to update the
comment status. To find the right server: look under
`<project_root>/.doc-review/.servers/*.json` for a marker whose `doc` field
equals the review JSON's `doc_path`. If exactly one match: read its `port` and
PATCH `http://127.0.0.1:<port>/__overlay/comments/<id>`. If more than one match
(should not happen, but multiple stale markers could collide): stop and ask the
user to pass `--port <N>` explicitly. If none match or the server's `/health`
fails: write the JSON directly with `fs`-friendly tooling (Read + Edit / Write).

Per comment, set:

- `status: "applied"`, `applied_at: <ISO timestamp>`, optional `applied_note: "<one-line summary>"`

For dismissed comments: `status: "dismissed"`, `dismissed_at`, optional `dismissed_note`.

For reopened comments: preserve the original `applied_at`/`applied_note`; append a re-application note, e.g. `applied_note: "<original> | re-applied: <summary>"`.

## Phase 5 - Report

Print a one-paragraph summary: N applied, N dismissed, N deferred, list of files touched. No rebuild / regen step - this command does not run downstream pipelines.

## Guardrails

- No project-specific routing. All edits land in `doc_path`.
- Never commit changes.
- Never amend a prior commit.
- If an anchor cannot be located uniquely, do NOT guess - surface and ask.
