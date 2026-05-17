#!/usr/bin/env bash
# doc-review SessionEnd cleanup.
# Reads JSON from stdin (hook payload). Extracts session_id. Derefs the session
# from every doc-review server the session touched. Silent on no-op.
set -u
payload=$(cat 2>/dev/null || true)
session_id=$(printf '%s' "$payload" | grep -oE '"session_id"[^"]*"[^"]+"' | sed -E 's/.*"session_id"[^"]*"([^"]+)".*/\1/' | head -1)
[ -z "${session_id:-}" ] && session_id="${CLAUDE_SESSION_ID:-}"
[ -z "${session_id:-}" ] && exit 0
reg="$HOME/.cache/doc-review/sessions/${session_id}.json"
[ -f "$reg" ] || exit 0
# Markers list - newline-separated paths inside JSON-quoted strings.
markers=$(grep -oE '"/[^"]+\.json"' "$reg" | tr -d '"' || true)
for m in $markers; do
  [ -f "$m" ] || continue
  port=$(grep -oE '"port"[^0-9]*[0-9]+' "$m" | grep -oE '[0-9]+$' | head -1)
  [ -z "$port" ] && continue
  curl -fsS -m 2 -X DELETE "http://127.0.0.1:${port}/__overlay/refs/${session_id}" >/dev/null 2>&1 || true
done
rm -f "$reg"
exit 0
