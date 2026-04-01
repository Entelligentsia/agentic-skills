---
name: tool-use
description: Use when an LLM needs to interact with external systems — calling APIs, querying databases, reading files, executing code, or performing actions with side effects. Apply when the LLM must go beyond text generation to retrieve live data, perform calculations, or trigger real-world operations. Covers tool definition, invocation patterns, safety boundaries, and error handling.
---

# Tool Use / Function Calling

## Pain Signals — You Need This Pattern When:

- The LLM needs live data it was not trained on (current prices, user account status, real-time metrics)
- The LLM needs to perform calculations it is unreliable at (maths, date arithmetic, aggregations)
- The task requires side effects — creating records, sending messages, modifying state
- The LLM needs to interact with external APIs or databases to answer questions
- Hard-coded logic would be faster but the tool selection itself requires natural language understanding

---

## Core Principle

Tool Use turns the LLM into a **controller** that decides *which* function to call and *with what arguments*, while the actual execution happens in deterministic, testable code. The LLM is the Strategy selector; the tools are the strategies.

```
User query → LLM decides which tool(s) → Tool executes → Result returned to LLM → LLM synthesises answer
```

The LLM never executes code directly. It expresses intent through structured tool calls; your system executes them.

---

## Defining Tools

Tools are defined by their **name**, **description**, and **input schema**. The description is critical — it is how the model decides when to use the tool.

```python
tools = [
    {
        "name": "get_order_status",
        "description": "Look up the current status of a customer order by order ID. "
                       "Use this when the user asks about an order, shipment, or delivery.",
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "The order ID, e.g. ORD-12345"
                }
            },
            "required": ["order_id"]
        }
    },
    {
        "name": "calculate_shipping",
        "description": "Calculate shipping cost for a given weight and destination. "
                       "Use this when the user asks about shipping costs or delivery fees.",
        "input_schema": {
            "type": "object",
            "properties": {
                "weight_kg": {"type": "number", "description": "Package weight in kilograms"},
                "destination_country": {"type": "string", "description": "ISO 3166-1 alpha-2 country code"}
            },
            "required": ["weight_kg", "destination_country"]
        }
    }
]
```

**Rules for tool definitions**:
- **Names** should be verbs: `get_order_status`, `calculate_shipping`, `create_invoice` — not `order` or `shipping`
- **Descriptions** should explain *when* to use the tool, not just what it does — this is the model's selection criteria
- **Input schemas** should use descriptive field names and include `description` for each parameter
- **Required fields** should be explicit — do not rely on the model guessing which fields are mandatory

---

## Execution Loop

A single user query may require multiple tool calls, possibly in sequence.

```python
def run_with_tools(user_message: str, tools: list[dict], max_rounds: int = 5) -> str:
    messages = [{"role": "user", "content": user_message}]

    for _ in range(max_rounds):
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            tools=tools,
            messages=messages
        )

        # If the model wants to use a tool
        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = execute_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(result)
                    })
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
        else:
            # Model is done — return final text
            return extract_text(response.content)

    raise MaxRoundsExceeded("Tool use loop did not converge")
```

---

## Safety Boundaries

Tools have different risk profiles. Classify every tool and enforce appropriate safeguards.

| Category | Risk | Example | Safeguard |
|----------|------|---------|-----------|
| **Read-only** | Low | `get_order_status`, `search_products` | None needed — safe to call freely |
| **Write** | Medium | `update_address`, `create_ticket` | Confirm with user before executing |
| **Destructive** | High | `cancel_order`, `delete_account` | Require explicit confirmation + audit log |
| **Financial** | High | `process_refund`, `charge_card` | Confirmation + amount limits + audit |

```python
TOOL_SAFETY = {
    "get_order_status": "read",
    "search_products": "read",
    "update_address": "write",
    "cancel_order": "destructive",
    "process_refund": "financial",
}

def execute_tool(name: str, args: dict) -> ToolResult:
    safety = TOOL_SAFETY[name]

    if safety in ("destructive", "financial"):
        if not user_confirmed(name, args):
            return ToolResult(error="User did not confirm this action")

    handler = TOOL_REGISTRY[name]
    return handler(**args)
```

**Rule**: the LLM never bypasses safety classification. The system enforces the boundary, not the model.

---

## Error Handling

Tool execution can fail. Return errors to the model so it can adapt — do not silently swallow them.

```python
def execute_tool(name: str, args: dict) -> str:
    try:
        handler = TOOL_REGISTRY.get(name)
        if handler is None:
            return json.dumps({"error": f"Unknown tool: {name}"})
        result = handler(**args)
        return json.dumps({"result": result})
    except ValidationError as e:
        return json.dumps({"error": f"Invalid input: {e}"})
    except NotFoundError as e:
        return json.dumps({"error": f"Not found: {e}"})
    except Exception as e:
        logger.error(f"Tool {name} failed: {e}")
        return json.dumps({"error": "An internal error occurred. Please try again."})
```

The model receives the error and can:
- Retry with corrected arguments
- Ask the user for clarification
- Fall back to answering without the tool

---

## Tool Composition

Complex queries may require multiple tools called in sequence, with the output of one feeding into the next.

```python
# User: "How much would it cost to ship my order ORD-12345?"
# Step 1: LLM calls get_order_status(order_id="ORD-12345") → gets weight
# Step 2: LLM calls calculate_shipping(weight_kg=2.5, destination_country="DE") → gets cost
# Step 3: LLM synthesises: "Shipping your order (2.5 kg) to Germany would cost €8.50."
```

The LLM orchestrates the sequence — your system only executes individual tool calls. This is where the LLM's reasoning ability adds genuine value over hard-coded workflows.

---

## When NOT to Use

- **The task is purely generative** — writing, summarising, translating. No external data needed.
- **The workflow is fixed** — if the sequence of API calls is always the same, hard-code the pipeline. Tool Use is for when the *selection* of tools varies by input.
- **The tool is too complex to describe in a schema** — if the tool has 30 parameters with complex interdependencies, the model will misuse it. Simplify the tool interface or decompose into smaller tools.
- **Latency is critical** — each tool call adds a round trip. If the user cannot tolerate multi-second latency, pre-fetch or cache the data instead.

---

## Design Checklist

- [ ] Every tool has a clear name (verb), description (when to use), and typed input schema
- [ ] Tools are classified by safety level: read / write / destructive / financial
- [ ] Destructive and financial tools require user confirmation before execution
- [ ] Tool execution errors are returned to the model, not silently swallowed
- [ ] The execution loop has a maximum round limit to prevent infinite tool-calling
- [ ] Tool results are audited — what was called, with what arguments, and what was returned
- [ ] Read-only tools are preferred where possible — avoid giving the model write access without explicit need
