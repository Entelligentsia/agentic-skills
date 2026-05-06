---
name: streaming-io
description: Use when an agent harness must stream model output to the user in real time, dispatch tool calls mid-stream, or support cancellation before generation completes. Apply when building the IO layer that mediates between the model's token stream and the user/UI. Covers SSE/streaming protocols, partial JSON parsing, mid-stream tool-call dispatch, cancellation propagation, backpressure, and reconnect semantics.
---

# Streaming IO

## Pain Signals — You Need This Pattern When:

- TTFT (time to first token) matters; users wait silently for 30+ seconds
- The harness exposes a UI where typing-style output is expected
- Long generations need to be cancellable mid-stream (user changes mind, model goes off-rails)
- Tool calls should dispatch as soon as the model commits, not after the full turn completes
- Structured output is large; partial parse + early validation catches errors faster

**Streaming changes the harness from request/response to event pipeline.** Every assumption about "I have the full response now" must be revisited.

---

## Core Principle

The model emits a stream of events; the harness threads those events through transformation, dispatch, and rendering. Each event has a type and may carry partial content.

```
model ──▶ event ──▶ event ──▶ event ──▶ event ──▶ ...
              │         │         │         │
              ▼         ▼         ▼         ▼
           render    parse     dispatch    log
              │       JSON     tool        usage
              ▼       (partial)
            UI
```

Events typically include: `message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop`. Tool-use blocks appear as their own content blocks with `input_json_delta` events.

---

## Wire Formats

| Format | Use when |
|--------|----------|
| **SSE (Server-Sent Events)** | HTTP server → browser/client; one-way; native EventSource support |
| **WebSocket** | Bidirectional; cancellation upstream needed |
| **gRPC streaming** | Service-to-service; typed schemas |
| **Newline-delimited JSON** | CLI; subprocess pipes |

SSE is the default for user-facing streaming. WebSocket only when client must send messages mid-stream (cancellation, course-correction).

---

## Partial JSON Parsing

Tool inputs arrive as `input_json_delta` events — JSON fragments, not complete objects. Naive `json.loads` on partial input fails until the last delta.

Strategies:

- **Defer parse until block_stop.** Simplest. Lose mid-stream visibility into tool args. Default for most cases.
- **Streaming JSON parser.** Library like `ijson` / `partial-json-parser` — emits values as they complete. Useful when a single tool call produces a large payload and you want to start acting on early fields.
- **Schema-aware speculative parse.** Tool schema known; recover as much as possible from prefix even if not yet valid JSON. Brittle.

Recommended: defer parse, but expose progress (token count, byte count) for UX.

```python
async def consume_stream(stream):
    blocks = {}
    async for event in stream:
        if event.type == "content_block_start":
            blocks[event.index] = {"type": event.content_block.type, "buffer": ""}
        elif event.type == "content_block_delta":
            blocks[event.index]["buffer"] += event.delta.partial_json or event.delta.text or ""
        elif event.type == "content_block_stop":
            block = blocks[event.index]
            if block["type"] == "tool_use":
                yield ToolCall(input=json.loads(block["buffer"]))
            else:
                yield TextBlock(text=block["buffer"])
```

---

## Mid-Stream Tool Dispatch

When a tool-use block completes (`content_block_stop`), the harness can dispatch immediately — no need to wait for `message_stop`. This matters when:

- Multiple tool calls in a single turn dispatch in parallel
- Tool latency dominates total turn latency
- Early tool results can stream back to the user as the model still generates

```
model emits text...........tool_use(A) stop  text..........tool_use(B) stop  message_stop
                                  │                              │
                                  ▼                              ▼
                          dispatch(A) ──▶ result_A      dispatch(B) ──▶ result_B
                                                                                 │
                                                                                 ▼
                                                          send tool_results turn
```

Caveat: only dispatch when the tool-use block is complete. Dispatching on partial JSON is undefined behavior.

---

## Cancellation

Three layers must agree:

1. **User intent.** UI button, Ctrl-C, programmatic cancel.
2. **Harness-side stream consumer.** Stops reading; releases the model connection.
3. **Upstream API.** Connection close → API stops billing; partial usage already incurred is final.

