---
name: tool-synthesis
description: Use when an LLM is repeatedly performing a task that could be codified as a deterministic or semi-deterministic script, tool, or function. Apply when inference cost, latency, or non-determinism is the pain — the LLM evaluates whether to generate a reusable artifact that replaces itself for a class of inputs. Covers the decision framework, generation strategies, hybrid deterministic/probabilistic routing, validation of generated tools, and lifecycle management.
---

# Tool Synthesis

## Pain Signals — You Need This Pattern When:

- The same class of LLM task runs hundreds or thousands of times with the same logic
- Results should be deterministic but LLM outputs vary across identical inputs
- Inference cost is accumulating for tasks that do not require reasoning
- Latency is unacceptable for a task that should complete in milliseconds
- An LLM is doing data transformation, validation, formatting, or calculation — tasks code handles better
- The LLM is a bottleneck in a pipeline where most steps are deterministic

---

## Core Principle

An LLM call is **interpretation**. A generated script is **compilation**. Tool Synthesis is the LLM recognising that a task has become well-understood enough to compile into a deterministic artifact — then writing that artifact and stepping out of the loop.

The LLM does not simply generate code. It makes a **deliberate architectural decision**: should this task remain probabilistic reasoning, or should it be codified as a reusable tool? The decision itself requires judgment; the resulting tool does not.

```
First encounter:   LLM reasons about the task         → produces result
Repeated pattern:  LLM recognises stability            → evaluates: codify?
Tool generation:   LLM writes deterministic tool       → validates it
Steady state:      Tool runs directly, LLM not called  → cost/latency/reliability improve
Edge cases:        Tool routes uncertain inputs to LLM → hybrid path
```

---

## The Decision Framework

Before generating a tool, the LLM evaluates five criteria:

```
┌─────────────────────────────────────────────────────┐
│              Should I generate a tool?              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. DETERMINISTIC?                                  │
│     Same input → always same correct output?        │
│     YES → strong candidate                          │
│     NO  → keep as LLM call (or hybrid)              │
│                                                     │
│  2. REPEATED?                                       │
│     Same pattern applied to many different inputs?  │
│     YES → generation cost is amortised              │
│     NO  → one-off; LLM call is fine                 │
│                                                     │
│  3. STABLE?                                         │
│     Will the rules/logic change next week?          │
│     YES → keep as LLM call (flexible)               │
│     NO  → codify (durable)                          │
│                                                     │
│  4. VERIFIABLE?                                     │
│     Can the tool's output be validated by tests?    │
│     YES → generate with test suite                  │
│     NO  → risky to codify; keep LLM with eval       │
│                                                     │
│  5. BOUNDED?                                        │
│     Is the input space well-defined and finite?     │
│     YES → generate with confidence                  │
│     NO  → hybrid: tool for known cases, LLM for rest│
│                                                     │
└─────────────────────────────────────────────────────┘
```

**All five YES** → generate a fully deterministic tool.
**Mixed** → generate a hybrid tool with a deterministic fast path and LLM fallback.
**Mostly NO** → keep as LLM call; tool synthesis is premature.

---

## What Gets Synthesised

### Deterministic Tools

Tasks where the logic is fully codifiable and the LLM adds no value once the rules are known.

| Task | Generated Artifact |
|------|--------------------|
| Date/time formatting across locales | Formatter function |
| CSV/JSON data transformation with fixed mapping | ETL script |
| Input validation against known business rules | Validator function |
| Price calculation with defined formulas | Calculator function |
| Report generation from structured data | Template renderer |
| Regex-based text extraction | Extraction function |
| Status code mapping and error message generation | Lookup table + function |

```python
# BEFORE: LLM called every time to format an address
def format_address(raw: dict) -> str:
    return call_llm(f"Format this as a US mailing address: {raw}")
    # $0.002 per call × 10,000 calls/day = $20/day

# AFTER: LLM generated this function once, validated it, stepped out
def format_address(raw: dict) -> str:
    parts = [
        raw.get('name', ''),
        raw.get('street1', ''),
        raw.get('street2', ''),
        f"{raw.get('city', '')}, {raw.get('state', '')} {raw.get('zip', '')}",
        raw.get('country', 'US') if raw.get('country', 'US') != 'US' else ''
    ]
    return '\n'.join(p for p in parts if p.strip())
    # $0.00 per call, microseconds latency, deterministic
```

