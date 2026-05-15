---
name: session-persistence
description: Use when an agent harness must survive process restarts, resume interrupted work, fork a session for parallel exploration, or replay a transcript for debugging. Apply when sessions span hours/days, when crash recovery matters, or when humans need to audit/replay agent runs. Covers checkpoint format, transcript stores, fork/branch semantics, resume-from-step, and idempotent replay.
---

# Session Persistence

## Pain Signals — You Need This Pattern When:

- A crashed harness loses hours of agent work that cannot be cheaply re-run
- Users want to close their laptop mid-session and resume tomorrow
- Debugging a bad agent run requires replaying it step-by-step
- Operators need an audit trail of every model call, tool call, and decision
- A long-running task should be forkable — explore two approaches from a common ancestor
- Multiple processes (CLI, web UI, scheduled job) act on the same logical session

**Sessions are append-only event logs.** The in-memory state is a projection of the log. If you cannot reconstruct state by replaying the log, you do not have persistence — you have a cache.

---

## Core Principle

```
events.jsonl ──▶ replay ──▶ in-memory session state
     ▲                              │
     └────── append on every ───────┘
            event (turn, tool, hook)
```

Every state change is an event. Events are written **before** the action they describe is observable to the user (write-ahead). Crash recovery = replay events. Fork = copy log. Audit = read log.

---

## Event Schema

Minimum fields per event:

```json
{
  "session_id": "sess_abc",
  "seq": 42,
  "ts": "2026-05-06T14:23:01.123Z",
  "type": "tool_call" | "tool_result" | "model_request" | "model_response" | "user_message" | "compact" | "hook_decision" | "checkpoint",
  "payload": { ... },
  "parent_seq": 41,
  "harness_version": "1.4.2"
}
```

`seq` is monotonic per session; `parent_seq` enables branching (fork creates a child with same parent).

---

## Storage Backends

| Backend | Use when |
|---------|----------|
| **JSONL file** | Single-machine, single-user CLI harness |
| **SQLite** | Local with concurrent reads (UI + CLI on same session) |
| **Postgres / object store** | Multi-tenant; durability and search needs |
| **Append-only log + snapshot store** | Long sessions; periodic snapshots avoid full replay |

JSONL is the right default. Every event is one line; tail to follow live; replay is `for line in file: apply(json.loads(line))`. Move to richer backend only when JSONL hits a real wall.

---

## Checkpoint vs Event Log

Replay-from-zero is fine for short sessions. For long sessions, periodic snapshots cut recovery time:

```
events 1..100   ──▶ snapshot @ 100
events 101..200 ──▶ snapshot @ 200
events 201..247 ──▶ (no snapshot yet)

recover: load snapshot@200, replay events 201..247
```

Snapshot frequency is a tradeoff between recovery speed and write cost. Default: snapshot every N events or every M minutes, whichever first.

---

## Idempotent Replay

Replay must be deterministic. If applying event 47 twice produces a different state than applying it once, persistence is broken.

Rules:

- **Tool side effects are recorded, not re-executed.** On replay, `tool_result` events are read from log, not the tool re-run.
- **Model calls are recorded, not re-issued.** Replay reads `model_response` from log.
- **Time, randomness, IDs are recorded.** Anything non-deterministic at original execution must be in the event payload.
- **Replay flag.** State machine knows it is replaying; suppresses outbound side effects (Slack notifications, etc.) until caught up.

```python
class SessionReplayer:
    def __init__(self, store: EventStore):
        self._store = store
        self._replay_mode = False

    def restore(self, session_id: str) -> SessionState:
        snapshot, seq = self._store.latest_snapshot(session_id)
        state = snapshot or SessionState.empty()
        self._replay_mode = True
        for event in self._store.events_since(session_id, seq):
            state = apply_event(state, event)
        self._replay_mode = False
        return state
```

---

## Fork Semantics

Forking is "copy the log up to seq N, branch from there."

