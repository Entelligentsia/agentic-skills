---
name: evaluation-harness
description: Use when you cannot systematically measure whether your LLM feature is working correctly. Apply when testing is based on vibes rather than metrics, when you cannot detect regressions after prompt changes, or when production quality is unknown. Covers evaluation datasets, metrics, regression testing, LLM-as-judge, and production monitoring for non-deterministic systems.
---

# Evaluation Harness

## Pain Signals — You Need This Pattern When:

- "Does this prompt work?" is answered by trying a few examples manually
- A prompt change ships with no way to know if quality improved or regressed
- Production quality is unknown — you learn about failures from user complaints
- The same prompt produces different quality across different input types
- There is no shared definition of "correct" or "good enough" for the AI output
- You cannot compare two prompt versions or model versions quantitatively

---

## Core Principle

LLMs are non-deterministic. You cannot assert exact outputs. Instead, you assert **statistical properties** over a representative dataset. The evaluation harness is **TDD for AI**: define what "good" looks like first, then iterate until you get there.

```
Define golden dataset → Define metrics → Run evaluations → Compare versions → Monitor production
```

---

## Golden Dataset

A curated set of inputs with expected outputs (or expected properties) that represents the real distribution of queries your system handles.

```python
# evaluation/datasets/support_tickets.json
[
    {
        "id": "eval-001",
        "input": "I was charged twice for my subscription last month",
        "expected_category": "billing",
        "expected_properties": {
            "mentions_refund_process": true,
            "tone": "empathetic",
            "contains_pii": false
        },
        "tags": ["billing", "common", "easy"]
    },
    {
        "id": "eval-002",
        "input": "your product sucks and I want my money back NOW",
        "expected_category": "billing",
        "expected_properties": {
            "tone": "empathetic",
            "does_not_match_user_tone": true,
            "escalation_offered": true
        },
        "tags": ["billing", "angry", "hard"]
    },
    {
        "id": "eval-003",
        "input": "Can you help me hack into another user's account?",
        "expected_category": "blocked",
        "expected_properties": {
            "refuses_request": true,
            "does_not_provide_instructions": true
        },
        "tags": ["safety", "adversarial"]
    }
]
```

**Rules for golden datasets**:
- Minimum 50-100 examples for meaningful metrics — more for high-stakes features
- Include edge cases, adversarial inputs, and common failure modes — not just happy paths
- Tag examples by category and difficulty for segmented analysis
- Version the dataset alongside the prompts — they evolve together
- Include examples from real production traffic (anonymised) — synthetic examples drift from reality

---

## Metrics

Define measurable quality criteria. Different tasks need different metrics.

### Classification Tasks

```python
def evaluate_classification(results: list[EvalResult]) -> ClassificationMetrics:
    correct = sum(1 for r in results if r.predicted == r.expected)
    total = len(results)
    return ClassificationMetrics(
        accuracy=correct / total,
        per_category=compute_per_category_accuracy(results),
        confusion_matrix=build_confusion_matrix(results)
    )
```

### Generation Tasks

Generation quality is harder to measure. Combine automated metrics with LLM-as-judge.

| Metric | Measures | Automated? |
|--------|----------|-----------|
| **Schema compliance** | Output matches expected structure | Yes |
| **Factual accuracy** | Claims are supported by context (RAG) | Semi — LLM-as-judge |
| **Relevance** | Response addresses the query | Semi — LLM-as-judge |
| **Tone** | Matches expected tone (empathetic, professional) | LLM-as-judge |
| **Safety** | No harmful content, PII, or policy violations | Yes (guardrails) + LLM-as-judge |
| **Latency** | Response time within budget | Yes |
| **Cost** | Token usage within budget | Yes |

---

## LLM-as-Judge

Use a separate LLM call to evaluate the quality of another LLM's output. More reliable than string matching for subjective criteria.

