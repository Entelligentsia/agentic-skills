---
name: prompt-caching
description: Use when an agent harness makes repeated calls with large shared prefixes (system prompt, tool schemas, prior turns) and inference cost or latency matters. Apply when designing cache breakpoint placement, TTL selection, and turn structure to maximize hit rate. Covers Anthropic prompt cache mechanics (5-min/1-hour TTL, breakpoint rules, cache-aware ordering), measurement, and common pitfalls that silently break caching.
---

# Prompt Caching

## Pain Signals — You Need This Pattern When:

- Repeated calls share a large stable prefix (system prompt, tool schemas, retrieved docs, prior turns) and you are paying full input-token cost on every turn
- TTFT (time to first token) is dominated by prefix processing, not generation
- An agent loop runs many turns within minutes; each turn re-sends the full transcript
- A subagent fork inherits parent context — without caching, the fork pays the parent's prefix cost again
- Cost-per-session is high and dominated by input tokens, not output

**Caching is free latency and ~90% input-token cost reduction on hits.** If your harness has stable prefixes and you are not measuring `cache_read_input_tokens`, you are leaving money on the table.

---

## Core Principle

The Anthropic API hashes a **prefix** of your request and stores the model's internal KV state keyed by that prefix. A subsequent request whose first N bytes match a live cache entry skips re-processing those N bytes — the model resumes from saved state.

```
Request A:  [system][tools][history............][new turn]
                                ▲
                                cache_control breakpoint
                                ↓
                            cache write (5min TTL)

Request B:  [system][tools][history............][different turn]
            └─────────── prefix match ──────────┘
                                ▲
                                cache hit → ~10% cost, faster TTFT
```

Two rules govern everything:

1. **Prefix match is byte-exact.** Any change before the breakpoint — even a timestamp, reordered tool, or whitespace — invalidates the cache.
2. **Breakpoints are explicit.** You mark up to 4 cache breakpoints with `cache_control: {"type": "ephemeral"}`. The cache stores state up to each marked block.

---

## Mechanics (Anthropic-specific)

| Property | Value |
|----------|-------|
| TTL | 5 min default; 1 hour with `cache_control: {"type": "ephemeral", "ttl": "1h"}` |
| Max breakpoints | 4 per request |
| Min cacheable prefix | 1024 tokens (Sonnet/Opus); 2048 (Haiku) — below this, breakpoint is ignored |
| Write cost | ~1.25× normal input tokens (5min) / ~2× (1h) |
| Read cost | ~0.1× normal input tokens |
| Refresh on hit | Yes — every cache hit resets the TTL clock |
| Scope | Per-organization, per-model |

Response includes `usage.cache_creation_input_tokens` and `usage.cache_read_input_tokens`. **If both are zero, caching is not happening — investigate.**

---

## Breakpoint Placement

Order request blocks **most stable → most volatile**. Place breakpoints at the boundary between tiers.

```
┌────────────────────────────────┐
│ system prompt (stable)         │
├────────────────────────────────┤
│ tool definitions (stable)      │  ◀── breakpoint 1 (rarely changes)
├────────────────────────────────┤
│ retrieved context / KB docs    │  ◀── breakpoint 2 (per-session stable)
├────────────────────────────────┤
│ conversation history           │  ◀── breakpoint 3 (grows turn by turn)
├────────────────────────────────┤
│ current user turn              │     (no breakpoint — volatile)
└────────────────────────────────┘
```

### Recipe: stable agent harness

```python
def build_request(system, tools, kb_docs, history, user_turn):
    return {
        "model": "claude-opus-4-7",
        "system": [
            {"type": "text", "text": system, "cache_control": {"type": "ephemeral"}},
        ],
        "tools": [
            *[{**t} for t in tools[:-1]],
            {**tools[-1], "cache_control": {"type": "ephemeral"}},
        ],
        "messages": [
            {"role": "user", "content": [
                {"type": "text", "text": kb_docs, "cache_control": {"type": "ephemeral"}},
            ]},
            *history[:-1],
            # Mark the last history turn — caches the entire conversation prefix
            {"role": history[-1]["role"], "content": [
                *coerce_blocks(history[-1]["content"][:-1]),
                {**history[-1]["content"][-1], "cache_control": {"type": "ephemeral"}},
            ]},
            {"role": "user", "content": user_turn},
        ],
    }
```

The fourth breakpoint (rolling, on the last history block) is the high-value one for agent loops: each turn caches the *previous* turn, so the next turn hits the cache.

---

## Ordering Rules

Cache hits depend on byte-identical prefix. Every harness must enforce these:

1. **Stable serialization.** JSON key order, whitespace, escaping must be deterministic. `json.dumps(d)` without `sort_keys=True` will silently break caching when dict iteration order changes.
2. **Stable tool order.** If your harness builds the tools array from a dict or set, the order may shift between processes. Sort by tool name.
3. **No timestamps in cached regions.** A `"current time: 2026-05-06T14:23:01Z"` line in the system prompt invalidates the cache every second. Move volatile context to the unmarked tail.
4. **No per-request IDs in cached regions.** Request IDs, trace IDs, session IDs go after the last breakpoint or in metadata, not in the system prompt.
5. **Stable model ID.** Cache is per-model. Routing between Opus and Sonnet creates two independent cache lines — factor this into routing decisions.

