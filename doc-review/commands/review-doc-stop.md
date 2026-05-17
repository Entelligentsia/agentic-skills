---
description: "Stop this Claude session's doc-review references. Servers shut down automatically when their last reference drops; other sessions stay unaffected."
allowed-tools: ["Bash", "Read"]
argument-hint: "[--session-id <id>]"
---

You are stopping this session's doc-review references.

The doc-review server is multi-session aware. Stopping just drops this session's
reference from every server it touched. If another session is still reviewing
the same doc, that server stays up. If this was the last reference, the server
self-terminates.

## Step 1 - Resolve session id

```bash
SESSION_ID="${CLAUDE_SESSION_ID:-}"
# Honor --session-id <id> if user passed one.
```

If `SESSION_ID` is empty and the user did not pass `--session-id`, tell the user
no session id is set and stop.

## Step 2 - Read the session registry

```bash
reg="$HOME/.cache/doc-review/sessions/${SESSION_ID}.json"
if [ ! -f "$reg" ]; then
  echo "no doc-review references for session $SESSION_ID"
  exit 0
fi
markers=$(grep -oE '"/[^"]+\.json"' "$reg" | tr -d '"')
```

## Step 3 - Deregister from each marker's server

For each marker path:

```bash
for m in $markers; do
  [ -f "$m" ] || continue
  port=$(grep -oE '"port"[^0-9]*[0-9]+' "$m" | grep -oE '[0-9]+$' | head -1)
  [ -z "$port" ] && continue
  curl -fsS -m 2 -X DELETE "http://127.0.0.1:${port}/__overlay/refs/${SESSION_ID}" >/dev/null 2>&1 || true
  echo "deregistered from port $port ($m)"
done
```

## Step 4 - Remove the session registry file

```bash
rm -f "$reg"
```

## Step 5 - Report

Tell the user which servers were deregistered, and that any server whose last
reference just dropped will exit on its own; others remain up for their other
sessions. The auto-apply `/loop` for this session will exit on its next tick
when the health check fails (if the server has shut down) or when the loop
driver notices the session has ended.
