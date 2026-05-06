---
name: telemetry-tracing
description: Use when an agent harness needs operational visibility — token spend per turn/session, latency breakdown, tool-call success rates, and the ability to replay/debug a specific run. Apply when designing the observability layer for production agents. Covers span trees (turn → tool-call → subagent), token/cost attribution, structured logging, replay format, and the difference between eval (quality) and telemetry (ops).
---

# Telemetry & Tracing

## Pain Signals — You Need This Pattern When:

- A user reports "the agent was slow" and you cannot identify which turn or tool was the bottleneck
- Cost per session is high and you cannot attribute it to specific behaviors (verbose retries? wrong model? cache miss?)
- A bad run cannot be reproduced because the inputs are not recorded
- Tool failures are invisible until users complain
- Cache hit rate dropped after a deploy and you noticed three weeks later
- You ship a prompt change and cannot tell whether quality regressed

**Telemetry is for operations: latency, cost, errors, throughput.** Quality is the eval-harness skill's job. Both are required; neither replaces the other.

---

## Core Principle

Sessions are **trees of spans.** Each span has a start, end, attributes, and parent. Costs and latencies aggregate up the tree. Logs attach to spans. Replays read the tree.

```
session (root)
├── turn 1
│   ├── pre-tool hook (span)
│   ├── model call (span: tokens, $, cache, latency)
│   ├── tool call: Read         (span: bytes, latency)
│   └── tool call: Bash         (span: exit, stdout-bytes, latency)
├── turn 2
│   ├── model call
│   ├── tool call: Edit
│   └── subagent: audit
│       └── (full subtree)
└── turn 3
    └── model call (stop)
```

Use OpenTelemetry conventions where possible. Define harness-specific attributes (`agent.session_id`, `agent.turn`, `llm.cache.hit_rate`, `llm.cost.usd`) cleanly.

---

## Span Hierarchy

| Span | Captures |
|------|----------|
| `session` | Entire run; root attributes (user, agent, harness version) |
| `turn` | One model-call cycle; turn-level cost/latency |
| `model_call` | Single API request; tokens in/out, cache, model id, $, ttft |
| `tool_call` | One tool invocation; tool name, args summary, result size, exit |
| `subagent` | Subagent run; nested session-tree as child spans |
| `hook` | Hook execution; name, decision, latency |
| `compact` | Compaction event; before/after token counts |

Span granularity is a tradeoff: fine spans give detail and cost storage; coarse spans miss the data you need to debug. Default fine inside dev/staging, sample in production.

---

## Required Attributes

For every model call:

```
llm.model.id              = "claude-opus-4-7"
llm.tokens.input          = 1234
llm.tokens.output         = 567
llm.tokens.cache_read     = 8901
llm.tokens.cache_write    = 0
llm.cost.usd              = 0.0234
llm.latency.ttft_ms       = 412
llm.latency.total_ms      = 3210
llm.stop_reason           = "end_turn" | "tool_use" | "max_tokens" | ...
llm.cache.hit_rate        = 0.87
llm.request.id            = "req_..."
```

For every tool call:

```
tool.name                 = "Bash"
tool.args.summary         = "git status"   # short, redacted
tool.args.hash            = "sha256:..."   # for dedupe / replay
tool.result.bytes         = 4096
tool.result.exit          = 0
tool.latency.ms           = 87
tool.permission.decision  = "allow" | "approve" | "block"
tool.sandbox.violations   = 0
```

For every session:

```
agent.session_id          = "sess_..."
agent.harness_version     = "1.4.2"
agent.user_id             = "..."         # if applicable
agent.task_intent         = "..."         # short label, optional
```

---

## Cost Attribution

Cost rolls up the span tree. Each model_call span has a `$` attribute computed from tokens × model price.

```python
def compute_cost(usage, model_pricing):
    return (
        usage.input_tokens             * model_pricing.input
        + usage.output_tokens          * model_pricing.output
        + usage.cache_read_input_tokens * model_pricing.cache_read
        + usage.cache_creation_input_tokens * model_pricing.cache_write
    )
```

Aggregate views to surface:

- **$ per session** (operational baseline)
- **$ per agent / role** (which agents are expensive)
- **$ by stop_reason** (max_tokens or excessive turns inflate cost)
- **$ by model** (routing effectiveness)
- **$ saved by cache** = `cache_read_tokens × (input_price - cache_read_price)`

---

## Latency Attribution

Total session latency decomposes into:

```
session_total = Σ turn_latency
turn_latency  = pre_hooks + model_call + tool_dispatch + post_hooks
model_call    = ttft + (output_tokens × ms_per_token)
tool_dispatch = max(parallel) + Σ(serial)
```

Surface:

