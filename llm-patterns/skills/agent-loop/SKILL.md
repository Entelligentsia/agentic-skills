---
name: agent-loop
description: Use when a task requires autonomous multi-step reasoning — the LLM must observe, decide, act, and iterate until a goal is met or a termination condition is reached. Apply when a single prompt cannot solve the task, the number of steps is not known in advance, and the next step depends on the result of the previous one. Covers ReAct, Plan-and-Execute, state management, termination, and guardrails for autonomous agents.
---

# Agent Loop

## Pain Signals — You Need This Pattern When:

- A single LLM call cannot solve the task — it requires multiple steps with intermediate observations
- The number of steps is not known in advance — the agent must decide when it is done
- Each step depends on the result of the previous step (not a fixed pipeline)
- The task requires exploration — reading files, searching, querying databases, trying approaches
- You need an LLM to plan and execute a multi-step workflow autonomously

**This is the most complex LLM pattern.** Use it only when Prompt Chaining (fixed pipeline) and Tool Use (single-round) are insufficient.

---

## Core Principle

An agent is a **state machine** that loops through observe-think-act cycles until a termination condition is met. The LLM provides the "think" step; your system provides the "observe" and "act" infrastructure.

```
                ┌─────────────────────────┐
                │                         │
                ▼                         │
         ┌─────────┐    ┌─────────┐    ┌──┴──┐
  Start  │ OBSERVE │───▶│  THINK  │───▶│ ACT │
         └─────────┘    └─────────┘    └─────┘
              ▲                           │
              │         ┌─────────┐       │
              └─────────│  CHECK  │◀──────┘
                        │  DONE?  │
                        └────┬────┘
                             │ yes
                             ▼
                          RESPOND
```

---

## Basic Agent Loop

```python
class Agent:
    def __init__(
        self,
        llm: LLMClient,
        tools: list[Tool],
        system_prompt: str,
        max_steps: int = 10
    ):
        self._llm = llm
        self._tools = tools
        self._system = system_prompt
        self._max_steps = max_steps

    def run(self, task: str) -> AgentResult:
        messages = [{"role": "user", "content": task}]
        steps_taken = 0

        while steps_taken < self._max_steps:
            response = self._llm.create(
                system=self._system,
                tools=self._tools,
                messages=messages
            )
            steps_taken += 1

            # Check termination: model produced a final answer (no tool calls)
            if response.stop_reason == "end_turn":
                return AgentResult(
                    answer=extract_text(response.content),
                    steps=steps_taken,
                    status="completed"
                )

            # Execute tool calls and feed results back
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = self._execute(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

        return AgentResult(
            answer="Maximum steps reached without completing the task.",
            steps=steps_taken,
            status="max_steps_exceeded"
        )
```

---

## Agent Architectures

### ReAct (Reason + Act)

The model explicitly reasons about what to do before acting. Each step produces a thought, then an action.

```
Thought: The user wants to know the delivery date. I need to look up the order first.
Action: get_order_status(order_id="ORD-12345")
Observation: {"status": "shipped", "carrier": "FedEx", "tracking": "FX789"}
Thought: The order is shipped. I need to check the tracking for the estimated delivery.
Action: track_shipment(tracking_number="FX789")
Observation: {"estimated_delivery": "2026-04-03", "current_location": "Memphis, TN"}
Thought: I have the delivery date. I can answer the user now.
Answer: Your order is currently in Memphis, TN and is estimated to arrive on April 3rd.
```

**Strength**: the explicit reasoning chain is auditable and debuggable.
**Weakness**: verbose; uses more tokens; the model may reason itself into loops.

### Plan-and-Execute

The model produces a plan upfront, then executes each step. The plan can be revised if a step fails or produces unexpected results.

