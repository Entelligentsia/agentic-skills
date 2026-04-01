# Case Study: Reengineering a Legacy Codebase with Design Pattern Skills

*How a senior engineer used Claude Code with `design-patterns` and `llm-patterns` to systematically transform an 80,000-line invoicing platform — driven by pain, not by pattern names.*

---

## The Starting Point

Maya inherits a B2B invoicing platform: Django backend, React frontend, 80,000 lines, four years of accumulated decisions by engineers who have all since left. The CEO wants a multi-tenant SaaS migration in Q3.

She has Claude Code with the `design-patterns` and `llm-patterns` skill packs installed.

## The Approach

Every change follows the same discipline:

1. **Name the pain** — describe the friction in the code, not the pattern you think you need
2. **Let the skill route** — `pattern-selection` maps the pain to the canonical pattern
3. **Apply the pattern** — follow the skill's guidance, code examples, and design checklist
4. **Validate** — check the design checklist before committing

---

## Discovery: Reading the Codebase

Maya asks Claude to examine the service layer. Claude identifies four distinct pains:

| Pain | Category | Skill |
|------|----------|-------|
| `InvoiceService` has 1,400 lines mixing orchestration and business rules | Service layer / domain modeling | `service-layer`, `domain-modeling` |
| `db.query()` calls in route handlers | Data access bleeding into presentation | `data-access` |
| `if invoice.status == 'draft'` repeated in 11 places | Behaviour driven by state | `behavioural` (State pattern) |
| `stripe.PaymentIntent` objects passed into domain code | External types in domain layer | `anti-corruption` |

Each pain maps to a skill. Each skill maps to a canonical solution. No guessing.

---

## Transformation 1: The Anemic Invoice → Rich Domain Model

**Pain**: Domain objects are data bags with no behaviour. All business rules live in `InvoiceService`.

**Skill**: `domain-modeling` — Entity, Aggregate Root.

**Before** — business rules in the service:

```python
# InvoiceService.py
def submit_invoice(self, invoice_id):
    invoice = db.query(Invoice).get(invoice_id)
    if invoice.status != 'draft':
        raise ValueError("Can only submit draft invoices")
    if len(invoice.line_items) == 0:
        raise ValueError("Invoice must have line items")
    if invoice.total <= 0:
        raise ValueError("Invoice total must be positive")
    invoice.status = 'submitted'
    invoice.submitted_at = datetime.utcnow()
    db.session.commit()
    send_email(invoice.customer_email, "Invoice submitted", ...)
    log_event("invoice.submitted", invoice_id)
```

**After** — invariants enforced in the domain object, service reduced to thin orchestration:

```python
# invoice.py — domain object with behaviour
class Invoice:
    def submit(self) -> None:
        if self.status != InvoiceStatus.DRAFT:
            raise InvalidOperation("Can only submit draft invoices")
        if not self.line_items:
            raise EmptyInvoiceError()
        if self.total <= Money.zero(self.currency):
            raise InvalidInvoiceTotal()
        self._status = InvoiceStatus.SUBMITTED
        self._submitted_at = datetime.utcnow()
        self._record_event(InvoiceSubmitted(
            invoice_id=self.id,
            customer_id=self.customer_id,
            total=self.total
        ))

# invoice_application_service.py — orchestration only
def submit_invoice(self, command: SubmitInvoiceCommand) -> None:
    invoice = self._invoices.find_by_id(command.invoice_id)
    invoice.submit()
    self._invoices.save(invoice)
    self._events.publish(invoice.pop_events())
```

**Checklist verified**: business rules in domain methods, no anemic objects, events replace direct side effects.

---

## Transformation 2: The Stripe Leak → Anti-Corruption Layer

**Pain**: `stripe.PaymentIntent` objects imported in 7 files. When Stripe changed their API, 9 files needed touching.

**Skill**: `anti-corruption` — Anti-Corruption Layer, Gateway.

**After** — one translation layer, domain never sees Stripe:

```python
# domain — owns the vocabulary
class PaymentGateway:
    def authorize(self, amount: Money) -> PaymentAuthorization: ...
    def capture(self, authorization_id: PaymentId) -> CaptureResult: ...

# infrastructure — translates
class StripePaymentGateway(PaymentGateway):
    def authorize(self, amount: Money) -> PaymentAuthorization:
        intent = self._stripe.PaymentIntent.create(
            amount=amount.in_cents(),
            currency=amount.currency.code.lower()
        )
        return PaymentAuthorization(
            id=PaymentId(intent.id),
            status=self._map_status(intent.status)
        )
```

**Result**: 7 files importing `stripe` reduced to 1. Next Stripe API change touches one file.

---

## Transformation 3: Status Conditionals → State Pattern

**Pain**: `if invoice.status == ...` branches duplicated across 11 locations. Adding a new status requires finding and updating every branch.

**Skill**: `behavioural` — State pattern.

