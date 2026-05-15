---
name: hook-system
description: Use when an agent harness needs user- or admin-configurable interception points — before/after tool calls, on prompt submit, on stop, on session start. Apply when designing the event/hook architecture that lets operators inject policy, logging, or transformation without modifying core harness code. Covers event taxonomy, blocking vs non-blocking hooks, hook contract (stdin/stdout/exit-code), failure modes, and security implications.
---

# Hook System

## Pain Signals — You Need This Pattern When:

- Operators want to enforce policy (block dangerous commands, redact secrets, log audits) without forking the harness
- Multiple users/teams need different behaviors on the same harness binary
- Cross-cutting concerns (telemetry, compliance, formatting) keep showing up as conditionals in core code
- You need extensibility for a built tool — third parties can configure behavior without code changes
- You want a deterministic interception point for testing — fire a hook, observe state

**Hooks shift policy out of code into config.** The harness defines *where* extension points are; operators decide *what* runs there. Without hooks, every new policy means a code change and a redeploy.

---

## Core Principle

A hook is a **handler attached to an event**. The harness emits events at well-defined lifecycle points; matching hooks run with a defined contract; their output influences (or does not influence) the harness's next action.

```
                  ┌─────────────────────┐
                  │  harness lifecycle  │
                  └──────────┬──────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        PreToolUse     PostToolUse    UserPromptSubmit
              │              │              │
       ┌──────┴───────┐ ┌────┴────┐ ┌───────┴───────┐
       │ hook scripts │ │  hooks  │ │     hooks     │
       └──────┬───────┘ └────┬────┘ └───────┬───────┘
              ▼              ▼              ▼
       block / allow /   add context    inject context /
       transform         to transcript  block submission
```

The harness is the trusted core. Hooks are user-controlled extensions and must be treated as untrusted by default for security purposes.

---

## Event Taxonomy

| Event | Fires | Hook can |
|-------|-------|----------|
| `SessionStart` | New session begins | Inject system context, set defaults |
| `UserPromptSubmit` | User submits a prompt, before model call | Block, transform, or annotate the prompt |
| `PreToolUse` | Model emitted a tool call, before execution | Block, modify args, require approval |
| `PostToolUse` | Tool returned, before result added to transcript | Redact, transform, log |
| `PreModelCall` | About to send request to model | Mutate request, route, cache-hint |
| `PostModelCall` | Response received from model | Log usage, redact, transform |
| `Stop` | Model produced final answer (no more tool calls) | Block stop and force continuation, log |
| `SubagentStop` | Subagent completes | Aggregate results, log |
| `Compact` | Compaction about to run / completed | Log, adjust strategy |
| `Notification` | Harness wants to notify user (waiting for approval, idle) | Route to Slack, push, etc. |

The minimum viable taxonomy for a code-acting harness is `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`. Add others as needs surface — over-broad taxonomies create surface area no one uses.

---

## Hook Contract

A hook is a process (or in-proc handler) that takes a structured event payload on stdin and returns a structured response on stdout. Exit code signals decision.

### Input (stdin, JSON)

```json
{
  "event": "PreToolUse",
  "session_id": "sess_abc",
  "turn": 12,
  "tool": {
    "name": "Bash",
    "input": {"command": "rm -rf /tmp/foo"}
  },
  "cwd": "/home/user/project",
  "transcript_path": "/var/run/harness/sess_abc.jsonl"
}
```

### Output (stdout, JSON)

```json
{
  "decision": "allow" | "block" | "transform",
  "reason": "string shown to user / logged",
  "modified_input": {...},                       // only for transform
  "additional_context": "text injected into transcript"  // optional
}
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success; honor stdout decision (default `allow` if no JSON) |
| 1 | Hook errored; harness logs and proceeds (non-blocking) or blocks (blocking) per config |
| 2 | Block; reason from stderr |
| Other | Treated as 1 |

Keep the contract narrow. Every field is a commitment.

---

## Blocking vs Observation Hooks

| Type | Effect | Examples |
|------|--------|----------|
| **Blocking** | Harness waits for hook; output influences next action | PreToolUse policy gate, prompt injection check |
| **Observation** | Hook fires async; output ignored | Telemetry, audit log, Slack notification |

A blocking hook on every tool call adds its latency to every turn. Observation hooks should be the default; reserve blocking for hooks that *must* gate the next action.

```python
class HookSpec:
    event: str
    matcher: Pattern  # e.g. tool name regex
    command: str
    blocking: bool = False
    timeout_sec: int = 30