```
main:    e1 ─ e2 ─ e3 ─ e4 ─ e5 ─ e6
                       │
                       └─ fork: e4' ─ e5' ─ e6'
```

Implementations:

- **Copy-on-fork.** Duplicate event range; cheap if log is small. Each branch evolves independently.
- **Reference + diff.** Store branch as `parent_session_id + branch_seq` plus its own new events. Saves space; complicates replay.
- **Snapshot share.** Both branches read shared snapshot, only diverge on new events. Best for many short-lived forks.

For agent harnesses, copy-on-fork is the simple right answer until session sizes force optimization.

---

## Resume Semantics

Resume = restore state + continue from next user turn (or next scheduled action).

Edge cases the harness must handle:

- **Tool call in flight at crash.** Was the side effect applied? Replay sees `tool_call` but no `tool_result`. Three options: (a) fail and require human decision; (b) re-execute if tool is idempotent (declared per tool); (c) treat as failed and let the agent retry. Pick per-tool, document.
- **Model call in flight.** Cheap: just re-issue. Cache hit will save cost.
- **Hook in flight.** Treat as failed; replay does not re-run hooks (they may have side effects).
- **Schema drift.** Harness was upgraded between session writes. Either replay events through compatibility layer, or refuse to resume and document.

---

## Replay-Based Debugging

Persistence buys you a debugger. Operators load a session and step through events:

```
$ harness replay sess_abc --until 47
Loaded snapshot @ 40, applied events 41..47
State: 3 tool calls completed, model thinking about file structure

$ harness replay sess_abc --diff 46..47
Event 47: tool_call(Edit, file=src/api.py, ...)
State delta: workspace mtime changed for src/api.py
```

This requires events to be self-contained — every payload must have enough context to interpret without external lookup.

---

## Retention and GC

Event logs grow without bound. Decide:

- **Hot retention.** Resumable sessions kept fully accessible (e.g., 30 days)
- **Cold retention.** Audit-only, compressed, slow to fetch (1+ year, compliance-driven)
- **Purge.** Beyond cold retention, delete or anonymize per policy

PII review at the boundary. Tool args and outputs may contain user data; redact before cold-tier or apply field-level encryption.

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| State held in-memory only, log on side | Crash loses work | Write-ahead: log first, then mutate state |
| Replay re-executes tool calls | Side effects duplicated on resume | Record tool results; replay reads them |
| Non-determinism in event apply | Different state on replay | Record all randomness/time in payload |
| No snapshots, long sessions | Slow recovery | Periodic snapshot |
| Fork shares mutable log | Branches contaminate each other | Copy or copy-on-write |
| Schema breaking change | Old sessions unreadable | Version events; compatibility layer |
| PII in event log | Compliance violation | Redact at write or retain encryption keys per session |
| Session ID collision | Sessions overwrite | UUIDs, never user-input session names |
| Hooks re-fire on replay | Duplicate Slack messages | Suppress side effects under replay flag |

---

## When NOT to Use

- **Single-shot batch jobs.** No resume, no fork, no audit need — keep it simple.
- **Sessions <1 turn.** Persistence overhead exceeds value.
- **Stateless workflows** where each call is independent.

---

## Design Checklist

- [ ] Append-only event log with monotonic `seq` per session
- [ ] Write-ahead: log before action becomes observable
- [ ] Event schema versioned; `harness_version` recorded per event
- [ ] Tool results stored in log; replay does not re-execute tools
- [ ] Non-determinism captured in event payload (time, randomness, IDs)
- [ ] Replay flag suppresses external side effects until caught up
- [ ] Snapshots at predictable intervals; recovery loads snapshot + tail
- [ ] Fork semantics defined (copy / ref / snapshot-share) with clear isolation guarantees
- [ ] In-flight tool call resume policy defined per tool
- [ ] Schema migration / compatibility layer for upgrades
- [ ] Retention policy defined: hot, cold, purge
- [ ] PII handling at event boundary (redact or encrypt)
- [ ] Replay-based debugger / inspector tool exposed to operators
