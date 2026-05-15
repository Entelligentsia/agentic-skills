---
name: workspace-state
description: Use when an agent operates on a filesystem workspace and the harness must track which files have been read, edited, or moved — so tool calls can detect stale reads, prevent conflicting writes, and enforce read-before-edit invariants. Apply when designing the workspace/cwd state model. Covers file-state tracking, mtime/hash invariants, cwd persistence across tool calls, diff awareness, and external-mutation detection.
---

# Workspace State

## Pain Signals — You Need This Pattern When:

- Agent edits a file based on a stale view; the file changed since the read and the edit clobbers external work
- `cd foo` in one bash call has no effect on the next — agent gets confused about cwd
- Edit tool replaces text that no longer exists in the file (hallucinated stale content)
- Two parallel tool calls both edit the same file; one wins silently
- User edits a file in their editor while the agent is mid-task; no one notices the conflict
- Agent re-reads the same file three times because it cannot remember what it has seen

**The workspace is shared mutable state.** The agent, the user, and any background processes all touch it. Without tracking, races and stale views are routine.

---

## Core Principle

The harness maintains a **shadow map** of workspace state — what has been read, when, with what content hash. Tool calls consult and update this map. Edits assert preconditions; reads update the map; external changes are detectable.

```
workspace shadow:
  src/api.py      last_read_at=12, hash=ab12, agent_edits=2
  tests/api.py    last_read_at=15, hash=cd34, agent_edits=0
  README.md       last_read_at=3,  hash=ef56, agent_edits=0
                                              external_change=DETECTED at t=20
```

The shadow is an in-memory authority for "what does the agent know about the workspace right now."

---

## File State Tracking

Per file:

```python
@dataclass
class FileState:
    path: str
    last_read_at: int          # turn number
    last_edit_at: int | None
    hash_at_last_read: str
    mtime_at_last_read: float
    agent_edit_count: int
    pinned: bool = False       # never auto-evict
```

Updates:

- `Read(path)` → set last_read_at, hash, mtime
- `Edit(path)` → first verify hash matches; on success update fields
- `Write(path)` → set hash, mtime; treat as both read and edit
- `Bash(...)` that touches files → tricky; see below

---

## Read-Before-Edit Invariant

Edit tools must verify the file matches its last-known state.

```python
async def edit(path: str, old_string: str, new_string: str):
    state = workspace.get(path)
    if state is None:
        raise EditWithoutReadError(f"must Read {path} before Edit")
    if not await _hash_matches(path, state.hash_at_last_read):
        raise StaleReadError(f"{path} changed since last read")
    apply_edit(path, old_string, new_string)
    workspace.refresh(path)
```

This catches three classes of bug:

1. Agent edits a file it never read (hallucinated content)
2. External process changed the file between read and edit
3. Agent's own earlier edit invalidated the read (chain of edits without re-reads)

The error must be informative: "file changed since you last read it; re-read and try again." The model recovers from this gracefully if the message is clear.

---

## External Mutation Detection

Files can change outside the agent's tool calls — user edits in their editor, formatters run on save, git operations, other processes.

Detection points:

- **On every Read** — compare with prior shadow; if hash differs, log "external change since t=N"
- **Pre-Edit** — the read-before-edit check naturally catches this
- **Periodic scan** (optional) — for long sessions, opportunistic check on idle

When external change detected:

- Update the shadow with new state
- If the file was pinned or had pending edits planned, surface a warning to the agent: "user-edit detected; reconcile before continuing"

---

## Cwd Persistence (Bash and similar)

Shell tools have an obvious gotcha: `cd foo` in call 1 does not affect call 2 because each call is a fresh subprocess. Two harness designs:

| Design | Pro | Con |
|--------|-----|-----|
| **Stateless shell, absolute paths only** | Predictable; no hidden state | Verbose; agent must use absolute paths |
| **Persistent shell session** | `cd` works as expected | More state to manage; one-bug crashes session |

