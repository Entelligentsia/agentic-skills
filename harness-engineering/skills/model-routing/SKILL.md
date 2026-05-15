---
name: model-routing
description: Use when an agent harness has access to multiple models (Opus/Sonnet/Haiku, or cross-vendor) and must pick the right one per turn based on capability, cost, latency, or load. Apply when designing the routing layer that sits in front of model invocation. Complements graceful-degradation (which covers fallback on failure); this skill covers proactive capability/cost routing. Covers routing signals, classifier design, cost ceilings, and stickiness vs per-turn re-routing.
---

# Model Routing

## Pain Signals — You Need This Pattern When:

- Most turns are simple but a few need top-tier reasoning; using the top model for everything is expensive
- Some turns are latency-critical (user typing) and others are not (background analysis)
- Cost per session varies wildly and most of it goes to easy turns that didn't need premium tiers
- Different agent roles have different needs (planner = capability, executor = cost) — same model is wrong for both
- You have multiple providers / models and want to use whichever is cheapest at adequate quality

**Routing is a proactive choice; graceful-degradation is reactive.** Routing picks the right model up-front; degradation switches when the chosen model fails. Both layers needed in serious harnesses.

---

## Core Principle

A router is a function `(turn_context) → model`. It runs before the model call. The choice depends on signals available at that point — and those signals must be cheap to compute.

```
turn_context ──▶ router ──▶ model_id ──▶ model_call
                  │
                  ├── signals: complexity estimate, latency budget, $ ceiling,
                  │           context size, tool-use need, role
                  │
                  └── policy: rules / classifier / bandit
```

The cheaper the routing decision, the more turns can benefit. A 200ms classifier on every turn is fine; a 3s LLM-as-router-judge defeats the point.

---

## Routing Signals

Compute these before routing:

| Signal | How |
|--------|-----|
| **Task complexity estimate** | Heuristic on prompt length, presence of code, math markers, planning verbs |
| **Required context size** | Sum of system + tools + history + user turn tokens |
| **Latency budget** | Set by call site (interactive=tight, batch=loose) |
| **Cost ceiling** | Per-turn $ limit; remaining session budget |
| **Tool-use likelihood** | Does the turn need tools? (some models cheaper for non-tool turns) |
| **Agent role** | Planner / executor / reviewer / summarizer — different needs |
| **User tier** | Free user → cheap; paid → premium |
| **Cache locality** | Sticking with the same model preserves cache; switching invalidates |

Not all signals are needed for every router. Start with role + complexity; add signals as routing decisions get more refined.

---

## Routing Strategies

### Rule-based

```yaml
routes:
  - when: { role: planner }
    model: claude-opus-4-7

  - when: { role: summarizer, context_tokens: { lt: 8000 } }
    model: claude-haiku-4-5

  - when: { role: executor, complexity: simple }
    model: claude-sonnet-4-6

  - default: claude-sonnet-4-6
```

Cheap, transparent, easy to test. The right starting point.

### Classifier-based

Small model (or heuristic) predicts which tier is needed:

```python
def classify_complexity(prompt: str, history: list[Message]) -> Tier:
    score = (
        0.3 * has_code_blocks(prompt)
        + 0.2 * has_math(prompt)
        + 0.3 * is_open_ended(prompt)
        + 0.2 * (len(history) > 10)
    )
    return Tier.HIGH if score > 0.6 else Tier.LOW
```

Or call a small LLM (Haiku) with a fixed cheap prompt to classify. Adds latency; only worth it if rules are insufficient.

### Bandit / learned

Multi-armed bandit over (route, outcome). Outcome = (success, cost, latency). Useful when many comparable routes and traffic is high. Operational complexity high — don't reach for it unless rules and classifiers genuinely fall short.

---

## Cache Interaction

Switching models invalidates cache. Each model keeps its own cache line.

Implications:

- **Sticky routing within a session** for hot path. Cheaper to use one model for many turns than to flip.
- **Re-route on natural breakpoints** — start of session, after compaction, on explicit role change.
- **Avoid per-turn re-routing** unless the savings exceed the cache loss.

Estimate routing benefit:

