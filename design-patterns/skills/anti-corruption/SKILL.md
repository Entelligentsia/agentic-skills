---
name: anti-corruption
description: Use when external system types, vocabulary, or conventions bleed into your domain model, a single provider change would require touching many internal files, or a legacy system must keep running while a new one is built alongside it. Apply before writing any integration with an external API, legacy codebase, or third-party service. Covers Anti-Corruption Layer, Gateway, Facade, and Strangler Fig.
---

# Integration and Anti-Corruption Patterns

*Sources: Eric Evans — Domain-Driven Design (2003); Martin Fowler — PoEAA (2002), Refactoring (1999)*

## Pain Signals — You Are in This Branch When:

- External API types, field names, or error codes appear directly in domain or service code
- Changing from one third-party provider to another requires touching many internal files
- Domain vocabulary conflicts with an external system's vocabulary for the same concept
- A legacy system must keep running while a replacement is built
- Translation logic (converting external formats to internal ones) is scattered across the codebase
- Tests that cover business logic break when an external API changes its response shape

---

## Core Principle

External systems have their own models, terminology, and constraints. Without an explicit translation layer, external concepts leak into your domain — corrupting it with foreign vocabulary, shapes, and assumptions. These patterns prevent that leakage.

---

## Anti-Corruption Layer (ACL)

An **explicit translation layer** between your domain model and an external system's model. Your domain never sees the external model directly.

**Pain it removes**: external types and vocabulary bleeding into domain code; domain logic breaking when an external API changes its response shape.

**When to use**: integrating with a legacy system, third-party API, or another bounded context using different concepts for the same things.

```python
# External payment API — their vocabulary, their types
class StripeClient:
    def create_payment_intent(self, amount_cents: int, currency: str) -> dict:
        ...  # returns Stripe's response structure

# ACL — translates between domains; lives in infrastructure layer
class PaymentGatewayACL:
    def __init__(self, stripe: StripeClient):
        self._stripe = stripe

    def authorize(self, money: Money) -> PaymentAuthorization:
        # Translate YOUR domain type → external format
        response = self._stripe.create_payment_intent(
            amount_cents=int(money.amount * 100),
            currency=money.currency.code.lower()
        )
        # Translate external response → YOUR domain type
        return PaymentAuthorization(
            id=PaymentId(response['id']),
            status=self._map_status(response['status']),
            authorized_at=datetime.utcnow()
        )

    def _map_status(self, stripe_status: str) -> PaymentStatus:
        mapping = {
            'requires_capture': PaymentStatus.AUTHORIZED,
            'succeeded': PaymentStatus.CAPTURED,
            'canceled': PaymentStatus.VOIDED,
        }
        return mapping.get(stripe_status, PaymentStatus.UNKNOWN)
```

**Rules**:
- ACL lives in the **infrastructure layer** — never in the domain layer
- Domain objects only ever see your types — never external types
- The ACL owns all mapping logic — do not scatter translation code throughout the codebase
- When the external API changes, only the ACL changes — domain is unaffected

---

## Gateway

Encapsulates access to an **external system or resource** behind an interface that your domain defines. Hides the external system entirely, not just translating its model.

**Pain it removes**: business logic coupled to the specifics of an external service; inability to test business logic without calling the external system; difficulty swapping providers.

**When to use**: you want to decouple your application from external service specifics; you want swappable implementations (real, stub, test double); you want to prevent provider-specific concerns from leaking into business logic.

```python
# Your domain defines the interface — it owns the vocabulary
class EmailGateway:
    def send_order_confirmation(self, order: Order) -> None: ...
    def send_password_reset(self, user: User, token: ResetToken) -> None: ...
    def send_payment_failed_notice(self, subscription: Subscription) -> None: ...

# Infrastructure satisfies it — using SendGrid, SES, Mailgun, etc.
class SendGridEmailGateway(EmailGateway):
    def send_order_confirmation(self, order: Order) -> None:
        self._client.send(
            to=str(order.customer_email),
            subject=f"Order #{order.id} confirmed",
            template_id=self._config.order_confirmation_template,
            data={'order_number': str(order.id), 'total': str(order.total)}
        )

# Test double — no external calls, full verification
class RecordingEmailGateway(EmailGateway):
    def __init__(self):
        self.sent: list[tuple] = []

    def send_order_confirmation(self, order: Order) -> None:
        self.sent.append(('order_confirmation', order.id))
```

**Testing benefit**: swap the real gateway for a recording double in tests — no external calls, full verification of what was sent and to whom.

---

## Facade (Integration Context)

Provides a **simplified interface** to a complex external subsystem or integration. Reduces the knowledge required to use the integration correctly.

*(See also: `structural` skill for Facade in internal subsystem contexts)*

**When to use**: an external integration requires multiple steps that must be called in sequence; you want to expose a single, safe entry point for the common cases.

```python
class ReportingFacade:
    """Hides the complexity of the reporting pipeline from callers."""
    def generate_monthly_summary(
        self, tenant_id: str, month: YearMonth
    ) -> ReportUrl:
        dataset = self._loader.load(tenant_id, month.start, month.end)
        normalised = self._normaliser.normalise(dataset)
        rendered = self._renderer.render(normalised, template='monthly_summary')
        return self._uploader.upload(rendered)
```

---

## Strangler Fig

Incrementally replaces a **legacy system** by routing traffic through a new implementation, gradually expanding the new surface until the legacy system can be retired.

**Pain it removes**: a legacy system that cannot be rewritten in one go; need to deliver value during migration; legacy must keep running throughout.

**When to use**: you cannot stop the world for a full rewrite; the legacy system must keep serving some traffic during migration; you want to prove the new system in production before fully committing.

```python
# Phase 1 — proxy routes all requests to legacy
class OrderServiceProxy:
    def get_order(self, id: str) -> Order:
        return self._legacy.get_order(id)  # 100% legacy

# Phase 2 — new system handles new-format IDs
class OrderServiceProxy:
    def get_order(self, id: str) -> Order:
        if id.startswith('ORD-'):
            return self._new.get_order(id)   # new format → new system
        return self._legacy.get_order(id)    # old format → legacy

# Phase N — legacy retired, proxy removed
```

**Critical rule**: the strangler proxy must be **transparent to callers** — same interface, same contract, same error semantics. Callers must not know which implementation served them.

**Migration checklist**:
- [ ] Define the strangling boundary clearly (URL prefix, ID format, message type, date range)
- [ ] Run both implementations in parallel and compare outputs before routing production traffic
- [ ] Maintain a fast rollback path: flipping the proxy back to legacy should take minutes
- [ ] Retire legacy components incrementally — do not leave them running "just in case"
- [ ] Remove the proxy once migration is complete — it is scaffolding, not permanent architecture

---

## Design Checklist

- [ ] External types never appear in domain layer code — only in the ACL or Gateway
- [ ] All mapping between external and internal models is in one place
- [ ] Gateway interface is defined by the domain, not derived from the external system's API
- [ ] Facade covers the common cases; does not prevent callers from accessing the full integration when needed
- [ ] Strangler Fig proxy is transparent to callers — same contract in, same contract out
- [ ] External API changes require changes only in the ACL/Gateway, not in domain or application code
- [ ] Test doubles exist for all external gateways, enabling business logic tests without external calls
