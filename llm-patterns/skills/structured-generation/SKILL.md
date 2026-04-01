---
name: structured-generation
description: Use when LLM output must conform to a specific schema, type, or format — JSON responses, typed function returns, database records, API payloads. Apply when free-text LLM output breaks downstream parsing, requires fragile regex extraction, or produces inconsistent shapes across calls. Covers schema enforcement, output typing, validation, and error recovery.
---

# Structured Generation

## Pain Signals — You Need This Pattern When:

- LLM output is parsed with regex, string splitting, or "hope"
- Downstream code breaks when the LLM returns an unexpected format
- The same prompt sometimes returns JSON, sometimes prose, sometimes partial JSON
- You are writing brittle extraction code to pull structured data from free text
- Different calls to the same prompt produce outputs with different field names or shapes
- A parsing failure means the entire operation fails with no recovery path

---

## Core Principle

An LLM is a **function**. Like any function, it should have a defined return type. Structured Generation constrains the output to a schema so the caller can rely on the shape without parsing or guessing.

The constraint happens at three possible levels — use the strongest one available:

| Level | Mechanism | Reliability |
|-------|-----------|-------------|
| **API-enforced** | `response_format` / JSON mode / tool definitions | Highest — model is constrained at decode time |
| **Schema-in-prompt** | JSON Schema or TypeScript type in the system prompt | Medium — model usually complies but can drift |
| **Post-parse validation** | Parse output, validate against schema, retry on failure | Lowest — fallback, not primary strategy |

**Always prefer API-enforced** when available. Schema-in-prompt is the fallback. Post-parse validation is the safety net — never the only mechanism.

---

## API-Enforced Structured Output

Most modern LLM APIs support constraining output to a schema at decode time. This is the most reliable approach.

```python
from anthropic import Anthropic

client = Anthropic()

# Define the schema as a tool — the model is constrained to call it
tools = [{
    "name": "extract_invoice",
    "description": "Extract structured invoice data from text",
    "input_schema": {
        "type": "object",
        "properties": {
            "vendor_name": {"type": "string"},
            "invoice_number": {"type": "string"},
            "line_items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "quantity": {"type": "integer"},
                        "unit_price": {"type": "number"}
                    },
                    "required": ["description", "quantity", "unit_price"]
                }
            },
            "total": {"type": "number"},
            "currency": {"type": "string", "enum": ["USD", "EUR", "GBP"]}
        },
        "required": ["vendor_name", "invoice_number", "line_items", "total", "currency"]
    }
}]

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    tools=tools,
    tool_choice={"type": "tool", "name": "extract_invoice"},
    messages=[{"role": "user", "content": f"Extract invoice data:\n\n{invoice_text}"}]
)

# Output is guaranteed to match the schema
invoice_data = response.content[0].input  # typed, validated
```

---

## Schema-in-Prompt (Fallback)

When API-level enforcement is not available, embed the schema in the prompt. Less reliable but still effective with clear instructions.

```python
EXTRACTION_PROMPT = """Extract the following fields from the text.

Return ONLY valid JSON matching this exact schema:
{
  "vendor_name": string,
  "invoice_number": string,
  "line_items": [{"description": string, "quantity": int, "unit_price": float}],
  "total": float,
  "currency": "USD" | "EUR" | "GBP"
}

Do not include any text before or after the JSON.

Text:
{input_text}
"""
```

**Pair with validation**: always parse and validate the output against the schema. Retry with the error message if validation fails.

---

## Validation and Retry

Even with API-enforced schemas, validate the semantic content (not just the shape). A structurally valid response can be semantically wrong.

```python
from pydantic import BaseModel, field_validator

class InvoiceExtraction(BaseModel):
    vendor_name: str
    invoice_number: str
    line_items: list[LineItem]
    total: float
    currency: str

    @field_validator('total')
    def total_must_match_items(cls, v, info):
        expected = sum(item.quantity * item.unit_price for item in info.data.get('line_items', []))
        if abs(v - expected) > 0.01:
            raise ValueError(f"Total {v} does not match sum of line items {expected}")
        return v

def extract_invoice(text: str, max_retries: int = 2) -> InvoiceExtraction:
    for attempt in range(max_retries + 1):
        raw = call_llm(text)
        try:
            return InvoiceExtraction.model_validate(raw)
        except ValidationError as e:
            if attempt == max_retries:
                raise
            # Include the error in the retry prompt so the model can self-correct
            text = f"{text}\n\nPrevious attempt failed validation: {e}\nPlease correct."
```

---

## Design Patterns for Structured Output

### Typed LLM Function

Wrap every LLM call in a function with typed inputs and outputs. The caller never sees raw LLM output.

```python
def classify_support_ticket(ticket_text: str) -> TicketClassification:
    """LLM-powered function with a typed return value."""
    response = client.messages.create(
        model="claude-sonnet-4-6",
        tools=[CLASSIFICATION_TOOL],
        tool_choice={"type": "tool", "name": "classify_ticket"},
        messages=[{"role": "user", "content": ticket_text}]
    )
    return TicketClassification.model_validate(response.content[0].input)
```

### Enum Constraints

For classification tasks, constrain outputs to a defined set of values.

```python
class SentimentResult(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float  # 0.0 to 1.0
    reasoning: str     # model explains its classification
```

### Partial/Streaming Structured Output

For long-running extractions, stream partial results and validate incrementally.

```python
# Stream JSON objects as they are produced
async for partial in stream_structured(prompt, schema=OrderList):
    if partial.is_complete_item():
        yield validate_and_store(partial.item)
```

---

## When NOT to Use

- When the output is genuinely free-form text (creative writing, conversation, explanation) — do not force structure where it adds no value
- When the schema is so complex that the model spends most of its capacity on formatting instead of reasoning — simplify the schema or decompose into multiple calls
- When a simpler extraction method (regex, XPath, CSS selectors) would be more reliable for the specific input format

---

## Design Checklist

- [ ] Every LLM call that feeds into downstream code has a defined output schema
- [ ] API-level schema enforcement is used when available; prompt-level is the fallback
- [ ] Output is validated both structurally (schema) and semantically (business rules)
- [ ] Retry logic includes the validation error in the retry prompt for self-correction
- [ ] The LLM function has typed inputs and outputs — callers never see raw LLM responses
- [ ] Enum/Literal types are used for classification outputs, not open strings
- [ ] Schema complexity is proportional to the task — over-complex schemas degrade output quality
