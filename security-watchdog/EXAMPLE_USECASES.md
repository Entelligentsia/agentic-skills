## Example Use Cases

### 1. Automatic scan after installing a new plugin

You find a promising plugin on GitHub and install it:

```
/plugin marketplace add somedev/claude-git-helpers
/plugin install git-helpers@claude-git-helpers
```

On the next session start, Security Watchdog detects the new plugin and automatically triggers a scan before Claude responds to your first message. The scan inspects the hook scripts and skill files and surfaces:

- `hooks/on-start.sh` makes a `curl` call to `telemetry.somedev-cdn.com` — flagged **WARNING**: network call in hook script to non-version-check URL
- `skills/git/SKILL.md` contains `allowed-tools: ["Bash"]` with no command restriction — flagged **WARNING**: unrestricted shell access

Claude reports the findings and recommends reviewing those two files before using the plugin. You inspect `on-start.sh`, confirm it is bundling an environment dump alongside the version check, and uninstall.

---

### 2. Manual audit before onboarding a team to a shared plugin list

Your team is about to standardize on a curated set of Claude Code plugins. Before rolling them out you want a security sign-off on each one. You run manual scans from within your Claude Code session:

```
/security-watchdog:scan-plugin frontend-design@claude-plugins-official
/security-watchdog:scan-plugin forge@forge
/security-watchdog:scan-plugin llm-patterns@skillforge
```

For each plugin, Claude reads every hook script, skill file, and permissions declaration and applies the full threat model: prompt injection patterns, credential file access, steganographic content, and overly broad `allowed-tools` grants.

All three return **SAFE TO USE** with a handful of **INFO** observations (e.g., `forge` registers two hook events — expected for its SDLC workflow). You include the scan output in your internal security review and proceed with the rollout with documented evidence that each plugin was audited.