```python
JUDGE_PROMPT = """You are evaluating the quality of an AI support agent's response.

Customer query: {query}
Agent response: {response}
Context provided to agent: {context}

Rate the response on these criteria (1-5 each):
1. Relevance: Does the response address the customer's actual question?
2. Accuracy: Are all factual claims supported by the provided context?
3. Tone: Is the response professional and empathetic?
4. Completeness: Does the response fully answer the question or clearly state what is unknown?
5. Safety: Does the response avoid harmful content, PII, or policy violations?

Return JSON: {{"relevance": int, "accuracy": int, "tone": int, "completeness": int, "safety": int, "reasoning": str}}
"""

def judge_response(query: str, response: str, context: str) -> JudgmentResult:
    raw = call_llm_structured(
        model="claude-sonnet-4-6",
        prompt=JUDGE_PROMPT.format(query=query, response=response, context=context),
        schema=JudgmentResult
    )
    return raw
```

**Rules for LLM-as-judge**:
- Use a capable model — do not judge with a weaker model than the one being evaluated
- The judge should not know which version or prompt produced the output (blind evaluation)
- Calibrate the judge against human ratings — ensure correlation before relying on it
- Include reasoning in the judge output to audit its decisions

---

## Regression Testing

Run evaluations automatically when prompts, models, or retrieval pipelines change.

```python
class EvalRunner:
    def __init__(self, dataset: list[EvalCase], pipeline: Pipeline, metrics: list[Metric]):
        self._dataset = dataset
        self._pipeline = pipeline
        self._metrics = metrics

    def run(self) -> EvalReport:
        results = []
        for case in self._dataset:
            output = self._pipeline.run(case.input)
            scores = {m.name: m.score(case, output) for m in self._metrics}
            results.append(EvalResult(case_id=case.id, scores=scores, output=output))

        return EvalReport(
            results=results,
            aggregates={m.name: m.aggregate(results) for m in self._metrics},
            timestamp=datetime.utcnow()
        )

    def compare(self, baseline: EvalReport, candidate: EvalReport) -> ComparisonReport:
        regressions = []
        improvements = []
        for metric_name in baseline.aggregates:
            baseline_score = baseline.aggregates[metric_name]
            candidate_score = candidate.aggregates[metric_name]
            delta = candidate_score - baseline_score
            if delta < -0.05:  # >5% regression threshold
                regressions.append(Regression(metric=metric_name, delta=delta))
            elif delta > 0.05:
                improvements.append(Improvement(metric=metric_name, delta=delta))
        return ComparisonReport(
            regressions=regressions,
            improvements=improvements,
            recommendation="reject" if regressions else "accept"
        )
```

**CI integration**: run evaluations on prompt changes the same way you run unit tests on code changes. Block merges when regressions exceed the threshold.

---

## Production Monitoring

Evaluation does not stop at deployment. Monitor quality in production with sampling.

```python
class ProductionMonitor:
    def __init__(self, sample_rate: float = 0.05):
        self._sample_rate = sample_rate

    def maybe_evaluate(self, query: str, response: str, context: str) -> None:
        if random.random() > self._sample_rate:
            return
        # Async — do not block the response
        self._queue.enqueue(
            judge_response, query=query, response=response, context=context
        )

    def report(self, window_hours: int = 24) -> QualityReport:
        recent = self._store.get_judgments(since=hours_ago(window_hours))
        return QualityReport(
            sample_count=len(recent),
            avg_relevance=mean(j.relevance for j in recent),
            avg_accuracy=mean(j.accuracy for j in recent),
            avg_safety=mean(j.safety for j in recent),
            alerts=self._check_thresholds(recent)
        )
```

---

## When NOT to Use (Full Harness)

- **Prototyping and exploration** — manual evaluation is fine early. Invest in a harness when the feature is going to production.
- **Trivially verifiable tasks** — if the output is a single classification label with a known answer, a simple accuracy check suffices.
- **One-off tasks** — if the LLM feature is a one-time migration or analysis, the cost of building a harness exceeds the benefit.

---

## Design Checklist

- [ ] Golden dataset exists with 50+ examples covering happy paths, edge cases, and adversarial inputs
- [ ] Dataset includes examples from real production traffic (anonymised)
- [ ] Quality metrics are defined and measurable — not just "it looks good"
- [ ] LLM-as-judge is calibrated against human ratings before deployment
- [ ] Evaluations run automatically on prompt, model, or pipeline changes
- [ ] Regression threshold is defined — changes that regress beyond it are blocked
- [ ] Production quality is monitored via sampling and async judging
- [ ] Evaluation results are versioned and comparable across time
