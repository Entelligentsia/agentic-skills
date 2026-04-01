---
name: graceful-degradation
description: Use when an LLM-powered feature must remain functional when the primary model is slow, down, over budget, or producing low-quality results. Apply when building any production AI feature that users depend on. Covers fallback chains, semantic routing, circuit breakers, cost management, and degradation levels.
---

# Graceful Degradation

## Pain Signals — You Need This Pattern When:

- The primary model goes down and the entire feature stops working
- LLM latency spikes cause timeouts and users see error pages
- API costs are unpredictable and occasionally spike beyond budget
- All inputs — trivial and complex — go to the same expensive model
- There is no defined behaviour for "what happens when the AI fails"
- A simple keyword query hits the LLM when a database lookup would suffice

---

## Core Principle

An LLM call is an **external service call** with all the same failure modes: latency spikes, outages, rate limits, cost overruns. Production systems must degrade gracefully, not catastrophically.

Define **degradation levels** upfront — what the system does at each level of failure.

```
Level 0: Primary model, full quality        ← normal operation
Level 1: Faster/cheaper model, good quality ← latency or cost pressure
Level 2: Cached or pre-computed response    ← model unavailable
Level 3: Deterministic fallback             ← complete AI failure
Level 4: Honest failure message             ← nothing works
```

---

## Fallback Chain

Try progressively simpler strategies until one succeeds. Each level sacrifices some quality for reliability.

```python
class FallbackChain:
    def __init__(self, strategies: list[Strategy]):
        self._strategies = strategies  # ordered: best quality first

    def execute(self, request: Request) -> Response:
        errors = []
        for strategy in self._strategies:
            try:
                result = strategy.execute(request)
                if result.is_acceptable():
                    return result
                errors.append(f"{strategy.name}: quality below threshold")
            except Timeout:
                errors.append(f"{strategy.name}: timeout")
            except RateLimitError:
                errors.append(f"{strategy.name}: rate limited")
            except Exception as e:
                errors.append(f"{strategy.name}: {e}")

        # All strategies failed — return honest error
        return Response.service_degraded(
            message="I'm unable to process this right now. Please try again shortly.",
            errors=errors
        )

# Compose the chain
chain = FallbackChain([
    PrimaryModelStrategy(model="claude-sonnet-4-6", timeout=10),
    FasterModelStrategy(model="claude-haiku-4-5-20251001", timeout=5),
    CachedResponseStrategy(cache=response_cache, max_age_hours=24),
    DeterministicFallback(rules=business_rules),
])
```

---

## Semantic Router

Route inputs to the appropriate handler based on complexity, topic, or intent. Not every query needs the most capable model.

```python
class SemanticRouter:
    def __init__(self, routes: list[Route]):
        self._routes = routes

    def route(self, query: str) -> Handler:
        # Fast classification — cheap model or embeddings
        intent = self._classify(query)

        for route in self._routes:
            if route.matches(intent):
                return route.handler

        return self._default_handler

# Define routes
router = SemanticRouter([
    Route(
        intent="faq",
        handler=FAQLookupHandler(faq_database),      # no LLM needed
        description="Questions answerable from FAQ database"
    ),
    Route(
        intent="simple_query",
        handler=FastModelHandler(model="claude-haiku-4-5-20251001"),
        description="Simple questions, lookups, formatting"
    ),
    Route(
        intent="complex_analysis",
        handler=PrimaryModelHandler(model="claude-sonnet-4-6"),
        description="Multi-step reasoning, analysis, code generation"
    ),
])
```

**Key insight**: the router itself can be a cheap LLM call, an embedding similarity lookup, or a rule-based classifier. It should be fast and cheap — its job is to save cost and latency on the main call.

---

## Circuit Breaker

When a model endpoint fails repeatedly, stop calling it temporarily to prevent cascading failures and wasted cost.

```python
class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,  # seconds
    ):
        self._failure_count = 0
        self._threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._state = "closed"  # closed (normal), open (blocking), half-open (testing)
        self._last_failure: float = 0

    def call(self, fn: Callable, *args, **kwargs):
        if self._state == "open":
            if time.time() - self._last_failure > self._recovery_timeout:
                self._state = "half-open"
            else:
                raise CircuitOpen("Service is temporarily unavailable")

        try:
            result = fn(*args, **kwargs)
            if self._state == "half-open":
                self._state = "closed"
                self._failure_count = 0
            return result
        except Exception as e:
            self._failure_count += 1
            self._last_failure = time.time()
            if self._failure_count >= self._threshold:
                self._state = "open"
            raise
```

---

## Cost Management

LLM costs are proportional to token consumption. Control costs at multiple levels.

```python
class CostAwareDispatcher:
    def __init__(self, hourly_budget: float, cost_tracker: CostTracker):
        self._budget = hourly_budget
        self._tracker = cost_tracker

    def dispatch(self, request: Request) -> Response:
        current_spend = self._tracker.current_hour_spend()
        budget_remaining = self._budget - current_spend

        if budget_remaining <= 0:
            return self._cached_or_fallback(request)

        if budget_remaining < self._budget * 0.2:
            # Under 20% budget — use cheaper model
            return self._cheap_model(request)

        return self._primary_model(request)
```

**Cost control strategies**:

| Strategy | Mechanism |
|----------|-----------|
| **Token budgets** | Set `max_tokens` on every call — never let the model ramble |
| **Model tiering** | Route cheap queries to cheap models |
| **Caching** | Cache responses for identical or similar queries |
| **Rate limiting** | Limit calls per user/minute to prevent abuse |
| **Prompt compression** | Summarise context to reduce input tokens |

---

## Caching

Cache LLM responses for queries that are identical or semantically similar.

```python
class SemanticCache:
    def __init__(self, embedder: Embedder, store: VectorStore, similarity_threshold: float = 0.95):
        self._embedder = embedder
        self._store = store
        self._threshold = similarity_threshold

    def get(self, query: str) -> Optional[CachedResponse]:
        embedding = self._embedder.embed(query)
        results = self._store.search(embedding, limit=1)
        if results and results[0].score >= self._threshold:
            cached = results[0].metadata['response']
            return CachedResponse(response=cached, cache_hit=True)
        return None

    def put(self, query: str, response: str, ttl_hours: int = 24) -> None:
        embedding = self._embedder.embed(query)
        self._store.insert(
            embedding=embedding,
            metadata={'query': query, 'response': response, 'expires': now() + hours(ttl_hours)}
        )
```

---

## When NOT to Use

- **Prototypes and internal tools** — graceful degradation adds complexity. Only invest in it for production, user-facing features.
- **When failure is acceptable** — if the user can simply retry and a brief outage is tolerable, a simple error message may suffice.
- **When the LLM is not on the critical path** — if the LLM enhances but does not gate the user experience (e.g. optional suggestions), a hard failure is fine.

---

## Design Checklist

- [ ] Degradation levels are defined upfront — what happens at each failure severity
- [ ] Fallback chain has at least 3 levels: primary model → cheaper model → cached/deterministic
- [ ] Circuit breaker prevents repeated calls to a failing endpoint
- [ ] Semantic routing directs simple queries to cheaper handlers
- [ ] Cost budgets are enforced per hour/day with automatic degradation when exceeded
- [ ] Caching is in place for repeated or semantically similar queries
- [ ] Timeout is set on every LLM call — never wait indefinitely
- [ ] Every degradation event is logged with the level and reason for monitoring
