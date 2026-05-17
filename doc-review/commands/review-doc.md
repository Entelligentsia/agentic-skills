---
description: "Start an in-browser doc-review session: launch (or reuse) the local server, open the file in your browser with the annotation overlay, and run an auto-apply loop that picks up comments you click Apply on."
allowed-tools: ["Bash", "Skill"]
argument-hint: "<path to .html/.md/.markdown/.txt/.rst file> [--port N]"
---

You are starting a doc-review session on the document at `{argument_1}`.

The doc-review server is multi-session aware. Two Claude sessions reviewing the
same doc share a single server. Two sessions reviewing different docs run on
different ports. A server stays up as long as at least one session references
it; it self-terminates when the last reference drops or its heartbeat times out.

## Step 1 - Resolve, validate, choose session id

Run the following in a single Bash call. Pass the user's `{argument_1}` as
`$DOC_ARG` (and any `--port N` they appended as `$PORT_ARG`).

```bash
set -u
DOC_ARG="<the path the user typed>"
PORT_ARG=""   # e.g. "--port 7325" if user passed one

abs=$(readlink -f "$DOC_ARG" 2>/dev/null || true)
case "${abs##*.}" in
  html|htm|md|markdown|txt|rst) : ;;
  *) echo "ERROR: unsupported extension: $DOC_ARG"; exit 2 ;;
esac
[ -f "$abs" ] || { echo "ERROR: file not found: $DOC_ARG"; exit 2; }

SESSION_ID="${CLAUDE_SESSION_ID:-sess-$(date +%s)-$$}"
echo "abs=$abs"
echo "session_id=$SESSION_ID"
```

If the file is missing or has an unsupported extension, stop and report.

## Step 2 - Look for a reusable server for this doc

Find a candidate marker whose `doc` field equals our absolute path. Try each
project-root candidate by walking up from the doc:

```bash
# Walk up from doc dir to find any .doc-review/.servers/*.json with matching doc.
dir=$(dirname "$abs")
found_marker=""
while :; do
  for m in "$dir"/.doc-review/.servers/*.json; do
    [ -f "$m" ] || continue
    if grep -qF "\"doc\": \"$abs\"" "$m"; then
      found_marker="$m"; break
    fi
  done
  [ -n "$found_marker" ] && break
  parent=$(dirname "$dir")
  [ "$parent" = "$dir" ] && break
  dir="$parent"
done
echo "marker_candidate=${found_marker:-<none>}"
```

If `found_marker` is non-empty:

```bash
pid=$(grep -oE '"pid"[^0-9]*[0-9]+' "$found_marker" | grep -oE '[0-9]+$' | head -1)
port=$(grep -oE '"port"[^0-9]*[0-9]+' "$found_marker" | grep -oE '[0-9]+$' | head -1)
alive="no"
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
  if curl -fsS -m 2 "http://127.0.0.1:${port}/__overlay/health" >/dev/null 2>&1; then
    alive="yes"
  fi
fi
echo "reuse_alive=$alive port=$port pid=$pid"
```

- If `alive=yes`: REUSE. Skip Step 3. Register our session id:
  ```bash
  curl -fsS -X POST -H 'Content-Type: application/json' \
    -d "{\"session_id\":\"$SESSION_ID\"}" \
    "http://127.0.0.1:${port}/__overlay/refs" >/dev/null
  meta=$(curl -fsS "http://127.0.0.1:${port}/__overlay/meta")
  echo "$meta"
  ```
  Use `meta` (and the marker contents) to determine the browser URL and the
  project root / review_file / queue_file / marker_file.

- If `alive=no`: delete the stale marker and proceed to spawn.
  ```bash
  rm -f "$found_marker"
  ```

## Step 3 - Spawn a new server (only if not reusing)

Use the Bash tool with `run_in_background: true`:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/server.cjs "<abs>" --session-id "<SESSION_ID>" [--port N]
```

The server prints one JSON status line containing `status`, `url`, `doc_url`,
`project_root`, `review_file`, `queue_file`, `marker_file`, `session_id`, `pid`,
`port`. Read the background output once after the server has bound to capture
those fields.

If `--port` was not specified the server scans 7321..7340 for a free port.

## Step 4 - Touch our session registry

Make sure `$HOME/.cache/doc-review/sessions/<SESSION_ID>.json` exists and lists
the marker. Idempotent and dedup'd:

```bash
mkdir -p "$HOME/.cache/doc-review/sessions"
reg="$HOME/.cache/doc-review/sessions/${SESSION_ID}.json"
marker_path="<marker_file from spawn output or reused marker>"
if [ -f "$reg" ]; then
  # Append marker path uniquely.
  if ! grep -qF "\"$marker_path\"" "$reg"; then
    # Insert into markers array. Simple rewrite: extract existing markers, add new, write.
    existing=$(grep -oE '"/[^"]+\.json"' "$reg" | tr '\n' ',' | sed 's/,$//')
    if [ -n "$existing" ]; then
      printf '{"session_id":"%s","markers":[%s,"%s"]}\n' "$SESSION_ID" "$existing" "$marker_path" > "$reg"
    else
      printf '{"session_id":"%s","markers":["%s"]}\n' "$SESSION_ID" "$marker_path" > "$reg"
    fi
  fi
else
  printf '{"session_id":"%s","markers":["%s"]}\n' "$SESSION_ID" "$marker_path" > "$reg"
fi
touch "$reg"
```

## Step 5 - Open the browser

- Linux: `xdg-open <doc_url>` (background ok)
- macOS: `open <doc_url>` (mention it briefly)

## Step 6 - Report

Print a concise report:

- URL (use `doc_url`)
- Project root
- Review JSON path
- Queue JSON path
- Marker path
- Session id
- Server PID and port
- Mode: `spawned` or `reused`
- One-line how-to: "Select text or click a paragraph, hit + New comment, set severity, save. Click Apply on a comment to push it into the auto-apply queue."

## Step 7 - Start the auto-apply loop

Invoke the `loop` skill via the Skill tool. The loop should run
`/apply-review-tick --port <port> --session-id <SESSION_ID>` every 60 seconds.
The tick command exits silently when the server health endpoint is unreachable,
which terminates the loop.

If the `loop` skill is unavailable, tell the user how to drive applies
manually: click Apply in the browser, then run `/apply-review` when ready.

Once the loop is running, tell the user: "Auto-apply loop active. Click Apply on
any open comment in the browser; the edit will land in source within ~60s."