```
cache_loss   = expected_cache_read_tokens × (input_price - cache_read_price)
routing_gain = (current_model_cost - cheaper_model_cost)
route_if = routing_gain > cache_loss
```

If a session has good cache hit rate, sticky beats opportunistic. If first turn or cold start, route freely.

---

## Escalation

A common pattern: try cheap, escalate on failure.

```python
def try_with_escalation(turn):
    cheap_result = call_model(haiku, turn)
    if quality_check(cheap_result) == "insufficient":
        return call_model(opus, turn)
    return cheap_result
```

Quality check options:

- Self-rated confidence (model emits confidence; threshold check)
- Output validator (schema, length, refusal pattern)
- Downstream usage failure (tool call returned error from bad args; re-route)

Escalation costs both calls when it triggers. Worth it if escalation rate is low (< 20%).

---

## Cost Budget Enforcement

Per-session $ ceiling acts as a hard router constraint:

```python
def route(turn, session):
    remaining = session.budget_usd - session.spent_usd
    estimated_cost = estimate_cost(turn, primary_model)
    if estimated_cost > remaining:
        return cheapest_capable_model(turn)
    return primary_model
```

When budget runs out, downgrade or stop — don't silently overspend.

---

## Multi-Provider

If routing across providers (Anthropic, OpenAI, etc.):

- Capability mappings differ; not all features (tool use, vision, caching) work the same
- Keep prompt templates provider-portable, or maintain per-provider variants and route to the right one
- Cost models differ; price-aware routing must use per-provider pricing
- Evaluation must cover all routes; degradation on one provider hides behind average

The complexity rises sharply. Most teams should pick one provider, route within its tiers, and bring multi-provider only when there is a clear gap.

---

## Coordination with Graceful Degradation

| | Routing | Graceful Degradation |
|---|---|---|
| When | Before call | After failure |
| Trigger | Signals (complexity, budget) | Error, timeout, refusal |
| Goal | Right tool for the job | Keep system running |
| Cache | Choosing same model preserves cache | Fallback model has its own cache |

Pipeline:

```
turn ──▶ router ──▶ chosen_model ──▶ call ──▶ ok? ──▶ done
                                       │  no
                                       ▼
                                 degradation ──▶ fallback model ──▶ ok?
```

Both layers; don't conflate.

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Per-turn flapping between models | Cache hit rate near zero | Sticky routing within session |
| Routing decision call is itself expensive | Latency added to every turn | Heuristic / small classifier; not LLM-as-judge |
| Capability mismatch unknown until failure | Bad output, retries | Eval per route to know capability boundary |
| No budget enforcement | Cost overruns | Hard ceiling check in router |
| Provider-specific features in shared template | Breaks on routing | Per-provider variants or feature-detect |
| Escalation rate too high | Paying for two calls per turn | Re-tune cheap-tier eligibility |
| Routing logic in many places | Inconsistent decisions | Centralize router; one decision point |
| Hidden routing in middleware | Operators surprised by costs | Surface model in telemetry per turn |

---

## When NOT to Use

- **Single-model harnesses** — no routing decision exists
- **Latency too tight to add even a heuristic** — rare; most heuristics are <1ms
- **Cost not a concern** (small scale) — premium-everything is fine until it isn't

---

## Design Checklist

- [ ] Routing signals chosen and computable cheaply (well under 50ms)
- [ ] Strategy chosen: rules / classifier / bandit; rules as default
- [ ] Routes documented; per-route capability and cost known from eval
- [ ] Sticky-within-session policy unless explicit re-route signal
- [ ] Cache impact factored into route decisions
- [ ] Escalation pattern defined where cheap-first is appropriate; escalation rate monitored
- [ ] Hard cost-ceiling enforcement; downgrade or stop on budget exhaustion
- [ ] Centralized router; one decision point per turn
- [ ] Telemetry: model chosen per turn, routing reason, escalation rate, cost by route
- [ ] Coordination with graceful-degradation: distinct layers, both present
- [ ] Eval covers all active routes; capability boundaries known
- [ ] Multi-provider only when single-provider tiering is exhausted
