---
name: subagent-orchestration
description: Use when a single agent loop is insufficient and work must be delegated to subagents — for context isolation, parallel exploration, specialized capability, or scope reduction. Apply when designing how a parent agent spawns, briefs, monitors, and merges results from child agents. Covers fork-vs-fresh-subagent tradeoffs, prompt briefing rules, isolation modes (worktree, sandbox), result merging, and failure containment.
---

# Subagent Orchestration

## Pain Signals — You Need This Pattern When:

- A single agent's context is filling with tool output the parent will not need again (verbose searches, large file reads, exploratory dead ends)
- Multiple independent investigations could run in parallel — the parent is the bottleneck
- A specialized capability (security review, planning, search) is better served by a focused agent with a tighter prompt
- A risky operation should run in an isolated workspace (worktree, container) without polluting the parent's state
- The task scope is too large for a single context window even with compaction

**Subagents are not free.** Each spawn has setup cost, briefing cost, and merge complexity. Use them when context isolation or parallelism is the actual win — not as default decomposition.

---

## Core Principle

A subagent is a **bounded computation** with its own context, tool set, and termination condition. The parent delegates a self-contained subtask, waits for a single structured result, and integrates it. The parent does **not** observe the subagent's intermediate steps.

```
Parent context: [.....task.....][delegate]──────────────┐
                                                        │
                                                        ▼
                                          Subagent: [own loop]
                                                        │
                                          ┌─── result ◀─┘
                                          ▼
Parent context: [.....task.....][delegate][result][continue...]
```

The information hiding is the value. If the parent must see every step, you do not need a subagent — you need a function.

---

## Two Spawn Modes

| Mode | Context | Cache | Use when |
|------|---------|-------|----------|
| **Fork** | Inherits full parent context | Shares parent prefix cache | Open-ended research where parent's context is load-bearing background |
| **Fresh** | Empty; only briefing prompt | New cache line | Specialized agent (different system prompt) or strict isolation |

### Fork

```python
fork = harness.spawn(
    mode="fork",
    prompt="Audit branch for ship-readiness. Report blockers in <200 words.",
)
```

- Cheap: shares prompt cache with parent
- Briefing is a **directive** — what to do, not what the situation is. Parent context is already there.
- Parent must not peek at the fork's transcript mid-flight (defeats the isolation purpose; pulls tool noise into parent context)

### Fresh

```python
fresh = harness.spawn(
    mode="fresh",
    subagent_type="security-reviewer",
    prompt=full_briefing_with_context,
)
```

- Expensive on first turn: no cache hit on parent prefix
- Briefing is a **briefing** — full context, file paths, line numbers, what was tried, what's in scope
- Terse command-style prompts produce shallow generic work in fresh agents

**Rule:** if the subagent needs to understand the parent's situation, fork. If the subagent needs a different system prompt or strict context isolation, fresh.

---

## Briefing Rules

### Fresh subagent prompts must be self-contained

A fresh subagent has zero context. Treat the prompt like onboarding a smart colleague who just walked in.

```
Goal:        ────────────────────────────────────────
What to do:  ────────────────────────────────────────
Context:     ────────────────────────────────────────
  - what surrounding system does
  - what's already been tried/ruled out
  - file paths, line numbers, exact identifiers
Constraints: ────────────────────────────────────────
  - response length, format, return shape
Out of scope:────────────────────────────────────────
```

### Never delegate understanding

Anti-pattern in parent prompt:
> "Based on your findings, fix the bug."
> "Based on the research, implement the change."

These push synthesis onto the subagent because the parent did not do it. Result: subagent guesses, parent rubber-stamps. Write briefings that prove the parent understood — file paths, line numbers, what specifically changes.

### Output contract

Every spawn specifies the return shape. The parent merges structured output, not free text.

```python
fork = harness.spawn(
    mode="fork",
    prompt=task,
    output_schema={
        "type": "object",
        "properties": {
            "blockers": {"type": "array", "items": {"type": "string"}},
            "ready_to_ship": {"type": "boolean"},
        },
        "required": ["blockers", "ready_to_ship"],
    },
)
```

---

## Parallel Dispatch

Independent subagents must launch in a **single message** (or single batch) so they run concurrently. Sequential spawns serialize the latency.

```python
results = await asyncio.gather(
    harness.spawn(mode="fork", prompt=audit_security_prompt),
    harness.spawn(mode="fork", prompt=audit_perf_prompt),
    harness.spawn(mode="fork", prompt=audit_tests_prompt),
)
```

