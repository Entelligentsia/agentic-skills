---
name: concurrency-control
description: Use when a model emits multiple tool calls in a single turn and the harness must execute them in parallel safely, or when subagents/forks run concurrently and share state. Apply when designing the concurrency model for tool dispatch. Covers parallel tool execution, ordering guarantees, cancellation propagation, race detection on shared resources (filesystem, db), partial-failure semantics, and result aggregation.
---

# Concurrency Control

## Pain Signals — You Need This Pattern When:

- Model emits multiple tool calls per turn; serial execution multiplies latency
- Subagents run concurrently and may touch the same workspace
- Tool calls of mixed cost (fast read, slow API call) serialized waste time
- Two tool calls write to the same file and the second silently overwrites the first
- Cancellation needs to stop a fan-out cleanly without zombie operations

**Concurrency is latency leverage.** Done right: 5× speedup on independent work. Done wrong: race conditions, partial state, debugging nightmares.

---

## Core Principle

Three orthogonal questions per turn:

1. **Independence.** Can these tool calls run without affecting each other?
2. **Ordering.** Does the model expect results in a particular order?
3. **Failure semantics.** What happens when one of N fails — proceed, abort all, retry?

The harness answers these *per turn*, not globally. Some turns are pure-parallel; some are strictly sequential; many are mixed.

---

## Independence Detection

The model often emits multiple tool-use blocks in one response. They are not always independent.

| Independent | Conflicting |
|-------------|-------------|
| `Read(a.py)`, `Read(b.py)` | `Edit(a.py)`, `Edit(a.py)` |
| `Grep(...)`, `Bash(git status)` | `Bash(cd foo)`, `Bash(ls)` (cwd state) |
| `WebFetch(url1)`, `WebFetch(url2)` | `Write(out)`, `Read(out)` |
| Two reads to same DB | Read-after-write to same row |

Heuristics:

- **Reads are always parallelizable** (within rate limits)
- **Writes to disjoint paths/keys are parallelizable**
- **Writes to overlapping resources serialize**
- **Stateful tools (shell with cwd, REPL session) serialize within their state**

Build a per-tool concurrency descriptor:

```python
class ToolConcurrency:
    safe_parallel: bool          # always parallel-safe
    resource_keys: Callable      # given args, return resource identifiers
    serializes_with: list[str]   # other tools that conflict
```

The dispatcher computes a conflict graph from the turn's tool calls and schedules accordingly.

---

## Parallel Dispatch

```python
async def dispatch_turn(tool_calls: list[ToolCall]) -> list[ToolResult]:
    groups = topological_groups(tool_calls)  # parallel within group, sequential between
    results: dict[str, ToolResult] = {}
    for group in groups:
        group_results = await asyncio.gather(
            *(execute(tc) for tc in group),
            return_exceptions=True,
        )
        for tc, r in zip(group, group_results):
            results[tc.id] = normalize(r)
    return [results[tc.id] for tc in tool_calls]
```

Key properties:

