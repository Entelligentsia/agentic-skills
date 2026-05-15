---
name: memory-compaction
description: Use when an agent's conversation or working memory grows past the model's context window, or when long sessions accumulate stale tool output, repeated reads, and verbose traces that crowd out signal. Apply when designing how a harness summarizes, prunes, tiers (hot/warm/cold), or evicts history without losing load-bearing facts. Covers compaction triggers, summarization strategies, lossy vs lossless tradeoffs, and recovery from over-compaction.
---

# Memory & Compaction

## Pain Signals — You Need This Pattern When:

- Long sessions hit the context window ceiling and the API rejects the next turn
- Tool output (file reads, search results, command stdout) dominates the transcript and crowds out the user's actual instructions
- The agent forgets early-session decisions because they were truncated by a naive sliding window
- Cost per turn grows linearly with session length even when most history is stale
- An agent re-reads the same file three times in one session because the prior read was evicted
- Token budget is dominated by input cost, not output

**Compaction is a lossy compression problem.** The goal is to keep load-bearing facts (decisions, invariants, user goals) and discard repeatable detail (raw tool output, intermediate reasoning). Done wrong, the agent loses memory of why it is doing what it's doing.

---

## Core Principle

Treat the model's context as a **cache with eviction**, not a log. Three tiers:

```
┌─────────────────────────────────────────────────────────┐
│ HOT  — recent N turns, verbatim                         │  in-context
├─────────────────────────────────────────────────────────┤
│ WARM — older history, summarized into facts/decisions   │  in-context
├─────────────────────────────────────────────────────────┤
│ COLD — full transcript, indexed for re-fetch on demand  │  out-of-context
└─────────────────────────────────────────────────────────┘
```

Hot tier preserves the agent's working memory. Warm tier preserves session continuity. Cold tier preserves auditability and recovery. Anything not load-bearing in hot/warm goes to cold.

---

## Compaction Triggers

| Trigger | When to fire |
|---------|--------------|
| **Token threshold** | Prefix tokens > 70% of context window. Compact before hitting ceiling, not after. |
| **Turn count** | Every N turns. Predictable; pairs with cache (compact at cache-friendly boundaries). |
| **Idle gap** | Resuming after >1h idle — opportunity to compact while user is waiting on first response anyway. |
| **Tool-output spike** | A single turn added > X tokens of tool output. Likely repeatable; compact aggressively. |
| **Cost ceiling** | Per-session cost hit budget. Compact to reduce per-turn cost. |
| **Manual** | User says "summarize and continue" or harness operator triggers. |

**Default trigger: 70% of window.** Compacting at 95% leaves no headroom for the compaction call itself plus the next turn.

---

## What to Compact, What to Keep

### Almost always compactable

- Raw file reads (the file is on disk; re-read on demand)
- Search results (re-run the search)
- Long command stdout (logs go to cold tier)
- Intermediate tool outputs already acted on
- Repeated reads of the same artifact
- Verbose ReAct traces past the last decision point

### Almost never compactable

- The original user task / goal
- Decisions the agent made and the reason ("chose approach A because B")
- Invariants and constraints (deadlines, scope limits, user preferences)
- Errors and how they were resolved
- The current open thread of work
- Anything the agent will reference by name in the next few turns

### Judgement calls

- Code the agent wrote earlier in the session — keep summary + path; refetch full content if edited again
- Plan / todo list — keep current state, drop superseded versions
- User clarifications — keep the answer, drop the question turn

---

## Summarization Strategies

### Rolling summary

Maintain a single growing summary block. Each compaction folds the next chunk of history into it.

```
Turn 1..N:    [verbatim turns]
                    │
                    ▼
              [summary block] + [verbatim turns N+1..M]
                    │
                    ▼
              [updated summary] + [verbatim turns M+1..K]
```

Cheap and simple. Risk: summary drift — facts get blurred each rewrite. Mitigate by appending atomic facts rather than rewriting prose.

### Hierarchical summary

Multiple summary tiers: per-task summaries → per-session summary.

```
[session summary]
  ├─ [task-1 summary]
  │     ├─ turns 1..8 (compacted)
  │     └─ turns 9..15 (compacted)
  ├─ [task-2 summary]
  │     └─ turns 16..30 (compacted)
  └─ [hot] turns 31..N (verbatim)
```

Higher fidelity, more complex. Worth it for sessions spanning many tasks.

### Fact extraction

Compact into a structured side store, not prose.

```json
{
  "user_goal": "ship feature X by Friday",
  "decisions": [
    {"turn": 4, "what": "use Postgres not Mongo", "why": "existing infra"},
    {"turn": 11, "what": "skip migration tool, hand-write SQL", "why": "tool flaky on CI"}
  ],
  "open_threads": ["wire feature flag", "update docs"],
  "constraints": ["no breaking API changes", "must work offline"],
  "files_touched": ["src/api.py:45-90", "tests/api_test.py"]
}
```