Independence check before paralleling:

- No subagent's prompt depends on another's result
- No two subagents write to the same workspace path
- Aggregating order does not matter (or is enforced post-merge)

If any of these fail, run sequentially or merge their work into one subagent.

---

## Isolation Modes

| Mode | Workspace | Use when |
|------|-----------|----------|
| **Inline** | Shares parent's cwd / fs state | Read-only research |
| **Worktree** | Git worktree at temp path, own branch | Implementation work; auto-cleanup if no changes |
| **Sandbox** | Container or microVM | Untrusted code execution; destructive experiments |

Worktree is the default for implementation subagents. The harness returns the path and branch on completion (so the parent can review/merge); cleans up automatically if the subagent made no changes.

---

## Don't Race, Don't Peek

After dispatching a subagent, the parent **knows nothing** about its progress until completion. Two failure modes:

1. **Peeking.** Tailing the subagent's transcript mid-flight pulls its tool noise into parent context — exactly what the subagent was meant to prevent. Trust the completion notification.
2. **Racing / fabricating.** If the user asks a follow-up before the subagent returns, the parent must answer "still running, status X" — never predict, summarize, or invent the subagent's result. The notification arrives later as a separate event.

This is the discipline that makes subagent context-savings real.

---

## Result Merge

Merge is a parent-side operation and must handle:

- **Partial failure.** N of M subagents succeed. Parent decides: proceed with partial, retry failed, escalate to human.
- **Conflicting outputs.** Two subagents propose incompatible changes to the same file. Parent must reconcile or pick.
- **Format drift.** Subagent ignored output schema. Parent validates, re-prompts, or treats as failure.

```python
async def merge_audits(specs):
    forks = [harness.spawn(mode="fork", **s) for s in specs]
    results = await asyncio.gather(*forks, return_exceptions=True)
    succeeded = [r for r in results if not isinstance(r, Exception)]
    failed = [(s, r) for s, r in zip(specs, results) if isinstance(r, Exception)]
    if len(succeeded) < len(specs) // 2:
        raise SubagentQuorumFailed(failed)
    return aggregate(succeeded), failed
```

---

## Failure Containment

A subagent must not crash the parent. The harness must:

- Timeout the subagent (parent-side wall clock, not just step count)
- Capture stderr / exception, surface as structured failure
- Bound subagent recursion depth (subagent spawning subagent spawning ...)
- Apply parent's permission gates to subagent tool calls (subagents do not escape sandbox)

```python
class SubagentPolicy:
    max_depth: int = 2
    max_wall_seconds: int = 600
    max_cost_usd: float = 0.50
    inherit_sandbox: bool = True
```

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Spawning fresh when fork would do | Cache miss; verbose briefing required | Default to fork unless system prompt differs |
| Terse fresh-agent prompt | Shallow output | Full briefing — context, paths, constraints |
| Parent peeks at subagent transcript | Context fills with subagent noise | Trust completion notification only |
| Sequential spawns of independent work | Latency multiplied | Single-batch dispatch |
| No output schema | Free-text merge complexity | Define return shape per spawn |
| Subagent inherits all parent tools | Scope creep, more failure surface | Pass restricted tool subset |
| Recursion bomb (subagent spawns subagent...) | Cost explosion | Enforce max_depth |

---

## When NOT to Use

- **Task fits comfortably in one context** — decomposition adds overhead with no isolation benefit
- **Parent needs to observe each step** — that is a function call, not a subagent
- **Subtask is <1 LLM turn** — spawn cost dominates
- **Output is unstructured prose the parent rewrites anyway** — just do it inline

---

## Design Checklist

- [ ] Spawn mode chosen explicitly (fork vs fresh) with reason
- [ ] Fresh-agent prompts are self-contained — context, paths, constraints, out-of-scope
- [ ] Fork prompts are directives — what to do, not what the situation is
- [ ] Output schema defined per spawn; parent validates on merge
- [ ] Independent subagents dispatched in a single batch (parallel)
- [ ] Isolation mode chosen (inline / worktree / sandbox) per risk
- [ ] Parent does not peek at in-flight subagent transcripts
- [ ] Parent does not fabricate or predict subagent results
- [ ] Timeout, cost cap, and recursion depth enforced
- [ ] Partial-failure path defined (quorum, retry, escalate)
- [ ] Subagent tool calls go through parent's permission/sandbox layer
- [ ] Telemetry attributes parent → subagent spans for cost attribution
