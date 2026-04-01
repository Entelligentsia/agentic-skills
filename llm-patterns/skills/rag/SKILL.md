---
name: rag
description: Use when LLM responses must be grounded in factual, up-to-date, or domain-specific data that the model was not trained on. Apply when the LLM hallucinates facts, gives outdated information, lacks knowledge of proprietary data, or needs to cite sources. Covers Retrieval-Augmented Generation — retrieval strategies, chunking, ranking, context assembly, and when simpler alternatives suffice.
---

# Retrieval-Augmented Generation (RAG)

## Pain Signals — You Need This Pattern When:

- The LLM confidently states facts that are wrong (hallucination)
- The LLM does not know about your proprietary data, internal docs, or recent events
- Answers need to cite specific sources for auditability or trust
- Fine-tuning is too expensive or too slow for the rate of knowledge change
- The knowledge base changes frequently — weekly, daily, or in real time
- Users ask questions that require domain-specific expertise the model lacks

---

## Core Principle

RAG separates **knowledge** (what to reason about) from **reasoning** (how to think about it). The retriever provides relevant context; the LLM reasons over it. Neither is sufficient alone:

- LLM without retrieval → hallucination, stale knowledge
- Retrieval without LLM → keyword matches, no reasoning, no synthesis

```
User query → Retrieve relevant documents → Assemble context → LLM generates answer grounded in context
```

---

## Architecture

### The Three Stages

```
1. RETRIEVE    →    2. RANK/FILTER    →    3. GENERATE
   Find candidates      Select the best        Reason over context
   from the corpus       matches                and produce answer
```

### Basic Implementation

```python
class RAGPipeline:
    def __init__(
        self,
        embedder: Embedder,
        vector_store: VectorStore,
        llm: LLMClient
    ):
        self._embedder = embedder
        self._store = vector_store
        self._llm = llm

    def answer(self, query: str, top_k: int = 5) -> RAGResponse:
        # 1. Retrieve
        query_embedding = self._embedder.embed(query)
        candidates = self._store.search(query_embedding, limit=top_k)

        # 2. Rank / Filter
        relevant = [c for c in candidates if c.score >= self._min_score]
        if not relevant:
            return RAGResponse(answer="I don't have enough information to answer this.",
                               sources=[], confidence="low")

        # 3. Generate
        context = self._format_context(relevant)
        answer = self._llm.generate(
            system="Answer based ONLY on the provided context. "
                   "If the context does not contain the answer, say so. "
                   "Cite sources by [number].",
            user=f"Context:\n{context}\n\nQuestion: {query}"
        )
        return RAGResponse(
            answer=answer,
            sources=[c.metadata for c in relevant],
            confidence="high" if relevant[0].score > 0.85 else "medium"
        )

    def _format_context(self, chunks: list[Chunk]) -> str:
        return "\n\n".join(
            f"[{i+1}] {chunk.text}\nSource: {chunk.metadata['source']}"
            for i, chunk in enumerate(chunks)
        )
```

---

## Chunking Strategies

How you split documents into chunks determines retrieval quality. There is no universally correct chunk size — it depends on document type and query patterns.

| Strategy | Best For | Typical Size |
|----------|----------|-------------|
| **Fixed-size** | Uniform documents, simple implementation | 200–500 tokens |
| **Semantic** | Documents with clear section boundaries | 1 section/heading |
| **Sentence-window** | Dense documents where single sentences need surrounding context | 1–3 sentences + surrounding window |
| **Recursive** | Mixed documents — split by paragraph, then sentence, then character | Varies |
| **Document-level** | Short documents (emails, tickets, FAQ entries) | Entire document |

```python
# Recursive chunking — tries larger boundaries first
def recursive_chunk(text: str, max_tokens: int = 400) -> list[str]:
    separators = ["\n\n", "\n", ". ", " "]
    for sep in separators:
        chunks = text.split(sep)
        if all(token_count(c) <= max_tokens for c in chunks):
            return [c.strip() for c in chunks if c.strip()]
    # Last resort: hard split by tokens
    return split_by_tokens(text, max_tokens)
```