### Probabilistic Tools (ML Artifacts)

Tasks where the pattern is learnable but not fully rule-based — the LLM generates a lightweight classifier, scoring function, or heuristic that handles the common cases.

| Task | Generated Artifact |
|------|--------------------|
| Ticket routing (80% of cases follow clear rules) | Rule engine + LLM fallback |
| Spam detection with known patterns | Scoring function + threshold |
| Content categorisation with stable taxonomy | Keyword/regex classifier + LLM for ambiguous |
| Priority scoring with defined criteria | Weighted scoring function |

```python
# LLM generates a rule-based fast path for clear cases
class TicketRouter:
    """Generated by LLM from analysis of 500 historical routing decisions."""

    RULES = {
        'billing': ['charge', 'invoice', 'refund', 'payment', 'subscription'],
        'technical': ['error', 'bug', 'crash', 'api', '500', 'timeout'],
        'account': ['password', 'login', 'access', 'permissions', 'mfa'],
    }

    def route(self, ticket_text: str) -> RoutingResult:
        text_lower = ticket_text.lower()
        scores = {}
        for category, keywords in self.RULES.items():
            scores[category] = sum(1 for kw in keywords if kw in text_lower)

        if scores and max(scores.values()) >= 2:
            best = max(scores, key=scores.get)
            return RoutingResult(category=best, confidence="high", method="rules")

        # Ambiguous — fall back to LLM
        return RoutingResult(category=None, confidence="low", method="needs_llm")
```

---

## Generation Process

The LLM does not just write code — it follows a disciplined generation process.

```python
class ToolSynthesiser:
    def synthesise(self, task_description: str, examples: list[Example]) -> SynthesisResult:
        # 1. Analyse: understand the task from examples
        analysis = self._analyse_pattern(task_description, examples)

        # 2. Decide: should this be codified?
        decision = self._evaluate_criteria(analysis)
        if decision.verdict == "keep_as_llm":
            return SynthesisResult(action="skip", reason=decision.reason)

        # 3. Generate: write the tool
        tool_code = self._generate_tool(analysis, decision.tool_type)

        # 4. Test: validate against the known examples
        test_results = self._validate_tool(tool_code, examples)
        if test_results.failure_rate > 0.05:  # >5% failure
            return SynthesisResult(
                action="skip",
                reason=f"Generated tool fails on {test_results.failure_rate:.0%} of examples"
            )

        # 5. Package: return tool with tests and metadata
        return SynthesisResult(
            action="deploy",
            tool=tool_code,
            tests=test_results.test_suite,
            coverage=test_results.pass_rate,
            estimated_savings=self._estimate_savings(analysis)
        )
```

### Validation Is Non-Negotiable

A synthesised tool **must be validated** against known examples before it replaces LLM calls. The LLM is not infallible — the code it generates must pass tests.

```python
def validate_tool(tool_fn: Callable, examples: list[Example]) -> ValidationResult:
    passed, failed = [], []
    for ex in examples:
        try:
            result = tool_fn(ex.input)
            if result == ex.expected_output:
                passed.append(ex)
            else:
                failed.append(FailedCase(
                    input=ex.input,
                    expected=ex.expected_output,
                    actual=result
                ))
        except Exception as e:
            failed.append(FailedCase(input=ex.input, error=str(e)))

    return ValidationResult(
        pass_rate=len(passed) / len(examples),
        passed=passed,
        failed=failed,
        test_suite=generate_test_file(examples)  # persist tests for CI
    )
```

---

## Hybrid Architecture

The most practical deployment: deterministic tool handles clear cases, LLM handles the rest.

