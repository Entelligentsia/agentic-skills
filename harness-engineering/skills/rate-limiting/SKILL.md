---
name: rate-limiting
description: Use when an agent harness must respect upstream model/tool rate limits, manage quotas across concurrent sessions, and handle 429s without dropping work. Apply when designing the queue/throttle layer in front of model and tool calls. Covers token-bucket vs leaky-bucket, per-key vs global quotas, backoff strategies (exponential, jittered), queue fairness across sessions, and 429/Retry-After handling.
---

# Rate Limiting

## Pain Signals — You Need This Pattern When:

- Bursts of agent activity hit the model API's RPM/TPM ceiling and 429s spike
- One greedy session starves others on a shared API key
- Backoff retries pile on during incidents — making outages worse
- Tool calls (external APIs, DB) have their own rate limits and the harness ignores them
- Cost spikes because retries on 429 doubled the bill before respecting Retry-After

**Rate limiting is bidirectional.** The harness must respect upstream limits *and* fairly allocate its own capacity across concurrent users/sessions.

---

## Core Principle

Treat upstream limits as **shared resources** the harness must schedule against. Three interacting concerns:

1. **Predictive limiting** — know your budget and stay under it
2. **Reactive handling** — when you hit a limit anyway, back off correctly
3. **Fair allocation** — when capacity is scarce, distribute it across sessions

```
     sessions ──▶ ┌──────────┐ ──▶ predict ──▶ admit / queue
                  │  router  │
                  └──────────┘
                       │
                       ▼
                ┌──────────────┐ ──▶ upstream API
                │ token bucket │
                └──────────────┘     │
                       ▲             │ 429? Retry-After
                       └─────────────┘
```

---

## Limit Types

Anthropic API (and most LLM APIs) enforces multiple concurrent limits. All matter:

| Limit | Unit | What hits it |
|-------|------|--------------|
| **RPM** | requests / minute | Many small calls |
| **ITPM** | input tokens / minute | Long-prefix calls |
| **OTPM** | output tokens / minute | Long generations |
| **Concurrent** | in-flight requests | Many parallel sessions |

The harness can hit any of these. Track all four. Predict against all four.

---

## Token Bucket

Token-bucket is the right default. A bucket of capacity C refills at rate R; each request consumes 1 token (RPM bucket) or N tokens (TPM bucket). Empty bucket → request waits or rejects.

```python
class TokenBucket:
    def __init__(self, capacity: int, refill_per_sec: float):
        self._capacity = capacity
        self._refill = refill_per_sec
        self._tokens = capacity
        self._last = time.monotonic()

    async def acquire(self, n: int = 1):
        while True:
            now = time.monotonic()
            self._tokens = min(self._capacity, self._tokens + (now - self._last) * self._refill)
            self._last = now
            if self._tokens >= n:
                self._tokens -= n
                return
            wait = (n - self._tokens) / self._refill
            await asyncio.sleep(wait)
```

One bucket per limit dimension (RPM, ITPM, OTPM). Acquire from all before dispatching.

---

## Predictive Limiting

Estimate request size before sending. Cheap input-token estimate (tokenizer or char-count heuristic) is usually accurate enough.

```python
async def call_model(request):
    estimated_in = estimate_input_tokens(request)
    estimated_out = max_tokens or 1024
    await rpm_bucket.acquire(1)
    await itpm_bucket.acquire(estimated_in)
    await otpm_bucket.acquire(estimated_out)
    return await api.call(request)
```

After response, reconcile estimate vs actual; adjust bucket if undersized. Over-estimate is safer — wastes some capacity but avoids breaches.

---

## 429 Handling

429 means you exceeded the limit despite predicting. Recover correctly:

1. **Read Retry-After** — server says when to retry. Honor it precisely; do not retry sooner.
2. **Don't immediately retry without honoring** — adds load to a service already saying "back off."
3. **Update local bucket** — your prediction was wrong; recalibrate.
4. **Don't compound** — many concurrent requests retrying without coordination = thundering herd. Use a singleton bucket; failures wait on the bucket, not on independent timers.

```python
async def call_with_retry(request, max_retries=3):
    for attempt in range(max_retries + 1):
        try:
            return await call_model(request)
        except RateLimitError as e:
            wait = e.retry_after or backoff(attempt)
            wait += random.uniform(0, wait * 0.1)  # jitter
            await asyncio.sleep(wait)
    raise BudgetExhausted()
```

---

## Backoff

When Retry-After is missing, backoff is your fallback:

| Strategy | Use |
|----------|-----|
| **Exponential + jitter** | Default. Doubles each attempt; jitter prevents synchronization. |
| **Linear** | Tighter timing requirement, low retry count |
| **No backoff** | Never. Retrying immediately is always wrong on 429. |

Cap max wait. After N attempts or T total wait, fail the request; don't retry forever.

---

## Fair Allocation

In multi-session harness, one session can monopolize the shared bucket. Defenses:

