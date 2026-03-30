#!/usr/bin/env bash
# Forge update checker — runs on SessionStart
# Checks once per day whether a newer version is available.
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-.}"
DATA_DIR="${CLAUDE_PLUGIN_DATA:-/tmp/forge-plugin-data}"
CACHE_FILE="$DATA_DIR/update-check-cache.json"
REMOTE_URL="https://raw.githubusercontent.com/Entelligentsia/agentic-skills/main/forge/.claude-plugin/plugin.json"
CHECK_INTERVAL=86400  # 24 hours in seconds

mkdir -p "$DATA_DIR"

# Read local version
LOCAL_VERSION=$(jq -r '.version // "0.0.0"' "$PLUGIN_ROOT/.claude-plugin/plugin.json" 2>/dev/null || echo "0.0.0")

# Check if we already checked recently
if [ -f "$CACHE_FILE" ]; then
    LAST_CHECK=$(jq -r '.lastCheck // 0' "$CACHE_FILE" 2>/dev/null || echo "0")
    NOW=$(date +%s)
    ELAPSED=$((NOW - LAST_CHECK))
    if [ "$ELAPSED" -lt "$CHECK_INTERVAL" ]; then
        # Already checked recently — show cached result if update available
        CACHED_REMOTE=$(jq -r '.remoteVersion // ""' "$CACHE_FILE" 2>/dev/null || echo "")
        if [ -n "$CACHED_REMOTE" ] && [ "$CACHED_REMOTE" != "$LOCAL_VERSION" ]; then
            echo "Forge $CACHED_REMOTE available (you have $LOCAL_VERSION). Run: /plugin update forge@agentic-skills"
        fi
        exit 0
    fi
fi

# Fetch remote version (timeout 5s, fail silently)
REMOTE_VERSION=$(curl -sf --max-time 5 "$REMOTE_URL" 2>/dev/null | jq -r '.version // ""' 2>/dev/null || echo "")

if [ -z "$REMOTE_VERSION" ]; then
    # Network failure — skip silently
    exit 0
fi

# Cache the result
NOW=$(date +%s)
printf '{"lastCheck":%d,"remoteVersion":"%s","localVersion":"%s"}\n' "$NOW" "$REMOTE_VERSION" "$LOCAL_VERSION" > "$CACHE_FILE"

# Notify if update available
if [ "$REMOTE_VERSION" != "$LOCAL_VERSION" ]; then
    echo "Forge $REMOTE_VERSION available (you have $LOCAL_VERSION). Run: /plugin update forge@agentic-skills"
fi