Render the side store as a system-prompt prefix. Cheaper to update incrementally; survives rewrites better than prose. Pair with cold-tier transcript for full recall.

---

## Recovery from Over-Compaction

Compaction is lossy. Sometimes the agent compacts away a fact it later needs.

**Symptom:** agent says "I don't recall the original requirement" or repeats a question already answered.

**Mitigations, in order of cost:**

1. **Cold-tier re-fetch.** Cold transcript is indexed by session + turn + topic. Agent has a tool: `recall(query) → relevant past turns`. Cheap; preserves auditability.
2. **Sticky pin.** Mark turns the agent identifies as load-bearing (`pin_turn(id, reason)`). Pinned turns never compact below verbatim.
3. **Re-summarization with broader keep-set.** Detect over-compaction (agent repeatedly recalling), re-run compaction on the full cold transcript with stricter keep rules.
4. **Restart with seeded summary.** Last resort — fresh session, hand-curated summary as system prompt.

---

## Interaction with Prompt Cache

Compaction events **invalidate the cache** of everything below the compaction point. Schedule with this in mind:

- Compact at predictable boundaries (every N turns) so the cache window after compaction is reused for many subsequent turns
- Avoid compacting every turn — write cost dominates
- After compaction, the new prefix is stable — place a cache breakpoint at the compaction boundary
- If compaction happens mid-session at random thresholds, hit rate suffers

```
turn 50:    [system][summary v1][turns 40..50]   ◀── new breakpoint here
turn 51:    [system][summary v1][turns 40..51]   ◀── cache hit on prefix
turn 60:    [system][summary v2][turns 50..60]   ◀── compact, new breakpoint
turn 61:    [system][summary v2][turns 50..61]   ◀── cache hit on new prefix
```

---

## Pseudocode

```python
class MemoryManager:
    def __init__(self, window_tokens: int, hot_keep: int = 6):
        self._window = window_tokens
        self._threshold = int(window_tokens * 0.70)
        self._hot_keep = hot_keep
        self._summary: str | None = None
        self._facts: FactStore = FactStore()
        self._cold: TranscriptStore = TranscriptStore()

    def prepare(self, history: list[Message]) -> list[Message]:
        if count_tokens(history) < self._threshold:
            return history
        return self._compact(history)

    def _compact(self, history: list[Message]) -> list[Message]:
        hot = history[-self._hot_keep:]
        warm = history[:-self._hot_keep]
        self._cold.append(warm)
        new_facts = self._extract_facts(warm)
        self._facts.merge(new_facts)
        self._summary = self._render_summary(self._facts)
        return [
            {"role": "user", "content": f"[Session memory:\n{self._summary}\n]"},
            *hot,
        ]

    def recall(self, query: str) -> list[Message]:
        return self._cold.search(query, top_k=3)
```

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Naive sliding window | Agent forgets original goal | Always preserve task + decisions tier |
| Compacting at 95% | Compaction call itself OOMs | Trigger at 70% |
| Summary rewritten each compaction | Facts drift, dates wrong | Append-only fact store |
| No cold-tier recall | Compacted facts unrecoverable | Always persist full transcript |
| Compacting tool output before action | Agent acts on summary, not data | Compact only after the action that consumed the output |
| Compacting every turn | Cache thrash, write cost dominates | Compact at intervals |
| Summary in volatile region | Cache miss after every compaction | Place summary above last cache breakpoint |
| Pinning everything "important" | No compaction happens | Pinning is rare; default is compactable |

---

## When NOT to Compact

- **Sessions that fit comfortably in window** — premature compaction loses fidelity for no gain
- **Single-task batch jobs** — start fresh per task; no cross-task memory needed
- **Audit-critical sessions** where the model must reason over the verbatim transcript (compliance review, post-incident) — stream to cold tier but do not compact in-context

---

## Design Checklist

- [ ] Compaction trigger defined (token threshold + cadence)
- [ ] Three tiers implemented: hot (verbatim), warm (summary/facts), cold (indexed transcript)
- [ ] Keep-rules explicit: goal, decisions, invariants, open threads always preserved
- [ ] Compact-rules explicit: raw tool output, repeated reads, superseded plans go warm/cold
- [ ] Summary stored in cache-friendly position (above last breakpoint)
- [ ] Cold-tier `recall(query)` tool available to agent
- [ ] Pinning mechanism for load-bearing turns
- [ ] Recovery path for over-compaction (re-fetch, re-summarize, seed restart)
- [ ] Telemetry: pre/post token count, compaction frequency, recall calls, cache hit rate after compact
- [ ] Compaction does not happen mid-tool-call or mid-multi-turn reasoning
- [ ] Per-session memory store survives process restart (paired with session-persistence)