```python
class CancellableStream:
    def __init__(self, stream, cancel_event):
        self._stream = stream
        self._cancel = cancel_event

    async def __aiter__(self):
        async for event in self._stream:
            if self._cancel.is_set():
                await self._stream.aclose()
                return
            yield event
```

After cancel:

- Already-dispatched tool calls keep running unless you actively cancel them too. If they have side effects, this matters — propagate cancellation into tool execution.
- Partial output already written to transcript stays. Mark as cancelled so resume logic knows.
- Cost telemetry records partial usage.

---

## Backpressure

If consumer (UI, downstream service) is slower than the model stream, events queue. Decide:

- **Buffer with bound.** Drop or block on overflow.
- **Coalesce text deltas.** Multiple `delta` events with text can merge into fewer larger renders if UI prefers.
- **Don't coalesce structured deltas.** Tool input deltas are byte-significant.

For most CLI/UI cases, the rendering path is fast enough that bounded buffer (1k events) with block-on-full is the right default.

---

## Reconnect / Resume

Mid-stream connection drop is common on flaky networks. Anthropic API does not natively support resume — a dropped stream means re-issuing the request. Mitigations:

- **Idempotent retry.** Re-send request with same parameters; cache hit makes it cheap.
- **Persist partial output.** What arrived before drop is in the transcript; new request continues conversationally.
- **Dedupe tool calls.** If the model already emitted a tool call before drop, the retry's tool calls may overlap. Use idempotency keys or skip already-dispatched.

For long generations, periodic event-log checkpoints (paired with session-persistence) make this manageable.

---

## UX Patterns

- **Render text incrementally** — flush on natural boundaries (sentence, line) for readable UX, not every token
- **Show "thinking" / "calling tool" state changes** — distinct from text rendering
- **Tool-call progress** — once dispatched, show tool name + status; don't render the JSON args mid-build
- **Cancellation visible** — make stop button obvious; confirm cancel succeeded
- **Cost visible** — token counter increments live; sets expectation
- **Errors mid-stream** — render what arrived, surface the error clearly, offer retry

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Buffering whole response before render | TTFT not improved by streaming | Flush deltas as they arrive |
| `json.loads` on partial buffer | Crashes mid-stream | Defer parse to block_stop |
| Cancel sets flag but stream not closed | Connection still billed | Close stream on cancel |
| Tool dispatched on partial JSON | Tool gets garbage args | Wait for content_block_stop |
| Cancellation does not propagate to tools | Side effects continue after cancel | Cancel tool execution too |
| Reconnect re-runs side-effecting tools | Duplicate ops | Idempotency keys / pre-flight check |
| Event order assumed | Delta after stop | Trust event types, not order beyond what API guarantees |
| No backpressure | OOM on slow consumer | Bounded buffer |
| Rendering every token to DOM | UI jank | Coalesce or rAF-batched render |

---

## When NOT to Use

- **Sub-second responses** where buffering saves nothing
- **Batch jobs** with no interactive consumer
- **Tool-only flows** where the model output is purely structured and you parse the whole thing anyway

---

## Design Checklist

- [ ] Wire format chosen (SSE / WebSocket / gRPC / NDJSON) per consumer needs
- [ ] Event types from API mapped to harness event taxonomy
- [ ] Partial JSON handling: defer to block_stop unless streaming-parse explicitly needed
- [ ] Mid-stream tool dispatch on `content_block_stop`, not earlier
- [ ] Cancellation closes stream and propagates to in-flight tools
- [ ] Bounded buffer with documented overflow policy
- [ ] Reconnect is idempotent (same request params, partial output preserved)
- [ ] Tool calls have idempotency keys to dedupe across retries
- [ ] UX renders incrementally with clear state transitions (thinking / streaming / tool / error)
- [ ] Cost / token counter updates live
- [ ] Cancelled streams marked in event log so session-persistence resume handles correctly
- [ ] Errors mid-stream surface with what-arrived-so-far visible
