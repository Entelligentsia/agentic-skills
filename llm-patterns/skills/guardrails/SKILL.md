---
name: guardrails
description: Use when LLM inputs or outputs must be validated for safety, policy compliance, schema conformance, or content appropriateness before they reach users or downstream systems. Apply when LLM responses could contain harmful content, PII leakage, prompt injection, off-topic responses, or policy violations. Covers input validation, output validation, content filtering, and prompt injection defence.
---

# Guardrails / Validation Chain

## Pain Signals — You Need This Pattern When:

- Users can inject instructions into prompts via their input (prompt injection)
- LLM outputs could contain PII, credentials, or sensitive data from the training set or context
- The LLM produces off-topic, harmful, or policy-violating content
- Downstream systems break when the LLM returns unexpected content
- There is no systematic check between the LLM's output and the user seeing it
- Compliance requires auditing what the AI produced and what was shown to users

---

## Core Principle

Guardrails are a **Chain of Responsibility** applied to AI safety. Each guard inspects the input or output and can **pass**, **modify**, or **block** it. The guards are independent, composable, and ordered by cost (cheapest first).

```
User input → [Input Guards] → LLM → [Output Guards] → User response
                  │                       │
                  ▼                       ▼
              Block/modify           Block/modify
              before LLM            before delivery
```

---

## Input Guards

Validate and sanitise user input before it reaches the LLM.

### Prompt Injection Detection

Detect attempts to override the system prompt or inject new instructions.

```python
class PromptInjectionGuard:
    """Detects common prompt injection patterns in user input."""

    INJECTION_PATTERNS = [
        r"ignore (all |any )?(previous|prior|above) (instructions|prompts)",
        r"you are now",
        r"new instructions:",
        r"system:\s",
        r"<\|.*\|>",  # common delimiter injection
    ]

    def check(self, user_input: str) -> GuardResult:
        lowered = user_input.lower()
        for pattern in self.INJECTION_PATTERNS:
            if re.search(pattern, lowered):
                return GuardResult.block(
                    reason="Potential prompt injection detected",
                    pattern=pattern
                )
        return GuardResult.pass_through()
```

**Note**: regex-based detection catches obvious cases. For production systems, use a classifier or a dedicated content moderation API as a second layer.

### Input Length Guard

Prevent excessively long inputs that waste tokens or could be used for context stuffing.

```python
class InputLengthGuard:
    def __init__(self, max_tokens: int = 4000):
        self._max = max_tokens

    def check(self, user_input: str) -> GuardResult:
        tokens = count_tokens(user_input)
        if tokens > self._max:
            return GuardResult.block(
                reason=f"Input too long: {tokens} tokens (max {self._max})"
            )
        return GuardResult.pass_through()
```

### Topic Guard

Restrict the LLM to its intended domain — prevent off-topic queries from consuming resources.

```python
class TopicGuard:
    def __init__(self, allowed_topics: list[str], classifier: TopicClassifier):
        self._allowed = allowed_topics
        self._classifier = classifier

    def check(self, user_input: str) -> GuardResult:
        topic = self._classifier.classify(user_input)
        if topic not in self._allowed:
            return GuardResult.block(
                reason=f"Off-topic query (classified as '{topic}')"
            )
        return GuardResult.pass_through()
```

---

## Output Guards

Validate LLM output before it reaches the user or downstream systems.

### PII Detection

Scan for personally identifiable information that should not be in the response.

```python
class PIIGuard:
    """Detects PII patterns in LLM output."""

    PII_PATTERNS = {
        "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        "phone": r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
        "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
        "credit_card": r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",
    }

    def check(self, output: str) -> GuardResult:
        for pii_type, pattern in self.PII_PATTERNS.items():
            if re.search(pattern, output):
                return GuardResult.modify(
                    reason=f"PII detected: {pii_type}",
                    modified=re.sub(pattern, f"[REDACTED {pii_type.upper()}]", output)
                )
        return GuardResult.pass_through()
```

### Factual Grounding Guard (for RAG)

Verify that the LLM's claims are supported by the retrieved context.

```python
class GroundingGuard:
    def check(self, output: str, context: str) -> GuardResult:
        claims = extract_factual_claims(output)
        for claim in claims:
            if not is_supported_by_context(claim, context):
                return GuardResult.modify(
                    reason=f"Unsupported claim: '{claim}'",
                    modified=add_disclaimer(output, claim)
                )
        return GuardResult.pass_through()
```

### Schema Guard

Ensure structured output matches the expected schema (complements `structured-generation`).

```python
class SchemaGuard:
    def __init__(self, schema: type[BaseModel]):
        self._schema = schema

    def check(self, output: str) -> GuardResult:
        try:
            parsed = json.loads(output)
            self._schema.model_validate(parsed)
            return GuardResult.pass_through()
        except (json.JSONDecodeError, ValidationError) as e:
            return GuardResult.block(
                reason=f"Output does not match schema: {e}"
            )
```

---

## Guard Pipeline

Compose guards into a pipeline. Order by cost — cheap regex guards first, expensive classifier guards last.

```python
class GuardPipeline:
    def __init__(self, guards: list[Guard]):
        self._guards = guards  # ordered: cheapest first

    def run(self, content: str, **context) -> GuardPipelineResult:
        current = content
        for guard in self._guards:
            result = guard.check(current, **context)

            if result.action == "block":
                return GuardPipelineResult(
                    blocked=True,
                    reason=result.reason,
                    guard=guard.__class__.__name__
                )

            if result.action == "modify":
                current = result.modified
                # Log the modification for audit
                log_modification(guard.__class__.__name__, result.reason)

        return GuardPipelineResult(blocked=False, content=current)

# Compose the pipeline
input_guards = GuardPipeline([
    InputLengthGuard(max_tokens=4000),
    PromptInjectionGuard(),
    TopicGuard(allowed_topics=["support", "billing", "product"]),
])

output_guards = GuardPipeline([
    PIIGuard(),
    SchemaGuard(schema=SupportResponse),
    GroundingGuard(),
])
```

---

## When NOT to Use

- **Internal tools with trusted users** — guards add latency. If the input is from an internal system with controlled content, heavy guarding may be unnecessary.
- **Creative or open-ended tasks** — over-restrictive guards stifle legitimate outputs. Tune guards for the use case.
- **When deterministic validation suffices** — if the output is structured and validated by a schema, a full guard pipeline may be overkill. Use `structured-generation` instead.

---

## Design Checklist

- [ ] Input guards run before the LLM call; output guards run before delivery to user
- [ ] Guards are ordered by cost: cheap regex first, expensive classifiers last
- [ ] Every block or modification is logged with the guard name and reason (audit trail)
- [ ] Prompt injection detection is in place for any user-facing LLM application
- [ ] PII detection runs on outputs that could contain data from context or training
- [ ] Blocked responses return a helpful, non-revealing message to the user
- [ ] Guards are independently testable — each guard has its own test cases
- [ ] Guard pipeline does not silently swallow content — modifications are logged