---

## TTL Selection

| Scenario | TTL |
|----------|-----|
| Interactive agent loop, sub-minute turn cadence | 5 min (default) |
| Long-running session with idle gaps (user thinking, tool latency) | 1 hour |
| Batch processing same prefix across many independent requests | 1 hour |
| Single-shot calls | None — caching costs more than it saves |

Cache hits **refresh** the TTL. So a 5-min TTL is fine even for hours-long sessions, *if turns happen at least every 5 min*. If turn cadence is uneven (e.g., user away from keyboard), upgrade to 1h to avoid repaying the write cost.

**Anti-pattern:** defaulting to 1h "just in case." You pay 2× write cost up front; only worth it if expected idle gap > 5 min.

---

## Measurement

Every harness must surface cache metrics. Without measurement, caching breaks silently.

```python
def log_cache_metrics(usage, span):
    write = usage.get("cache_creation_input_tokens", 0)
    read = usage.get("cache_read_input_tokens", 0)
    raw_input = usage.get("input_tokens", 0)
    total_input = write + read + raw_input
    hit_rate = read / total_input if total_input else 0.0
    span.set_attributes({
        "cache.write_tokens": write,
        "cache.read_tokens": read,
        "cache.uncached_tokens": raw_input,
        "cache.hit_rate": hit_rate,
    })
```

Dashboard should show:

- **Hit rate** per session, per agent, per harness version. A drop from 0.85 → 0.10 between deploys means a serialization regression — investigate immediately.
- **Cost decomposition.** Write tokens × 1.25, read tokens × 0.1, raw × 1.0. The harness's value is read-token share.
- **TTL waste.** Sessions where write happened but no subsequent read (cache written, never used). Suggests TTL too short or cadence mismatch.

---

## Fork-and-Share-Cache

When a parent agent forks a subagent that inherits context, the fork's first turn should hit the parent's cache.

```
Parent at turn N:  [system][tools][history N]  ◀── cache write
                                                 │
                          ┌──────────────────────┘
                          ▼
Fork starts:       [system][tools][history N][fork instructions]
                   └──── prefix match ────┘   └── cache miss tail ──┘
```

Conditions:

- Fork uses **identical** system, tools, and history serialization as parent (same harness, same code path)
- Fork starts within TTL window
- Fork is to the **same model** as parent

If your harness rebuilds the request differently for forks (e.g., adds a "you are a subagent" preamble *before* the system prompt), you destroy the prefix match. Append fork-specific content **after** the last cache breakpoint.

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Timestamp in system prompt | Hit rate ≈ 0 | Move to message tail or metadata |
| Non-deterministic JSON serialization | Hit rate flaps | `sort_keys=True`, stable key order |
| Tool array reordered | Hit rate degrades after deploys | Sort tools by name at request build |
| Breakpoint below min token threshold | Cache silently not written | Combine small blocks; verify >1024 tokens |
| 5+ breakpoints attempted | API error | Choose the 4 highest-value boundaries |
| Caching the user turn | No hit (every user turn differs) | Place last breakpoint on prior assistant message, not current user message |
| Different model per turn | Two cache lines, low hit rate per line | Sticky routing within a session |
| Cache-control on every block | Wasted budget; only 4 honored anyway | Place exactly at tier boundaries |

---

## When NOT to Cache

- **Single-shot calls.** Write cost (1.25×) is unrecovered. Cache only when expecting ≥2 hits within TTL.
- **Highly volatile prefixes.** If the system prompt or tools change every call, caching costs more than it saves.
- **Below min-token threshold.** Breakpoint is ignored; you pay full price anyway.
- **Cross-model routing dominant path.** Each model has its own cache; routing diversity kills hit rate. Either pin model per session or accept lower cache value.

---

## Design Checklist

- [ ] Request blocks ordered most-stable → most-volatile
- [ ] Cache breakpoints placed at tier boundaries (system/tools, kb, history)
- [ ] At least one rolling breakpoint on the last assistant message in agent loops
- [ ] JSON serialization is deterministic (sorted keys, stable whitespace)
- [ ] Tool array is sorted before request build
- [ ] No timestamps, request IDs, or per-call identifiers above the last breakpoint
- [ ] TTL chosen based on expected turn cadence (5min default; 1h only if idle gaps likely)
- [ ] `cache_read_input_tokens` and `cache_creation_input_tokens` surfaced in telemetry
- [ ] Hit rate alarm in place — drops between deploys flagged automatically
- [ ] Fork/subagent paths verified to inherit parent cache (same model, same serialization)
- [ ] Model routing decisions account for cache-line fragmentation
