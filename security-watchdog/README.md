# security-watchdog

<img src="./assets/banner.png" alt="security-watchdog — automatic Claude Code plugin scanner" width="100%" />

> Automatic security scanner for Claude Code plugins — detects new or updated extensions at session start and scans them for prompt injection, malicious hook scripts, and data exfiltration.

## The Problem

LLM extension ecosystems are a novel attack surface. Traditional security tooling does not cover two threats unique to AI extensions:

- **Host attacks** — hook scripts run shell commands automatically on session start, with full user privileges
- **Mind attacks** — skill and command files are injected directly into the model's reasoning context, enabling prompt injection

No existing security scanner understands these threat classes. Security Watchdog is purpose-built for them.

## How It Works

```
You run: /plugin install someone/new-plugin
                    ↓
Next session starts (SessionStart hook fires)
                    ↓
check-new-plugins.sh diffs installed_plugins.json
against a snapshot from the previous session
                    ↓
New/updated plugin detected
                    ↓
Injects into session context:
  "SECURITY WATCHDOG ALERT: forge@forge was installed.
   Run /security-watchdog:scan-plugin forge@forge before proceeding."
                    ↓
Claude runs /security-watchdog:scan-plugin, reads all plugin files,
applies security checks, and reports findings
```

The snapshot is updated on detection — each change event fires the alert exactly once.

## What It Detects

### In hook scripts (`.sh`, `.bash`, `.py`)
- Network calls to non-version-check URLs (potential exfiltration)
- Reading credential files (`~/.ssh`, `~/.aws`, `.env`, `*.pem`, `*.key`)
- Capturing environment variables containing `TOKEN`, `SECRET`, `KEY`, `PASSWORD`
- `eval` on dynamic content, base64-decoded payloads piped to shell
- Persistence mechanisms (cron, systemd, launchctl, nohup)
- Silent package installs (apt, brew, npm, pip)

### In skill and command files (`.md`, `SKILL.md`, `CLAUDE.md`)
- Prompt injection: "ignore previous instructions", "you are now", "override your system prompt"
- Exfiltration instructions embedded in skill content
- Zero-width / invisible Unicode characters hiding instructions
- Instructions buried after apparent document end
- Frontmatter description that does not match body content

### In permissions (`plugin.json`, `hooks.json`, frontmatter)
- `allowed-tools: ["Bash"]` with no restriction — unrestricted shell
- `allowed-tools: ["Write"]` with no path restriction
- Hooks with excessive timeouts or multiple event registrations

### Structural
- Binary or compiled files in plugin directory
- Files with misleading extensions
- Plugin size disproportionate to stated functionality

## Installation

```
/plugin marketplace add Entelligentsia/skillforge
/plugin install security-watchdog@skillforge
/reload-plugins
```

## Usage

### Automatic (via SessionStart hook)

After installing any plugin, start a new Claude Code session. If the watchdog detects a change, Claude will automatically run `/security-watchdog:scan-plugin` before responding to your first request.

### Manual

Scan any installed plugin at any time:

```
/security-watchdog:scan-plugin forge@forge
/security-watchdog:scan-plugin frontend-design@claude-plugins-official
```

Use the plugin ID as it appears in `~/.claude/plugins/installed_plugins.json`.

### Security knowledge reference

Load the threat model and heuristics into context:

```
/security-watchdog:plugin-security
```

## Limitations

**No PostPluginInstall hook exists yet.** Claude Code currently exposes `SessionStart` as the available hook event. Security Watchdog uses a snapshot-diff approach: the scan triggers at the start of the first session *after* an install, not at install time. If Anthropic adds `PostPluginInstall` in the future, the hook script is a one-line change.

**LLM-based analysis.** The scan is performed by Claude, not a deterministic rule engine. Claude can miss findings or flag false positives. Use the findings as guidance, not as a definitive verdict.

**No runtime monitoring.** The watchdog checks plugin files at rest. It does not monitor network calls or file system activity during hook execution.

## Files

```
security-watchdog/
  .claude-plugin/
    plugin.json              — plugin metadata and version
  hooks/
    hooks.json               — registers SessionStart hook
    check-new-plugins.js     — snapshot diff and context injection (Node.js — works on Linux, macOS, Windows)
  commands/
    scan-plugin.md           — /security-watchdog:scan-plugin <plugin-id> command
  skills/
    plugin-security/
      SKILL.md               — threat model, attack taxonomy, severity guide
```
