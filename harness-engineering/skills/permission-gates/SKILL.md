---
name: permission-gates
description: Use when an agent harness must classify tool calls by risk and decide which require human approval, which run automatically, and which are denied outright. Apply when building the permission/policy layer that sits between the model's tool-call output and execution. Covers risk classification (read/write/destructive/exfil), allowlist/denylist design, approval UX, irreversibility detection, scope-bound consent, and audit logging.
---

# Permission Gates

## Pain Signals — You Need This Pattern When:

- An agent has tools that can damage data, send messages, or move money — and "fully autonomous" feels wrong
- Users want autonomy for routine work but a brake on dangerous actions
- Operators need to enforce policy ("never run terraform apply without approval") without code changes
- Auditors ask "who approved this action?" and the answer is "the LLM did"
- Approval fatigue: too many prompts → users rubber-stamp; too few → unwanted actions slip through

**Permission gates encode policy about intent.** The sandbox bounds what *can* happen; the gate decides what *should* happen. Both are required for serious agent harnesses.

---

## Core Principle

A gate is a function over `(tool, args, context) → decision`. Decisions are coarse (allow / block / require-approval); reasoning is fine-grained (rules, classifications, scopes). The gate runs *before* tool execution; failure to allow means the tool does not run.

```
            tool_call
                │
                ▼
       ┌──────────────────┐
       │ classify risk    │
       └────────┬─────────┘
                │
                ▼
       ┌──────────────────┐
       │ apply policy     │
       └────────┬─────────┘
                │
   ┌────────────┼────────────┐
   ▼            ▼            ▼
 allow       approve       block
 (run)       (await        (return
              human)        error)
```

---

## Risk Classification

Every tool call gets a risk class. Classes are coarse and deterministic.

| Class | Description | Example |
|-------|-------------|---------|
| `read_local` | Reads files / queries local state | `Read`, `Grep`, `git status` |
| `write_local` | Mutates local workspace | `Edit`, `Write`, `git commit` |
| `read_shared` | Reads from shared/external systems | API GET, DB SELECT, gh PR view |
| `write_shared` | Mutates shared/external state | API POST, DB UPDATE, gh PR comment |
| `destructive` | Hard-to-reverse mutation | `rm -rf`, `DROP TABLE`, `git push --force` |
| `external_comm` | Sends visible communication | Slack post, email, PR comment |
| `code_exec` | Executes arbitrary code | `Bash`, `python -c`, eval |

Classification is per-(tool, args), not per-tool. `git push` is `write_shared`; `git push --force` is `destructive`. The classifier inspects args.

---

## Default Policies by Class

| Class | Default policy |
|-------|----------------|
| `read_local` | allow |
| `write_local` | allow (workspace-bounded) |
| `read_shared` | allow if allowlisted endpoint, else approve |
| `write_shared` | approve |
| `destructive` | approve, with explicit irreversibility warning |
| `external_comm` | approve |
| `code_exec` | allow if sandboxed and matches command allowlist; else approve |

These are defaults. Operator policy overrides per project / session / user.

---

## Approval Scopes

Single-prompt approval is necessary but not sufficient. Without scope, every prompt teaches the user to click "yes" — the gate becomes ceremony.

| Scope | Persistence |
|-------|-------------|
| **Once** | This call only |
| **Tool-instance** | This tool with these args, this session |
| **Tool-pattern** | This tool with args matching a pattern, this session (e.g., `Bash` with `git status`) |
| **Tool** | Any call to this tool, this session |
| **Class** | Any tool of this class, this session |
| **Durable** | Persists across sessions (settings.json) |

Default to narrow scope; broaden only on explicit user choice. Surface scope clearly: "Allow `git status` for this session?" not "Allow Bash?"

**Scope creep watch:** durable approvals must be reviewable. Show enabled blanket approvals at session start.

---

## Irreversibility Detection

Destructive class is special. The user must understand they cannot undo this.

Heuristics:

- `rm -rf`, `DROP`, `TRUNCATE`, `--force`, `--hard`, `git reset`, `git push -f`, anything writing to production, anything sending external comms
- Missing safety flags (`--dry-run`, `--no-commit`)
- Credentials suggest production scope

Approval UX for destructive:

