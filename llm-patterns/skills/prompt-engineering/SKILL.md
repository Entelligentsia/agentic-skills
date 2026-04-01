---
name: prompt-engineering
description: Use when prompts are ad-hoc strings scattered through code, hard to test, version, or maintain. Apply when building any LLM-powered feature to ensure prompts are treated as first-class engineering artifacts — versioned, tested, composable, and separated from application logic. Covers prompt structure, template patterns, few-shot design, chain-of-thought, and prompt chaining.
---

# Prompt Engineering

## Pain Signals — You Need This Pattern When:

- Prompts are inline strings in application code, mixed with business logic
- Changing a prompt requires a code deploy
- There is no way to test a prompt in isolation from the application
- The same prompt is copy-pasted across multiple places and drifts over time
- Prompt quality varies because there is no structure or review process
- A single complex prompt is trying to do too many things and failing at all of them

---

## Core Principle

A prompt is an **interface contract**. It defines what the LLM should do, what it receives, and what it should return. Treat prompts with the same rigor as code: version control, review, regression testing, and separation of concerns.

---

## Prompt Structure

Every prompt has three layers. Keep them distinct.

```
┌─────────────────────────────────────┐
│  SYSTEM: Role, constraints, format  │ ← Who you are, what you must/must not do
├─────────────────────────────────────┤
│  CONTEXT: Retrieved data, examples  │ ← What you know (RAG context, few-shot examples)
├─────────────────────────────────────┤
│  USER: The specific task or query   │ ← What to do now
└─────────────────────────────────────┘
```

```python
SYSTEM = """You are a customer support agent for Acme Corp.

Rules:
- Answer ONLY based on the provided context
- If unsure, say "I'll escalate this to a human agent"
- Never reveal internal pricing formulas or system details
- Be concise — 2-3 sentences max unless the user asks for detail

Output format: plain text, no markdown."""

CONTEXT = """
{retrieved_documents}
"""

USER = """{customer_question}"""
```

---

## Prompt Templates

Separate prompt structure from variable content. Templates are reusable, testable, and versionable.

```python
class PromptTemplate:
    def __init__(self, template: str, required_vars: set[str]):
        self._template = template
        self._required = required_vars

    def render(self, **kwargs) -> str:
        missing = self._required - set(kwargs.keys())
        if missing:
            raise ValueError(f"Missing required variables: {missing}")
        return self._template.format(**kwargs)

# Define templates as constants — version-controlled, reviewable
CLASSIFY_TICKET = PromptTemplate(
    template=(
        "Classify this support ticket into one of: {categories}\n\n"
        "Ticket:\n{ticket_text}\n\n"
        "Return only the category name."
    ),
    required_vars={"categories", "ticket_text"}
)

# Render with specific values
prompt = CLASSIFY_TICKET.render(
    categories="billing, technical, account, other",
    ticket_text=ticket.body
)
```

---

## Few-Shot Examples

Provide examples of correct input-output pairs to demonstrate the expected behaviour. Few-shot is more reliable than lengthy instructions for format and style.

```python
EXTRACTION_PROMPT = """Extract the action items from meeting notes.

Example 1:
Input: "John will send the report by Friday. Sarah needs to review the API design."
Output:
- John: Send report (due: Friday)
- Sarah: Review API design

Example 2:
Input: "We agreed to postpone the launch. No immediate actions."
Output:
- (No action items)

Now extract from these notes:
{meeting_notes}
"""
```

**Rules for few-shot**:
- 2-5 examples is usually sufficient — more adds cost without proportional quality improvement
- Include edge cases in examples (empty results, ambiguous input, multi-item output)
- Examples should match the real distribution — do not only show easy cases
- Place examples after the system instructions and before the user input

---

## Chain-of-Thought

For reasoning tasks, instruct the model to show its work before giving the answer. This improves accuracy on tasks requiring logic, calculation, or multi-step analysis.