**Critical rule**: always include metadata with each chunk (source document, page, section heading, date). Without provenance, citations are impossible and debugging is painful.

---

## Retrieval Strategies

### Semantic Search (Dense Retrieval)

Embed the query and find nearest neighbors in vector space. Good for meaning-based matching.

```python
query_embedding = embedder.embed("What is our refund policy?")
results = vector_store.search(query_embedding, limit=10)
```

**Limitation**: misses keyword-specific matches (exact product names, error codes, IDs).

### Keyword Search (Sparse Retrieval)

BM25 or TF-IDF over the corpus. Good for exact term matches.

```python
results = bm25_index.search("error code ERR-4521", limit=10)
```

**Limitation**: misses semantic similarity (different words, same meaning).

### Hybrid Search

Combine dense and sparse retrieval, then merge results with reciprocal rank fusion.

```python
semantic_results = vector_store.search(query_embedding, limit=20)
keyword_results = bm25_index.search(query_text, limit=20)
merged = reciprocal_rank_fusion(semantic_results, keyword_results, k=60)
return merged[:top_k]
```

**Recommendation**: start with hybrid. Semantic-only misses too many exact matches; keyword-only misses too many meaning matches.

---

## Context Assembly

The retrieved chunks must be assembled into a context that fits the token budget and maximises answer quality.

```python
def assemble_context(
    chunks: list[Chunk],
    max_tokens: int = 4000
) -> str:
    context_parts = []
    token_count = 0
    for chunk in chunks:  # already ranked by relevance
        chunk_tokens = count_tokens(chunk.text)
        if token_count + chunk_tokens > max_tokens:
            break
        context_parts.append(chunk.formatted())
        token_count += chunk_tokens
    return "\n\n---\n\n".join(context_parts)
```

**Rules**:
- Most relevant chunks first — if context is truncated, the best information survives
- Include source metadata in the context so the model can cite it
- Reserve enough token budget for the model's answer — do not fill 95% of the context with retrieval

---

## When NOT to Use RAG

- **The model already knows the answer** — general knowledge questions, widely known facts, standard programming patterns. Adding retrieval adds latency for no gain.
- **The data is small enough to fit in context** — if the entire knowledge base fits in the prompt (a few thousand tokens), just include it directly. Retrieval adds unnecessary complexity.
- **The task is not knowledge-dependent** — creative writing, code generation from a spec, translation, summarisation of provided text. These do not benefit from external retrieval.
- **You need guaranteed correctness** — RAG reduces hallucination but does not eliminate it. For safety-critical applications, RAG outputs must still be verified by a human or deterministic system.

---

## Common Failures

| Failure | Cause | Fix |
|---------|-------|-----|
| Correct document retrieved but wrong answer | Chunk too large — relevant detail diluted | Smaller chunks, or chunk with metadata pointing to exact section |
| Relevant document not retrieved | Embedding mismatch or vocabulary gap | Hybrid search; query expansion; re-embed with domain-tuned model |
| Model ignores context and uses training knowledge | Weak system prompt | Explicit instruction: "Answer ONLY from the provided context" |
| Citations point to wrong sources | Chunks not labelled with provenance | Always include source metadata in every chunk |

---

## Design Checklist

- [ ] Chunks include metadata: source document, page/section, date, any relevant identifiers
- [ ] Hybrid retrieval (semantic + keyword) is the default unless there is a strong reason for one only
- [ ] System prompt explicitly instructs the model to use only the provided context
- [ ] Context assembly respects the token budget — most relevant chunks first, answer budget reserved
- [ ] Low-confidence responses (no relevant retrievals) are surfaced honestly, not hallucinated
- [ ] Retrieval quality is evaluated independently from generation quality
- [ ] Index is kept up to date — stale indexes produce stale answers
