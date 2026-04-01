# llm-patterns

Design patterns for using LLMs as engineering components — not chat interfaces, but decision-making, data-processing, and logic-executing building blocks in production software systems.

These skills address the recurring problems of LLM integration: non-deterministic outputs, hallucination, prompt fragility, cost unpredictability, and production reliability. Each pattern is organised around the **pain it removes**, grounded in proven practices from production AI systems.

---

## Start Here

| Skill | Purpose |
|-------|---------|
| [`pattern-selection`](skills/pattern-selection/SKILL.md) | **Invoke first.** Decision tree mapping pain to pattern — output quality, invocation strategy, or production reliability. |

---

## Output Quality

*When the LLM's output is wrong, inconsistent, or unsafe.*

| Skill | Pain It Removes |
|-------|----------------|
| [`structured-generation`](skills/structured-generation/SKILL.md) | Output breaks parsers, violates schemas, or varies in shape across calls |
| [`rag`](skills/rag/SKILL.md) | LLM hallucinates facts, lacks proprietary knowledge, or gives stale answers |
| [`guardrails`](skills/guardrails/SKILL.md) | Output contains harmful content, PII, prompt injection, or policy violations |

---

## Invocation Strategy

*When the pain is about how the LLM is called.*

| Skill | Pain It Removes |
|-------|----------------|
| [`prompt-engineering`](skills/prompt-engineering/SKILL.md) | Prompts are ad-hoc strings, untested, unversioned, scattered through code |
| [`tool-use`](skills/tool-use/SKILL.md) | LLM needs live data, calculations, or side effects from external systems |
| [`agent-loop`](skills/agent-loop/SKILL.md) | Task requires autonomous multi-step reasoning with intermediate observations |

---

## Production Reliability

*When the pain is about keeping the feature running in production.*

| Skill | Pain It Removes |
|-------|----------------|
| [`graceful-degradation`](skills/graceful-degradation/SKILL.md) | Model is down, slow, or over budget — feature stops working entirely |
| [`evaluation-harness`](skills/evaluation-harness/SKILL.md) | No way to measure quality, detect regressions, or monitor production |

---

## Cost and Efficiency

*When the pain is about repeated inference, non-determinism on deterministic tasks, or accumulating cost.*

| Skill | Pain It Removes |
|-------|----------------|
| [`tool-synthesis`](skills/tool-synthesis/SKILL.md) | LLM called repeatedly for tasks that could be codified as deterministic scripts or tools |

---

## Design Philosophy

Every skill follows the same structure:

- **Pain Signals** — concrete symptoms that indicate the pattern is needed
- **Core Principle** — the fundamental idea in one sentence
- **Implementation** — working code examples using the Claude API
- **When NOT to use** — where the pattern adds cost without benefit
- **Design Checklist** — what engineers and reviewers should verify

The `pattern-selection` skill is the entry point. It routes to the right skill based on the friction you are experiencing.

---

## Case Study

See [Maya's Case Study](../design-patterns/docs/maya-case-study.md) — a walkthrough of reengineering a legacy codebase where `design-patterns` and `llm-patterns` work together: domain refactoring followed by an AI feature built with structured generation, graceful degradation, and tool synthesis.

---

## Installation

```
/plugin marketplace add Entelligentsia/agentic-skills
/plugin install llm-patterns@agentic-skills
/reload-plugins
```

---

## Sources

These patterns are distilled from production practices documented across:

- Anthropic — Claude API documentation, cookbook, best practices
- Google — ML Engineering best practices, MLOps maturity model
- Industry practice — RAG architectures, agent frameworks, evaluation frameworks
- OpenAI — Function calling patterns, structured outputs
- LangChain / LlamaIndex — Retrieval and agent patterns (architecture concepts, not library dependency)
