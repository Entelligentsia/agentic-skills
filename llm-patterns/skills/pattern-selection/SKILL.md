---
name: llm-pattern-selection
description: INVOKE THIS FIRST before designing any LLM-powered feature. Use when integrating an LLM as a component in a software system — not as a chat interface, but as a decision-making, data-processing, or logic-executing building block. Maps the friction you feel to the pattern that removes it.
---

# LLM Pattern Selection — Decision Tree

*For using LLMs as engineering components, not chat interfaces.*

## The Rule

LLMs are **non-deterministic functions** with natural-language interfaces and token-budget constraints. Every pattern in this pack addresses a specific pain that arises from treating an LLM as a software component — not from the LLM itself being "wrong," but from the integration being naive.

**Name the pain before naming the pattern.**

---

## The Decision Tree

### Is the pain about output quality or correctness?

| Friction | Pattern |
|----------|---------|
| LLM hallucinates facts not grounded in real data | **RAG** — ground responses in retrieved documents |
| LLM output breaks my parser, violates my schema, or is unpredictable in shape | **Structured Generation** — constrain output to a typed schema |
| LLM produces unsafe, off-topic, or policy-violating content | **Guardrails** — pre/post validation chain |
| LLM performance varies and I need reliable baseline quality | **Evaluation Harness** — systematic testing against golden datasets |

→ Invoke `rag`, `structured-generation`, `guardrails`, or `evaluation-harness`.

---

### Is the pain about how the LLM is invoked?

| Friction | Pattern |
|----------|---------|
| Prompts are ad-hoc strings scattered through code, hard to test or version | **Prompt Engineering** — prompts as versioned, tested, composable artifacts |
| A single prompt cannot solve the task — it needs multiple reasoning steps | **Prompt Chaining** — decompose into a pipeline of simpler prompts |
| The LLM needs to call external functions, APIs, or databases | **Tool Use** — LLM selects and invokes typed functions |
| The task requires autonomous multi-step reasoning with observations | **Agent Loop** — observe-think-act state machine with termination |

→ Invoke `prompt-engineering`, `tool-use`, or `agent-loop`.

---

### Is the pain about production reliability?

| Friction | Pattern |
|----------|---------|
| Primary model is down, slow, or over budget — need a fallback | **Graceful Degradation** — fallback chain with degradation levels |
| All inputs go to the same expensive model regardless of complexity | **Semantic Router** — classify and route to the right handler |
| I can't tell if my AI feature is working in production | **Evaluation Harness** — production monitoring with quality metrics |
| LLM latency is too high for the user experience | **Prompt Chaining** (stream partial results) or **Semantic Router** (skip LLM for simple cases) |

→ Invoke `graceful-degradation`, `semantic-router`, or `evaluation-harness`.

---

### Is the pain about cost, efficiency, or repeated inference?

| Friction | Pattern |
|----------|---------|
| Same LLM task runs thousands of times with identical logic | **Tool Synthesis** — generate a deterministic replacement |
| LLM produces non-deterministic results for a task that should be deterministic | **Tool Synthesis** — codify the logic as a script |
| Inference cost is accumulating for tasks that do not require reasoning | **Tool Synthesis** — compile reasoning into a reusable tool |
| Most inputs are simple but all hit the expensive model | **Semantic Router** (in `graceful-degradation`) + **Tool Synthesis** for the deterministic cases |

→ Invoke the `tool-synthesis` skill.

---

## Common Confusions

| These feel similar... | Distinction |
|----------------------|-------------|
| RAG vs Tool Use | RAG retrieves knowledge to augment context. Tool Use executes actions with side effects. |
| Guardrails vs Structured Generation | Guardrails validate/reject entire inputs or outputs (safety). Structured Generation constrains the output shape (schema). Both can coexist. |
| Agent Loop vs Prompt Chaining | Prompt Chaining is a fixed pipeline — steps are predetermined. Agent Loop is dynamic — the LLM decides the next step based on observations. |
| Semantic Router vs Guardrails | Router dispatches to the right handler. Guardrails block inappropriate content. Router is about efficiency; Guardrails are about safety. |
| Prompt Engineering vs Structured Generation | Prompt Engineering designs the input. Structured Generation constrains the output. One controls what goes in; the other controls what comes out. |
| Tool Synthesis vs Tool Use | Tool Use: LLM calls existing tools at runtime. Tool Synthesis: LLM generates new tools that replace future LLM calls. |
| Tool Synthesis vs Prompt Chaining | Prompt Chaining decomposes into LLM steps. Tool Synthesis eliminates LLM steps by codifying them as deterministic code. |

---

## The Final Check

Before building any LLM-powered feature:

- [ ] I know what happens when the LLM is wrong, slow, or down
- [ ] The output schema is defined and enforced, not hoped for
- [ ] I can test this feature without calling the LLM every time
- [ ] I know the cost per call and have a budget strategy
- [ ] A human can override or correct the system when needed
- [ ] I have an evaluation dataset — not just vibes