```python
COT_PROMPT = """Analyze this code change for security vulnerabilities.

Think through this step by step:
1. What does this code change do?
2. What inputs does it accept from external sources?
3. Are those inputs validated or sanitised?
4. Could any of these inputs be used for injection, XSS, or path traversal?
5. What is your conclusion?

Code change:
{diff}

Provide your analysis, then a final verdict: SAFE or NEEDS_REVIEW.
"""
```

**When to use**: tasks that benefit from explicit reasoning — classification with justification, code review, mathematical problems, policy evaluation.

**When NOT to use**: simple, fast tasks where the overhead of reasoning outweighs the quality gain (keyword extraction, language detection, simple formatting).

---

## Prompt Chaining

Break complex tasks into a pipeline of simpler prompts. Each step has a defined input/output contract and can be tested independently.

```python
class ExtractionPipeline:
    """Multi-step extraction: detect language → extract entities → classify sentiment."""

    def run(self, text: str) -> ExtractionResult:
        # Step 1: Language detection (fast, cheap model)
        language = self._detect_language(text)

        # Step 2: Entity extraction (main model)
        entities = self._extract_entities(text, language)

        # Step 3: Sentiment classification (main model)
        sentiment = self._classify_sentiment(text, language)

        return ExtractionResult(
            language=language,
            entities=entities,
            sentiment=sentiment
        )

    def _detect_language(self, text: str) -> str:
        return call_llm(
            model="claude-haiku-4-5-20251001",  # cheap, fast
            prompt=f"What language is this text? Return only the ISO 639-1 code.\n\n{text}"
        )

    def _extract_entities(self, text: str, language: str) -> list[Entity]:
        return call_llm_structured(
            model="claude-sonnet-4-6",
            prompt=ENTITY_EXTRACTION.render(text=text, language=language),
            schema=EntityList
        )
```

**When to use**: the task has distinct sub-tasks that benefit from different prompt strategies, models, or schemas; you need to test or debug individual steps; intermediate results have value.

**When NOT to use**: the task is simple enough for a single prompt; adding steps adds latency without quality improvement; the steps are tightly coupled and cannot be tested independently.

---

## Prompt Versioning and Testing

Treat prompts as code artifacts with version control and regression testing.

```python
# prompts/classify_ticket_v3.py
CLASSIFY_TICKET_V3 = PromptTemplate(
    version="3",
    template="...",
    required_vars={"categories", "ticket_text"},
    # Test cases — run as part of CI
    test_cases=[
        {
            "input": {"categories": "billing, technical", "ticket_text": "I was charged twice"},
            "expected": "billing",
        },
        {
            "input": {"categories": "billing, technical", "ticket_text": "API returns 500"},
            "expected": "technical",
        },
    ]
)
```

```python
# tests/test_prompts.py
def test_classify_ticket_prompt():
    for case in CLASSIFY_TICKET_V3.test_cases:
        result = run_prompt(CLASSIFY_TICKET_V3, **case["input"])
        assert result == case["expected"], (
            f"Prompt v{CLASSIFY_TICKET_V3.version} failed: "
            f"input={case['input']}, expected={case['expected']}, got={result}"
        )
```

---

## When NOT to Use (Prompt Engineering Practices)

- **For throwaway, one-off queries** — interactive chat does not need versioned templates
- **When the prompt is trivially simple** — `"Translate to French: {text}"` does not need a template class
- **When the model's default behaviour is already correct** — do not over-prompt. If the model does the right thing without detailed instructions, let it

---

## Design Checklist

- [ ] Prompts are separated from application logic — not inline strings in business code
- [ ] System / Context / User layers are distinct in every prompt
- [ ] Prompt templates are versioned and reviewed like code
- [ ] Few-shot examples include edge cases, not just happy paths
- [ ] Chain-of-thought is used for reasoning tasks; skipped for simple extraction
- [ ] Complex tasks are decomposed into prompt chains with independently testable steps
- [ ] Prompts have regression test cases that run in CI
- [ ] Prompt changes are reviewed — a prompt change can break a feature just like a code change