- Results returned in the original order the model emitted (so the model sees a predictable sequence)
- Failures wrapped, not raised (one failure doesn't crash the gather)
- Group boundaries enforce serialization where conflicts exist

---

## Ordering vs Parallelism

The model's output order is the *intent*; execution order is harness's choice as long as causal dependencies are preserved.

- **Result feed order = intent order.** Always feed `tool_result` blocks back in the same order the model emitted `tool_use` blocks. Out-of-order feeds confuse the model.
- **Execution order ≠ feed order.** Parallel execution finishes in completion order; collect and re-sort to intent order before feeding.

This is non-negotiable. Without it, the model believes the second tool returned what was actually the first's result.

---

## Race Detection

Even with independence analysis, races slip in. Defenses:

- **Optimistic + verify.** Tool reads include a hash/mtime; subsequent edits assert it; on mismatch, fail with "external mutation detected." Pairs with workspace-state skill.
- **Locks per resource key.** Cheap shared map of `key → asyncio.Lock` for resources without first-class locking.
- **Idempotency keys.** Especially for external API writes — same key = same effect.
- **Two-phase write.** Stage to temp; commit-rename. Handles partial-write crash.

```python
async def edit_with_check(path: str, expected_hash: str, edit_fn):
    async with workspace.lock(path):
        actual = await workspace.hash(path)
        if actual != expected_hash:
            raise StaleReadError(path)
        await edit_fn(path)
        return await workspace.hash(path)
```

---

## Partial Failure

Three policies; choose per turn or per tool class:

| Policy | Behavior |
|--------|----------|
| **All-or-nothing** | One failure → cancel siblings, return partial results to model with error context |
| **Best-effort** | Failures recorded; siblings complete; model decides next action |
| **Quorum** | Need M of N successful; below threshold = turn failure |

Best-effort is the right default for read-heavy parallel turns. All-or-nothing for write fan-outs where partial state is incoherent. Quorum for redundant-source patterns (search 3 indexes, need 2).

The model should always see the full result map — successes and structured failures. Truncating to "first error wins" hides information the model needs to recover.

---

## Cancellation Propagation

Cancellation must reach every in-flight task.

```python
async def dispatch_with_cancel(tool_calls, cancel_event):
    tasks = [asyncio.create_task(execute(tc)) for tc in tool_calls]
    done, pending = await asyncio.wait(
        tasks, return_when=asyncio.FIRST_COMPLETED
    )
    if cancel_event.is_set():
        for t in pending:
            t.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
    ...
```

Cancellation must:

- Reach the tool's underlying I/O (close HTTP connection, kill subprocess)
- Mark partial results as cancelled in transcript
- Not leave orphan resources (locks, temp files)

Tools should accept a cancellation token / context and check it at await points.

---

## Subagent Concurrency

Concurrent subagents inherit all the above plus:

- **Workspace isolation per subagent.** Different worktrees, sandbox dirs — concurrent writes safe.
- **Token budget partitioned.** Don't let one subagent exhaust the session budget while siblings run.
- **Shared resource access policed.** If two subagents query the same paid API, rate limit applies across them.

Most subagent concurrency bugs trace to "subagents both wrote to the same file and the second won." Solve at workspace-isolation layer, not at runtime detection.

---

## Bounded Concurrency

Unbounded parallelism causes new problems: rate limit hits, fd exhaustion, memory pressure.

```python
class BoundedDispatcher:
    def __init__(self, max_concurrent: int = 8):
        self._sem = asyncio.Semaphore(max_concurrent)

    async def execute(self, tc):
        async with self._sem:
            return await self._tool.run(tc)
```

Cap based on what the harness's slowest dependency tolerates (model API rate limit, downstream service capacity). 8–16 is a reasonable starting point; tune from telemetry.

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Serial dispatch of independent tools | Latency multiplied | Parallel dispatch with conflict graph |
| Out-of-order result feed | Model misinterprets results | Sort to intent order before feeding |
| Two writes to same file | Last writer wins silently | Per-resource lock + stale-read check |
| Cancellation stops dispatcher, not tools | Zombie operations continue | Propagate to tool execution |
| First failure cancels all | Useful results discarded | Best-effort default; explicit policy |
| Unbounded parallelism | Rate limit storm, fd exhaustion | Semaphore-bounded dispatcher |
| Subagent shares parent workspace | Crossed writes | Worktree isolation per subagent |
| Stateful tool (cd, REPL) parallelized | Nondeterministic state | Mark serializable; run sequentially within state |
| Race in idempotency-key generation | Duplicate ops on retry | Deterministic key from (turn, tool, args) |

---

## When NOT to Use (Concurrency)

- **Truly sequential workflows** (tool B uses tool A's output) — parallelism gives nothing
- **Single-tool turns** — overhead exceeds benefit
- **Heavy state machines** where reasoning about concurrent state is harder than the latency saved
- **Strict ordering business requirements** (financial, audit) — make it explicit and serial

---

## Design Checklist

- [ ] Per-tool concurrency descriptor (safe_parallel, resource_keys, serializes_with)
- [ ] Dispatcher builds conflict graph per turn; topological groups for execution
- [ ] Independent tool calls run in parallel; conflicts serialize
- [ ] Result feed order matches model's intent order (not completion order)
- [ ] Per-resource locks for overlapping writes
- [ ] Optimistic-verify pattern for filesystem state (hash/mtime checks)
- [ ] Idempotency keys for external write tools
- [ ] Partial-failure policy chosen per turn class (best-effort / all-or-nothing / quorum)
- [ ] Failures returned to model as structured results, not hidden
- [ ] Cancellation propagates from dispatcher to tool I/O
- [ ] Bounded concurrency (semaphore) prevents rate-limit / resource exhaustion
- [ ] Subagents have isolated workspaces; shared resources policed
- [ ] Telemetry: parallelism factor per turn, conflict-serialized count, cancellation rate
