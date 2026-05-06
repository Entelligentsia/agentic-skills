# harness-engineering

Skills for building agent harness components. Sibling to `llm-patterns` (which covers LLM integration patterns); this plugin covers the runtime/infrastructure layer that hosts those patterns.

## Skills

| Skill | Concern |
|-------|---------|
| `memory-compaction` | Context window management, summarization, tiering |
| `session-persistence` | Checkpoint, resume, fork, replay |
| `prompt-caching` | Cache breakpoints, TTL, hit-rate tuning |
| `subagent-orchestration` | Spawn, delegate, isolate, merge |
| `tool-sandboxing` | Fs jail, network egress, exec isolation |
| `permission-gates` | Risk classification, approval flows, scope |
| `streaming-io` | Token stream, mid-stream tool calls, cancel |
| `concurrency-control` | Parallel tool calls, races, aggregation |
| `telemetry-tracing` | Span tree, cost attribution, replay |
| `hook-system` | Pre/post tool, prompt-submit, stop hooks |
| `workspace-state` | File-state tracking, read-before-edit, cwd |
| `model-routing` | Capability/cost-aware model selection |
| `rate-limiting` | Quota, backoff, queue, 429 handling |

## Status

All 13 skills filled. Each follows the `llm-patterns/agent-loop` template — pain signals, core principle, mechanics, recipes/code, common pitfalls, when-not-to-use, design checklist.

## Relationship to llm-patterns

- `llm-patterns` → *what* the LLM does (RAG, agent loop, tool use, guardrails, ...)
- `harness-engineering` → *how* the runtime hosts it (memory, sandbox, hooks, telemetry, ...)

Some overlap is intentional: `model-routing` extends `graceful-degradation`; `telemetry-tracing` is distinct from `evaluation-harness` (ops vs quality).
