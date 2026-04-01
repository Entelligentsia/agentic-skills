#!/usr/bin/env bash
# Security Watchdog — SessionStart hook
#
# Diffs ~/.claude/plugins/installed_plugins.json against a snapshot from
# the previous session. When new or updated plugins are detected, injects
# a mandatory security scan request into the session's additionalContext.
#
# Snapshot fingerprint: "plugin-key TAB scope TAB (gitCommitSha or lastUpdated)"
# Snapshot is updated immediately on detection — each change event fires once.

set -euo pipefail

DATA_DIR="${CLAUDE_PLUGIN_DATA:-/tmp/security-watchdog-data}"
INSTALLED_FILE="${HOME}/.claude/plugins/installed_plugins.json"
SNAPSHOT_FILE="${DATA_DIR}/snapshot.json"

mkdir -p "$DATA_DIR"

# Nothing to check if the plugin registry does not exist yet
[ -f "$INSTALLED_FILE" ] || exit 0

# Build a sorted, tab-separated fingerprint of every installed plugin entry.
# Format per line: <plugin-key> TAB <scope> TAB <gitCommitSha|lastUpdated|unknown>
build_fingerprint() {
    jq -r '
        .plugins // {} |
        to_entries[] |
        .key as $plugin |
        .value[] |
        [ $plugin,
          (.scope // "user"),
          (.gitCommitSha // .lastUpdated // "unknown") ] |
        @tsv
    ' "$INSTALLED_FILE" 2>/dev/null | sort
}

CURRENT=$(build_fingerprint) || CURRENT=""
[ -n "$CURRENT" ] || exit 0

# Load previous snapshot (empty on first run — all current plugins are "new")
PREVIOUS=""
[ -f "$SNAPSHOT_FILE" ] && PREVIOUS=$(cat "$SNAPSHOT_FILE")

# Identify entries present in CURRENT but absent from PREVIOUS
CHANGED_LIST=""
while IFS=$'\t' read -r plugin scope sha; do
    if ! printf '%s\n' "$PREVIOUS" | grep -qF "${plugin}"$'\t'"${scope}"$'\t'"${sha}"; then
        label="${plugin} [${scope}]"
        CHANGED_LIST="${CHANGED_LIST:+${CHANGED_LIST}, }${label}"
    fi
done <<< "$CURRENT"

# Persist new snapshot so this alert fires only once per change event
printf '%s\n' "$CURRENT" > "$SNAPSHOT_FILE"

[ -n "$CHANGED_LIST" ] || exit 0

# Build the advisory injected into Claude's session context.
# The double-space before each /security-watchdog:scan-plugin call is intentional for readability.
MSG="SECURITY WATCHDOG ALERT — Plugin change detected. The following Claude Code plugins were installed or updated since your last session: ${CHANGED_LIST}. MANDATORY ACTION: Before responding to any user request, run /security-watchdog:scan-plugin for each changed plugin and present your findings. This scan checks for prompt injection, malicious hook scripts, credential theft, and data exfiltration. Usage: /security-watchdog:scan-plugin <plugin-id>  e.g.  /security-watchdog:scan-plugin forge@forge"

ESCAPED=$(printf '%s' "$MSG" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')
printf '{"additionalContext":"%s"}\n' "$ESCAPED"