**After** — each state is a class with explicit valid transitions:

```python
class DraftState(InvoiceState):
    def submit(self, invoice: Invoice) -> None:
        invoice.validate_for_submission()
        invoice.transition_to(SubmittedState())

    def void(self, invoice: Invoice) -> None:
        invoice.transition_to(VoidedState())

    def record_payment(self, invoice: Invoice, payment: PaymentId) -> None:
        raise InvalidOperation("Cannot record payment on a draft invoice")

class SubmittedState(InvoiceState):
    def submit(self, invoice: Invoice) -> None:
        raise InvalidOperation("Already submitted")

    def record_payment(self, invoice: Invoice, payment: PaymentId) -> None:
        invoice.add_payment(payment)
        if invoice.is_fully_paid():
            invoice.transition_to(PaidState())
```

**Result**: 11 scattered conditionals become 6 state classes. Invalid transitions are impossible — they raise immediately.

---

## Transformation 4: Fake Repository → Real Repository

**Pain**: `InvoiceRepository` returns raw dictionaries. Route handlers construct domain objects manually. Query methods named after SQL, not domain concepts.

**Skill**: `data-access` — Repository pattern.

**After** — domain defines the interface, infrastructure satisfies it:

```python
# domain/repositories.py
class InvoiceRepository:
    def find_by_id(self, id: InvoiceId) -> Optional[Invoice]: ...
    def find_overdue(self) -> list[Invoice]: ...
    def find_pending_for_customer(self, customer_id: CustomerId) -> list[Invoice]: ...
    def save(self, invoice: Invoice) -> None: ...

# infrastructure/sql_invoice_repository.py
class SqlInvoiceRepository(InvoiceRepository):
    def find_overdue(self) -> list[Invoice]:
        rows = self._db.query("""
            SELECT * FROM invoices
            WHERE status = 'submitted' AND due_date < NOW()
        """)
        return [self._mapper.to_domain(row) for row in rows]
```

**Result**: Route handlers no longer touch the database. Repository returns domain objects. Each layer has one job.

---

## New Feature: Smart Payment Reminders with LLM Patterns

With the domain model clean, Maya builds a new AI-powered feature: personalised payment reminder emails.

### Step 1: Pattern Selection

The `llm-pattern-selection` skill routes her pain:

- Output must match an email schema → **Structured Generation**
- Production feature, needs reliability → **Graceful Degradation**
- Repeated task with limited variation → **Tool Synthesis** candidate

### Step 2: Structured Generation

The reminder email has a typed schema. The LLM is constrained to this shape:

```python
class ReminderEmail(BaseModel):
    subject: str
    body: str
    tone: Literal["friendly", "firm", "final_notice"]
    urgency: Literal["low", "medium", "high"]
```

### Step 3: Graceful Degradation

Primary model generates personalised content. Fallback: template engine fills in customer name and amount. No LLM needed.

```python
chain = FallbackChain([
    PersonalisedReminderStrategy(model="claude-sonnet-4-6"),
    TemplateReminderStrategy(templates=REMINDER_TEMPLATES),
])
```

### Step 4: Tool Synthesis

After a week of production data, Claude evaluates the decision framework:

| Criterion | Result |
|-----------|--------|
| Deterministic? | Partially — 4 segments × 3 tones produce similar emails |
| Repeated? | Yes — 2,000 reminders/week |
| Stable? | Yes — segments and tones unchanged for months |
| Verifiable? | Yes — previous emails serve as golden dataset |
| Bounded? | Yes — 12 combinations |

**Verdict: hybrid.** Claude generates 12 email templates for the common cases. The LLM handles the 15% where customer history warrants a genuinely custom message.

**Result**: Cost drops from $60/week to $9/week. Latency from 3 seconds to 50 milliseconds on the templated path.

---

## The Scorecard

| Dimension | Before | After |
|-----------|--------|-------|
| Domain model | Anemic — data bags with no behaviour | Rich — invariants enforced in domain objects |
| Service layer | 1,400-line god class | Thin orchestration + domain services |
| External integration | Stripe imported in 7 files | 1 file: ACL gateway |
| Status logic | 11 scattered conditionals | 6 explicit state classes |
| Data access | Fake repository returning dicts | Domain-owned interface, infrastructure implementation |
| AI feature | Did not exist | Structured output + graceful degradation + synthesised templates |

---

## The Method

Every transformation followed the same discipline:

1. **Describe the friction** — not "I want to use Strategy pattern" but "this branching keeps growing"
2. **Let the decision tree route** — `pattern-selection` maps pain to the canonical solution
3. **Follow the skill** — canonical definition, code examples, and design checklist
4. **Validate before committing** — the design checklist catches violations before they ship

The skills carry the knowledge of Fowler, Evans, and the Gang of Four — so the engineer does not need to have read the books to apply the patterns correctly. The codebase moves toward proven architecture incrementally, one named pain at a time.