```

---

## Ordering and Composition

When multiple hooks match an event:

- **Run in declared order.** Project hooks before user hooks (or reverse — pick one and document).
- **Short-circuit on block.** First `block` decision wins; remaining hooks skipped (or run but ignored — pick one).
- **Compose transforms.** If two hooks return `transform`, apply in sequence. Each sees the prior's output.
- **Aggregate `additional_context`.** All matching hooks contribute; concatenate in declared order.

Document the precedence rule in the harness spec; do not rely on filesystem ordering.

---

## Failure Isolation

A crashing hook must not crash the harness.

- **Timeout every hook.** Default 30s; fail closed (block) for blocking hooks, fail open (allow + log) for observation hooks.
- **Sandbox hook execution.** Run hooks as the user, not the harness service account. Hooks can read user files but not harness internals.
- **Capture stderr.** Surface to operator on failure; do not leak to the model's transcript by default.
- **Disable repeatedly-failing hooks.** After N failures in a session, the harness should auto-disable a hook with a clear message.

```python
def run_hook(spec: HookSpec, payload: dict) -> HookResult:
    try:
        proc = subprocess.run(
            [spec.command],
            input=json.dumps(payload),
            capture_output=True,
            timeout=spec.timeout_sec,
            text=True,
        )
        return parse_hook_output(proc)
    except subprocess.TimeoutExpired:
        return HookResult(decision="block" if spec.blocking else "allow",
                          reason=f"hook {spec.command} timed out")
    except Exception as e:
        return HookResult(decision="block" if spec.blocking else "allow",
                          reason=f"hook error: {e}")
```

---

## Security

Hooks run with user privilege and see sensitive payloads (prompts, tool args, file paths). Treat them with the same scrutiny as plugins.

- **Hooks are untrusted code from the operator's perspective**, but trusted from the harness's perspective in the sense that they intentionally see the data. The threat is misconfiguration or supply chain — a hook script pulled from the internet could exfiltrate prompts.
- **Vetting.** Document what hooks see and what they can do. Recommend reviewing hook scripts before installing.
- **No ambient credentials.** Hooks should not have automatic access to secrets. If they need to call an external service, the user provides scoped credentials.
- **Audit log.** Every hook execution logged: which hook, which event, decision, latency, exit code.
- **Hook config under version control.** Don't accept hooks from arbitrary user input at runtime — load from a known config path with explicit user opt-in.

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Blocking hook on every event | Latency added to every turn | Use observation by default; blocking only when needed |
| No timeout | One slow hook hangs harness | Default timeout, configurable |
| Hook stderr leaks into model context | Model "sees" admin messages | Strip stderr before transcript; surface to operator only |
| Order undefined | Behavior changes per filesystem | Document and enforce precedence |
| Crash takes down harness | Bad hook breaks all sessions | Exception isolation, failing-hook auto-disable |
| Hooks see secrets they shouldn't | Exfiltration risk | Redact sensitive fields at hook boundary |
| User cannot debug hook | Silent failures | Surface hook errors clearly with hook name + exit + stderr |
| Hooks installed without user knowing | Trust violation | Require explicit opt-in; show enabled hooks at session start |

---

## When NOT to Use

- **Behavior is universal across all users.** Bake it into the harness — hooks add config surface for no win.
- **Latency-critical hot path.** Blocking hooks add latency every turn; if every fraction of a second matters, internalize the policy.
- **The hook is "the harness's job."** If every operator needs the same hook, you have a missing harness feature, not a hook need.

---

## Design Checklist

- [ ] Event taxonomy is minimal and well-defined; each event has a documented payload schema
- [ ] Hook contract (stdin payload, stdout decision, exit codes) is documented and stable
- [ ] Default mode is observation; blocking is opt-in per hook
- [ ] Every hook has a timeout; fail-mode (open/closed) defined per blocking semantics
- [ ] Multiple-match precedence is documented and tested
- [ ] Hook crashes are isolated; harness survives any hook failure
- [ ] Hook stderr / errors are surfaced to operator, not injected into model transcript
- [ ] Audit log records every hook execution: name, event, decision, latency, exit code
- [ ] Auto-disable for repeatedly-failing hooks
- [ ] Hook config requires explicit user opt-in; loaded from known path
- [ ] Hooks visible to user at session start (which are enabled, what they can do)
- [ ] Sensitive fields redacted at hook boundary unless hook explicitly authorized to see them
- [ ] Test harness for hooks: fire event with synthetic payload, assert outcome