- **TTFT distribution** per model — regressions here often = caching broke
- **Tool latency by tool** — slow tools dominate
- **Parallelism factor** = `Σ tool_latency / wall_tool_dispatch_latency` (1.0 = serial, >1 = parallel benefit)
- **Hook overhead** — blocking hooks add silent latency

---

## Sampling

Production traces are expensive to store at full fidelity.

| Strategy | When |
|----------|------|
| Head-based (decide at session start) | Simple; misses interesting tails |
| Tail-based (decide at session end based on outcome) | Keeps errors, slow runs, expensive runs |
| Always-sample errors and high-cost | Default in production |
| Always-sample in dev/staging | Default outside production |

Tail-based sampling for errors + p99 latency + p99 cost catches almost everything operationally interesting at low storage cost.

---

## Telemetry vs Eval-Harness

Both produce metrics. Different concerns:

| | Telemetry | Eval-Harness |
|---|-----------|--------------|
| Question | Is the system healthy? | Is the system correct? |
| Time horizon | Live, last-N-minutes | Per release, dataset-driven |
| Inputs | Production traffic | Curated datasets |
| Metrics | Latency, cost, error rate, throughput | Accuracy, quality scores, regression vs baseline |
| Ownership | SRE / harness ops | ML / product |

Don't conflate. A telemetry dashboard that says "all green" while eval shows quality regression is consistent — and dangerous if you watch only one.

---

## Replay From Trace

A complete trace is a replay artifact. Operators reconstruct sessions by reading the span tree.

To make traces replayable, attach to each span:

- Inputs (full prompt for model_call, full args for tool_call)
- Outputs (full response, full tool result)
- Non-determinism (model temperature, randomness seed if any)

Replay then becomes: "For each span, replace 'execute' with 'read recorded output.'" Pairs naturally with session-persistence's event log — telemetry is a query layer over the same data.

PII handling: if traces contain user data, redaction at write or field-level encryption is mandatory. Don't ship traces to a third-party APM with secrets in them.

---

## Dashboards

Minimum dashboards for a production agent harness:

1. **Cost** — $ per session p50/p95/p99, $ by model, cache savings, top expensive sessions
2. **Latency** — turn latency p50/p95/p99, TTFT, tool latency by tool, parallelism factor
3. **Reliability** — turn error rate, tool error rate by tool, cancel rate, max_tokens hit rate
4. **Cache health** — hit rate trend, write/read split, drops between deploys
5. **Permissions** — approval rate, block rate, time-to-approve, top-blocked patterns

Set alarms on:

- Cache hit rate drop > X% deploy-over-deploy
- Cost per session > N×baseline
- Tool error rate spike
- Approval timeout rate

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Logs without trace context | Cannot correlate log line to session | Attach trace/span IDs to every log |
| Trace IDs leak to model | Cache invalidation | IDs go to telemetry, not into prompt |
| PII in span attributes | Compliance violation | Redact at boundary |
| Sampling drops all errors | Bug invisible | Tail-sample errors always |
| One global cost number | Cannot find expensive paths | Attribute per-span |
| Telemetry = eval | False sense of quality | Run eval-harness separately |
| No alarm on cache regression | Silent 10× cost increase | Alarm on hit-rate drop |
| Missing parent_span_id | Tree fragments | Always set parent on span start |
| Subagent spans not linked | Cost attribution wrong | Subagent span is child of parent's tool_call span |

---

## When NOT to Use (Heavy Telemetry)

- **Local dev tools** — ad-hoc logging is enough; full tracing is overkill
- **Single-shot scripts** — no span tree of value
- **Strictly-private workloads** where any external telemetry is policy-blocked — local-only file logs

But for any harness running in production for users, full telemetry is non-negotiable.

---

## Design Checklist

- [ ] Span model defined: session → turn → model_call / tool_call / hook / subagent / compact
- [ ] OTel-compatible attributes with harness-specific extensions documented
- [ ] Every model_call records: model, tokens (in/out/cache), cost, ttft, total latency, stop_reason
- [ ] Every tool_call records: name, args summary + hash, result size, exit, latency, permission decision
- [ ] Cost computed per-call from tokens × model pricing; aggregated up tree
- [ ] Cache savings surfaced (read tokens × price delta)
- [ ] Sampling: always-sample errors and high-cost; tail-based for normal
- [ ] PII redaction at span-write boundary
- [ ] Logs include trace and span IDs for correlation
- [ ] Trace IDs and timestamps not leaked into model context (cache invalidation)
- [ ] Dashboards: cost, latency, reliability, cache health, permissions
- [ ] Alarms: cache regression, cost spike, tool error spike, approval timeout
- [ ] Replay capability: spans contain enough input/output to reconstruct
- [ ] Coordination with eval-harness: distinct concern, distinct dashboards