```python
class PlanAndExecuteAgent:
    def run(self, task: str) -> AgentResult:
        # Phase 1: Plan
        plan = self._llm.create(
            system="Create a step-by-step plan to accomplish this task. "
                   "Return a numbered list of concrete steps.",
            messages=[{"role": "user", "content": task}]
        )
        steps = parse_plan(plan)

        # Phase 2: Execute each step
        context = ""
        for i, step in enumerate(steps):
            result = self._execute_step(step, context)
            context += f"\nStep {i+1} ({step}): {result}"

            # Phase 3: Re-plan if needed
            if result.needs_replanning:
                steps = self._replan(task, context, remaining_steps=steps[i+1:])

        # Phase 4: Synthesise final answer from all step results
        return self._synthesise(task, context)
```

**Strength**: more predictable execution; the plan is visible and reviewable.
**Weakness**: upfront planning can be wrong; re-planning adds complexity.

---

## Termination Conditions

An agent without clear termination conditions is a runaway loop. Define explicit conditions.

| Condition | Purpose |
|-----------|---------|
| **Max steps** | Hard ceiling — prevents infinite loops. Non-negotiable. |
| **Model signals completion** | The model produces a final answer without requesting more tools. |
| **Goal condition met** | A verifiable condition: test passes, file exists, query returns expected result. |
| **Budget exhausted** | Token or cost budget exceeded — gracefully degrade. |
| **Error threshold** | Too many consecutive tool failures — escalate to human. |

```python
class TerminationPolicy:
    def __init__(self, max_steps: int = 10, max_errors: int = 3, max_cost: float = 1.0):
        self._max_steps = max_steps
        self._max_errors = max_errors
        self._max_cost = max_cost
        self._consecutive_errors = 0
        self._total_cost = 0.0

    def should_stop(self, step: int, last_result: StepResult) -> tuple[bool, str]:
        if step >= self._max_steps:
            return True, "max_steps_exceeded"
        if last_result.is_error:
            self._consecutive_errors += 1
            if self._consecutive_errors >= self._max_errors:
                return True, "too_many_errors"
        else:
            self._consecutive_errors = 0
        self._total_cost += last_result.cost
        if self._total_cost >= self._max_cost:
            return True, "budget_exhausted"
        return False, ""
```

---

## Context Management

Long-running agents accumulate context that can exceed the token window. Manage it explicitly.

```python
class ContextManager:
    def __init__(self, max_tokens: int = 50000):
        self._max_tokens = max_tokens

    def trim(self, messages: list[dict]) -> list[dict]:
        total = sum(count_tokens(m) for m in messages)
        if total <= self._max_tokens:
            return messages

        # Keep system prompt + first user message + last N messages
        system = messages[:1]
        first_user = messages[1:2]
        # Summarise middle messages
        middle = messages[2:-6]
        recent = messages[-6:]
        summary = self._summarise(middle)
        return system + first_user + [{"role": "user", "content": f"[Prior context summary: {summary}]"}] + recent
```

---

## When NOT to Use

- **The task is a single question with a single answer** — use a single LLM call or Tool Use
- **The steps are known in advance** — use Prompt Chaining (fixed pipeline), not an autonomous agent
- **Latency matters** — each agent step adds seconds. For real-time UX, pre-compute or use simpler patterns
- **The task does not require reasoning about intermediate results** — if each step is independent, a batch of parallel tool calls is simpler
- **You cannot tolerate unpredictable cost** — agent loops consume variable tokens. Set hard budget limits.

---

## Design Checklist

- [ ] Maximum step count is defined and enforced — no unbounded loops
- [ ] Termination conditions are explicit: max steps, goal condition, budget, error threshold
- [ ] Every tool call is logged: tool name, arguments, result, latency, cost
- [ ] Context management strategy is defined for long-running agents
- [ ] The agent can gracefully degrade when it cannot complete the task
- [ ] Tool safety boundaries apply within the agent loop — the agent does not bypass them
- [ ] Re-planning or self-correction is bounded — not infinite retry
- [ ] The agent's reasoning chain is auditable — thoughts and actions are logged
