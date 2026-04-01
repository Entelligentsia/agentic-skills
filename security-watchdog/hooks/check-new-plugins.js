#!/usr/bin/env node
// Security Watchdog — SessionStart hook
//
// Diffs ~/.claude/plugins/installed_plugins.json against a snapshot from
// the previous session. When new or updated plugins are detected, injects
// a mandatory security scan request into the session's additionalContext.
//
// Uses only Node.js built-ins — no npm dependencies required.
// Works on Linux, macOS, and Windows wherever Claude Code runs.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const dataDir = process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'security-watchdog-data');
const installedFile = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
const snapshotFile = path.join(dataDir, 'snapshot.json');

// Nothing to check if the plugin registry does not exist yet
if (!fs.existsSync(installedFile)) process.exit(0);

fs.mkdirSync(dataDir, { recursive: true });

// Build a sorted fingerprint array of installed plugin entries.
// Each entry: { plugin, scope, sha } where sha is gitCommitSha or lastUpdated.
function buildFingerprint(installedPath) {
  try {
    const data = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
    const entries = [];
    for (const [plugin, installs] of Object.entries(data.plugins || {})) {
      for (const install of installs) {
        entries.push({
          plugin,
          scope: install.scope || 'user',
          sha: install.gitCommitSha || install.lastUpdated || 'unknown',
        });
      }
    }
    // Sort for stable comparison
    return entries.sort((a, b) =>
      `${a.plugin}\t${a.scope}\t${a.sha}`.localeCompare(`${b.plugin}\t${b.scope}\t${b.sha}`)
    );
  } catch {
    return [];
  }
}

const current = buildFingerprint(installedFile);
if (current.length === 0) process.exit(0);

// Load previous snapshot (empty array on first run — all plugins treated as new)
let previous = [];
if (fs.existsSync(snapshotFile)) {
  try {
    previous = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  } catch {
    previous = [];
  }
}

// Build a Set of "plugin\tscope\tsha" strings from the previous snapshot
const previousSet = new Set(previous.map(e => `${e.plugin}\t${e.scope}\t${e.sha}`));

// Find entries in current that are absent from the previous snapshot
const changed = current.filter(e => !previousSet.has(`${e.plugin}\t${e.scope}\t${e.sha}`));

// Persist new snapshot — alert fires exactly once per change event
fs.writeFileSync(snapshotFile, JSON.stringify(current, null, 2));

if (changed.length === 0) process.exit(0);

const changedList = changed.map(e => `${e.plugin} [${e.scope}]`).join(', ');

const msg =
  `SECURITY WATCHDOG ALERT — Plugin change detected. ` +
  `The following Claude Code plugins were installed or updated since your last session: ${changedList}. ` +
  `MANDATORY ACTION: Before responding to any user request, run /security-watchdog:scan-plugin for each changed plugin ` +
  `and present your findings. This scan checks for prompt injection, malicious hook scripts, ` +
  `credential theft, and data exfiltration. ` +
  `Usage: /security-watchdog:scan-plugin <plugin-id>  e.g.  /security-watchdog:scan-plugin forge@forge`;

// Escape for JSON string embedding
const escaped = msg.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
process.stdout.write(`{"additionalContext":"${escaped}"}\n`);