```python
class HybridProcessor:
    def __init__(self, tool: Callable, llm: LLMClient, confidence_threshold: float = 0.8):
        self._tool = tool
        self._llm = llm
        self._threshold = confidence_threshold

    def process(self, input_data: Any) -> ProcessResult:
        # Try deterministic path first
        try:
            result = self._tool(input_data)
            if result.confidence >= self._threshold:
                return ProcessResult(
                    output=result.output,
                    method="deterministic",
                    cost=0.0,
                    latency_ms=result.latency_ms
                )
        except (ToolNotApplicable, LowConfidence):
            pass

        # Fall back to LLM
        llm_result = self._llm.process(input_data)
        return ProcessResult(
            output=llm_result.output,
            method="llm",
            cost=llm_result.cost,
            latency_ms=llm_result.latency_ms
        )
```

**Monitoring the split**: track what percentage of requests hit the deterministic path vs. LLM fallback. If the LLM path is handling >30% of traffic, the tool's coverage may need expansion — or the task may not be as deterministic as assumed.

---

## Lifecycle Management

Synthesised tools are not write-once artifacts. They need maintenance.

```python
class ToolLifecycle:
    def monitor(self, tool_name: str, period_days: int = 7) -> HealthReport:
        recent = self._metrics.get(tool_name, period_days)
        return HealthReport(
            deterministic_rate=recent.deterministic_count / recent.total_count,
            fallback_rate=recent.llm_fallback_count / recent.total_count,
            error_rate=recent.error_count / recent.total_count,
            # Signal: if fallback rate is climbing, the task may be evolving
            recommendation=self._recommend(recent)
        )

    def _recommend(self, metrics: ToolMetrics) -> str:
        if metrics.error_rate > 0.05:
            return "regenerate: tool errors exceeding 5%"
        if metrics.fallback_rate > 0.30:
            return "expand: tool only handles 70% of cases — analyse fallback inputs"
        if metrics.fallback_rate < 0.01:
            return "healthy: tool handles >99% of cases"
        return "stable"
```

**When to regenerate**: the underlying rules change (new business logic, new categories, new formats), error rate climbs above threshold, or the distribution of inputs shifts.

**When to retire**: the task itself is no longer needed, or the rules have become so volatile that a deterministic tool cannot keep up — revert to LLM.

---

## Connection to Enterprise Patterns

The tools the LLM generates should follow the same design patterns as human-written code:

| Generated tool type | Should follow |
|--------------------|---------------|
| Data validator | Domain Modeling (Value Objects with invariants) |
| Data transformer | Data Mapper, Pipeline |
| Routing rules | Strategy pattern |
| API integration script | Anti-Corruption Layer, Gateway |
| Report generator | Template Method, Builder |

The LLM's advantage is that it can generate pattern-compliant code from examples — but only if it knows the patterns. This is where `design-patterns` skills compose with `tool-synthesis`.

---

## When NOT to Use

- **The task genuinely requires reasoning every time** — summarisation, open-ended analysis, creative work. These cannot be compiled.
- **The rules change faster than you can regenerate tools** — regulatory environments with weekly rule changes, A/B tests with rapid iteration. LLM flexibility is the feature.
- **The input space is unbounded and unpredictable** — if you cannot characterise the inputs, you cannot validate the tool.
- **The cost of being wrong is very high** — a deterministic tool that is wrong is wrong consistently. For safety-critical tasks, keep the LLM (with guardrails and human review) until the tool can be formally verified.

---

## Design Checklist

- [ ] Decision framework is applied before generation — all five criteria evaluated
- [ ] Generated tool is validated against known examples with >95% pass rate
- [ ] Test suite is persisted alongside the tool and runs in CI
- [ ] Hybrid architecture is in place: deterministic fast path + LLM fallback for uncertain cases
- [ ] Deterministic/fallback split is monitored — fallback rate tracked over time
- [ ] Generated code follows established design patterns (design-patterns)
- [ ] Regeneration trigger is defined: what conditions cause the tool to be re-synthesised
- [ ] Cost savings are estimated and tracked: inference cost before vs. after synthesis
- [ ] The tool can be retired gracefully — reverting to LLM is always an option