```
WARNING: irreversible action
  Tool: Bash
  Command: git push --force origin main
  Why irreversible: rewrites history on shared branch
  Alternatives considered: --force-with-lease, regular push

  [a]pprove once   [d]eny   [c]ourse-correct
```

Never offer a "remember this for the session" option for destructive. Approval is per-invocation.

---

## Policy DSL

A simple policy language helps operators without forking the harness.

```yaml
policies:
  - match: { tool: Bash, args: { command: { regex: "^git (status|log|diff|show)" } } }
    decision: allow

  - match: { tool: Bash, args: { command: { regex: "(rm -rf|--force|--hard)" } } }
    decision: block
    reason: "destructive bash patterns blocked by org policy"

  - match: { class: external_comm }
    decision: require_approval

  - match: { tool: Edit, path: { glob: "src/**/*.py" } }
    decision: allow

  - match: { tool: Edit, path: { glob: "infra/**/*" } }
    decision: require_approval
    reason: "infra changes require human review"
```

Match-first-wins. Document precedence. Test policies against synthetic tool calls.

---

## Prompt-Time vs Tool-Time Gates

| Gate | When fires | Strength |
|------|-----------|----------|
| **Prompt-time** | On user prompt submission | Catch obviously-dangerous tasks before model engages |
| **Tool-time** | On model tool call | Authoritative; sees actual args |

Tool-time is mandatory; prompt-time is convenience. Never rely on prompt-time alone — the model can plan around it; the actual operation is the tool call.

---

## Failure-Closed

If the gate cannot decide (policy parse error, classifier crash, approval timeout), the default is **block**, not allow.

```python
def gate(tool_call: ToolCall) -> Decision:
    try:
        cls = classify(tool_call)
        return apply_policies(cls, tool_call)
    except Exception as e:
        log_error(e)
        return Decision.BLOCK  # fail closed
```

A gate that silently allows on its own bug is worse than no gate.

---

## Audit Log

Every gate decision is logged with full context:

```json
{
  "ts": "...",
  "session_id": "...",
  "tool": "Bash",
  "args": {"command": "git push origin main"},
  "class": "write_shared",
  "matched_policy": "policy[3]",
  "decision": "approve",
  "approver": "user:boni",
  "scope": "once"
}
```

Audit must capture:

- The exact (tool, args) — not just tool name
- The policy that fired
- The decision and who made it (user or auto-policy)
- The scope of the approval
- Subsequent execution outcome (linked by event ID to session-persistence log)

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Classifier ignores args | `git push --force` treated like `git status` | Per-call classification on args |
| Blanket session approvals | First-prompt yes → everything allowed | Narrow default scope |
| Approval prompts too frequent | Rubber-stamp behavior | Allowlist common safe ops; reserve prompts for risk |
| Approval prompts too rare | Bad action slips through | Re-tune classification |
| Prompt-time only | Model bypasses by re-planning | Tool-time gate is mandatory |
| Fail-open on policy error | Bug silently allows actions | Fail closed |
| No audit of who approved | Compliance gap | Record approver identity |
| Durable approvals invisible | Users forget what they granted | Show at session start |
| Gate confused with sandbox | "We have a sandbox, no gate needed" | Both are required; different roles |

---

## When NOT to Use

- **Fully read-only agents** with no write/comm/exec tools — gating reads adds friction with no benefit
- **CI/automation contexts** where the human-in-loop is upstream (PR approval); inline gating breaks unattended runs (replace with strict policy, no `require_approval`)
- **Single-tool scripts** where the policy fits in one line of code

---

## Design Checklist

- [ ] Risk classes defined; every tool maps to one or more
- [ ] Classification operates on (tool, args), not tool alone
- [ ] Default policy table per class is documented
- [ ] Operator policy DSL exists and supports allow / block / require_approval with match rules
- [ ] Approval scopes are explicit; default scope is narrow
- [ ] Durable approvals visible at session start
- [ ] Destructive class triggers irreversibility warning; no session-scope option
- [ ] Tool-time gate is mandatory; prompt-time is supplementary only
- [ ] Fail-closed on classifier or policy error
- [ ] Every decision audited with policy, scope, approver
- [ ] Coordination with sandbox: gate decides intent, sandbox enforces capability
- [ ] Telemetry: approval rate per class, denial rate, time-to-decision