Harness convention should pick one and document. Most LLM coding harnesses use stateless: each Bash call starts at the project root, agent passes absolute paths or `cd ... && cmd` chains. Document explicitly so the model learns.

```
Stateless rule: each Bash call's cwd is the workspace root.
To run a command in a subdir, use: `cd subdir && cmd` in a single call.
```

Do not silently track cwd state in some tools and not others. Predictable beats convenient.

---

## Bash and File Touches

Bash can read, write, move, and delete files outside the harness's tool layer. The shadow cannot perfectly track this without parsing the command.

Pragmatic approach:

- After every Bash call, opportunistically refresh shadow entries for files in the workspace that have changed mtime
- Heuristic detection: if Bash output looks like it modified files (git commit, mv, rm, build), invalidate shadow more aggressively
- Worst case: agent re-reads if a subsequent Edit fails the hash check — recoverable

Don't try to parse bash for perfect tracking. The hash-check on edit is the safety net.

---

## Concurrent Edits

If two tool calls in the same turn both Edit the same file:

- Serialize by resource key (workspace lock per path) — see concurrency-control skill
- The second sees the post-first hash; its precondition either still matches or fails cleanly
- Never silently overwrite

For parallel Reads of the same file: trivially safe; just dedupe to one read and share.

---

## Diff Awareness

Track per-file `agent_edit_count` and the cumulative diff vs session start:

- Surface "files this agent has touched" at session boundaries
- Useful for review, commit messages, summaries
- Useful for permission gates — "this turn would touch infra/, escalate"

```python
def session_diff(workspace) -> dict[str, FileDiff]:
    return {
        path: workspace.diff_against_session_start(path)
        for path in workspace.touched_paths()
    }
```

---

## Eviction

Shadow grows with every read. Bound it.

- LRU eviction by last_read_at
- Pinned entries never evicted (files the agent edited; will likely re-edit)
- Cap (e.g., 200 entries) — when full, evict least-recently-read non-pinned

If an evicted file is re-encountered, treat it as new (no stale-check possible). The agent will re-read; safety preserved.

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| No read-before-edit check | Edit clobbers external changes | Hash check; refuse on mismatch |
| Edit succeeds with hallucinated old_string | File silently corrupted | Strict exact-match check before write |
| Cwd tracked in some tools, not others | Confusing model behavior | Pick stateless or stateful, apply uniformly |
| Bash modifies files invisibly | Shadow drifts from reality | Opportunistic mtime scan after Bash |
| Two parallel Edits on same file | Last-writer-wins | Per-path lock |
| External edits go unnoticed | Conflicting work | Hash compare on next read; warn |
| Shadow grows unbounded | Memory leak in long sessions | LRU evict |
| Stale-read errors confuse the model | Agent loops re-reading | Error message must instruct: "re-read and try again" |
| Workspace path-traversal | Agent edits outside workspace | Canonicalize + validate within workspace root |

---

## When NOT to Use

- **Read-only agents** — no edits, no need to track much beyond last-read
- **Stateless one-shot tools** that operate in tmpdirs and clean up
- **Pure-API agents** with no filesystem touch

For any harness with Edit / Write tools, workspace state tracking is mandatory.

---

## Design Checklist

- [ ] Per-file shadow state: hash, mtime, last_read_at, last_edit_at, edit_count
- [ ] Read updates shadow; Edit verifies precondition before applying
- [ ] Read-before-edit invariant enforced; clear error on stale read
- [ ] External-mutation detection on every Read; user-edit conflicts surfaced
- [ ] Cwd policy documented (stateless or persistent); applied uniformly across tools
- [ ] Bash-induced changes refreshed opportunistically (mtime scan)
- [ ] Per-path lock for concurrent edits within a turn
- [ ] Workspace boundary enforced (no edits outside root; symlinks resolved)
- [ ] Session diff queryable: list of touched paths with cumulative changes
- [ ] Shadow eviction policy bounds memory
- [ ] Permission gates can read shadow (path-pattern matching for risk class)
- [ ] Coordination with concurrency-control: workspace lock = canonical resource lock
