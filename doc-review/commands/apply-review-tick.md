---
description: "One tick of the doc-review auto-apply loop. Atomically claims queued comment IDs from the running server and applies each to source. Not for human invocation; driven by /loop."
allowed-tools: ["Read", "Edit", "Bash", "Grep"]
argument-hint: "--port <N> --session-id <id>"
---

You are running one tick of the doc-review auto-apply loop. Arguments include
`--port <N>` and `--session-id <id>`.

## Step 1 - Refresh our session heartbeat

```bash
SESSION_ID="<id from --session-id, fall back to $CLAUDE_SESSION_ID>"
mkdir -p "$HOME/.cache/doc-review/sessions"
reg="$HOME/.cache/doc-review/sessions/${SESSION_ID}.json"
[ -f "$reg" ] && touch "$reg" || true
```

The server's heartbeat sweep drops sessions whose registry file is older than 5
minutes; touching it here keeps our reference alive.

## Step 2 - Health check

```
curl -fsS http://127.0.0.1:<port>/__overlay/health
```

If `curl` exits non-zero, the server is down. Output nothing and stop. The
`/loop` driver will see no continuation and end the loop.

## Step 3 - Claim and apply queued comments

Loop using the atomic claim endpoint:

```
curl -fsS -X POST http://127.0.0.1:<port>/__overlay/queue/claim
```

Response: `{"id": "c-xxxx"}` or `{"id": null}`. Stop when `id` is null.

For each claimed id:

1. `curl -fsS http://127.0.0.1:<port>/__overlay/comments` to fetch the full
   review JSON; locate the comment by id.
2. Build the anchor: `context_before + selected_text + context_after`. Locate
   it in the doc file (`doc_path` from the review JSON). If ambiguous or not
   found, skip this comment and log the reason. The id was already claimed (no
   re-DELETE needed), so it will not retry. Do NOT mark it applied.
3. Build the replacement.
   - If `suggested` is present: it is the authoritative replacement. Swap
     `selected_text` for `suggested` inside the anchor and keep the
     surrounding context.
   - If `suggested` is null/empty: `suggested` is only an optional hint. The
     `comment` field is the instruction. Read `doc_path` around the anchor for
     context (a few lines before/after), then infer the minimal replacement
     that satisfies `comment`. Keep the rest of the anchor unchanged. If the
     instruction is too vague to act on safely (e.g. "fix this" with no
     direction), skip with reason "instruction too vague - run /apply-review".
   - Punctuation/formatting must match the surrounding doc style (ASCII only
     unless the file already uses unicode; preserve markdown / HTML syntax).
4. Use the Edit tool against `doc_path` with `old_string`=anchor (the located
   substring in the file, with whatever context was needed for uniqueness),
   `new_string`=updated anchor.
5. `PATCH http://127.0.0.1:<port>/__overlay/comments/<id>` with body
   `{"status":"applied","applied_at":"<ISO>","applied_note":"auto-applied by loop tick"}`.

## Step 4 - Concise report

Print one line per processed id: `applied c-xxxx` or
`skipped c-xxxx: <reason>`. If the queue was empty: `tick: queue empty`.
Nothing else - this runs every 60 seconds.

## Constraints

- These applies were pre-approved by the user clicking Apply in the browser. Do
  NOT ask for further confirmation.
- Never touch files other than `doc_path` from the review JSON.
- Never run commits or pipeline regen.
- If the health check fails mid-tick (server killed between calls), exit
  silently.