| Approach | Tradeoff |
|----------|----------|
| **Per-session sub-buckets** | Fair; capacity may go unused if one session idle |
| **Weighted fair queue** | Honors session priority; complex |
| **Best-effort + per-session cap** | Simple; adequate for most |

```python
class FairBucket:
    def __init__(self, global_bucket, per_session_cap):
        self._global = global_bucket
        self._caps: dict[str, TokenBucket] = {}
        self._per_session_cap = per_session_cap

    async def acquire(self, session_id: str, n: int):
        cap = self._caps.setdefault(session_id, TokenBucket(self._per_session_cap, ...))
        await cap.acquire(n)
        await self._global.acquire(n)
```

Per-session cap prevents one session from consuming >X% of the global budget at once.

---

## Queue Discipline

When multiple requests wait on the bucket, FIFO is the default. Edge cases:

- **Priority** — interactive turns over batch jobs; size-based (small first to reduce average wait)
- **Deadline-aware** — drop requests whose deadline has passed
- **Cancellation** — cancelled session's queued requests must be removable

Queue depth is a load metric; alarm when it grows.

---

## Tool Rate Limits

Don't only think about the model API. Tool calls hit external services:

- GitHub API: 5000 req/hr authenticated
- Search APIs: per-key quotas
- Internal services: their own RPS limits

Treat tool calls like model calls: per-tool buckets, predictive consumption, 429 handling. The agent loop fanning out tool calls can DoS your own backends.

```python
class ToolDispatcher:
    def __init__(self, buckets: dict[str, TokenBucket]):
        self._buckets = buckets

    async def call(self, tool: ToolCall):
        bucket = self._buckets.get(tool.name)
        if bucket:
            await bucket.acquire(1)
        return await tool.run()
```

---

## Bulkhead

Cap concurrent in-flight to one tenant / session / tool to contain blast radius.

```python
class Bulkhead:
    def __init__(self, max_concurrent: int):
        self._sem = asyncio.Semaphore(max_concurrent)

    async def run(self, fn, *args):
        async with self._sem:
            return await fn(*args)
```

A failing slow upstream burns up the semaphore; without bulkhead, all sessions degrade. With bulkhead, only the impacted route does.

---

## Observability

Surface in telemetry:

- Bucket fill levels (RPM, ITPM, OTPM) — visible saturation
- Queue depth — backpressure signal
- Wait time distribution — user-perceived effect of throttling
- 429 rate — when prediction misses
- Retry counts — and whether they are succeeding
- Per-session consumption — fairness

Alarm:

- Sustained 429 rate > X% (predictor broken or limits cut)
- Queue depth > N for > T (capacity insufficient)
- One session consuming > Y% of bucket (fairness violation)

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Retry without honoring Retry-After | Thundering herd; 429 rate climbs | Honor server-provided wait |
| No jitter | Synchronized retry storms | Add jittered backoff |
| Independent timers per request | Each request retries blindly | Singleton bucket; coordinate via shared state |
| Only RPM tracked | TPM breach causes surprise 429s | Track all dimensions |
| Estimate uses raw chars | Significant under/over | Real tokenizer for accurate budgeting |
| Per-session cap missing | One session monopolizes | Sub-bucket per session |
| No bulkhead | Slow upstream takes all capacity | Semaphore per route |
| Tool rate limits ignored | Self-inflicted DoS on backends | Per-tool buckets |
| Infinite retry | Bills accumulate during outage | Cap attempts; fail cleanly |
| Queue holds cancelled requests | Wasted capacity | Remove on cancellation |

---

## When NOT to Use

- **Local single-user harness with generous quotas** — bucket overhead exceeds benefit; basic 429 handling is enough
- **Synchronous batch jobs** with no concurrent peers — just retry-with-backoff suffices
- **Fully internal tools you control** — fix capacity at the source instead

---

## Design Checklist

- [ ] All upstream limit dimensions tracked (RPM, ITPM, OTPM, concurrent)
- [ ] Token-bucket per dimension; acquire before dispatch
- [ ] Input-token estimate before send; reconcile after
- [ ] Retry-After honored exactly; no retries before that time
- [ ] Exponential backoff with jitter as fallback when Retry-After absent
- [ ] Retry attempts capped; clean failure beyond
- [ ] Per-session caps prevent monopolization in shared harness
- [ ] Queue discipline documented (FIFO / priority / deadline-aware)
- [ ] Cancellation removes queued requests
- [ ] Bulkhead per upstream route caps blast radius of slow services
- [ ] Per-tool rate limits respected; tool buckets configured
- [ ] Telemetry: bucket levels, queue depth, wait time, 429 rate, retries, per-session consumption
- [ ] Alarms on sustained 429, queue depth, fairness violations
- [ ] Coordination with telemetry-tracing: rate-limit events as span attributes
- [ ] Coordination with graceful-degradation: budget exhaustion → degrade, don't block forever
