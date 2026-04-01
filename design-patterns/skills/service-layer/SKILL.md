---
name: service-layer
description: Use when business logic leaks into controllers or handlers, services contain both orchestration and domain decisions, the boundary between use-case coordination and domain rules is unclear, or domain objects have no behaviour. Apply before designing or reviewing any service class. Covers Application Service, Domain Service, and Service Layer — with explicit rules for what belongs where.
---

# Service Layer Patterns

*Sources: Martin Fowler — PoEAA (2002); Eric Evans — Domain-Driven Design (2003)*

## Pain Signals — You Are in This Branch When:

- Business rules (`if order.total > 1000: apply_discount()`) live inside service classes
- Controllers or API handlers contain domain logic
- Domain objects are anemic — they hold data but all behaviour is in services
- A service method does both "figure out what to do" and "do it"
- The same business rule appears in multiple service methods and drifts over time
- It is unclear whether a piece of logic belongs in a service or a domain object

## Pattern Selection

| Question | Pattern |
|----------|---------|
| Coordinating use cases — which repository, which event, which transaction? | **Application Service** |
| Logic is pure domain but doesn't fit a single entity or value object? | **Domain Service** |
| Defining the overall API boundary of the application? | **Service Layer** |

---

## Application Service

Defines the application's **use cases**. Orchestrates domain objects, repositories, and infrastructure. Contains **no domain logic** — if you find an `if` that a domain expert would recognise as a business rule, it does not belong here.

**Pain it removes**: business logic scattered in controllers and handlers; no clear place for use-case orchestration; transaction boundaries undefined.

**When to use**: coordinating multiple domain objects or aggregates; calling external services; managing transactions; publishing domain events.

```python
class OrderApplicationService:
    def __init__(
        self,
        orders: OrderRepository,
        payments: PaymentGateway,
        events: EventBus
    ):
        self._orders = orders
        self._payments = payments
        self._events = events

    def submit_order(self, command: SubmitOrderCommand) -> None:
        # Orchestration only — no business decisions here
        order = self._orders.find_by_id(command.order_id)
        if order is None:
            raise OrderNotFound(command.order_id)

        order.submit()                           # domain logic lives here
        payment = self._payments.authorize(order.total)
        order.record_payment(payment.id)         # still domain logic

        self._orders.save(order)
        self._events.publish(order.pop_events())
```

**Rules**:
- Thin — typically 5–15 lines of orchestration per method
- No `if` statements expressing business rules — those belong in domain objects
- Transaction boundary lives here: the method is the unit of work
- Named after user intent: `SubmitOrder`, `CancelSubscription`, `TransferFunds`
- Does not call another application service — use domain events for cross-use-case reactions

**Common violations**:
- `if order.total > 1000: order.apply_bulk_discount()` — business rule, belongs in `Order`
- Application service calling another application service directly (creates coupling)
- Domain objects created or mutated without going through their own methods

---

## Domain Service

Encapsulates **domain logic that does not naturally fit inside a single entity or value object** — typically logic that involves multiple aggregates or requires domain knowledge that spans objects.

**Pain it removes**: domain logic that operates across multiple objects with no natural home in any single entity, leading to it being placed in application services where it does not belong.

**When to use**: the operation is meaningful to domain experts; it involves multiple aggregates; it has no natural home in a single entity; it is stateless.

**When NOT to use**: if the logic can naturally live in an entity or value object, put it there. Domain services should be the exception.

```python
class FundsTransferService:
    """
    Domain service — 'transfer funds' spans two Account aggregates.
    Neither Account should know about the other.
    """
    def transfer(
        self,
        source: Account,
        destination: Account,
        amount: Money
    ) -> None:
        source.debit(amount)         # enforces source invariants
        destination.credit(amount)   # enforces destination invariants
        # No infrastructure here — that is the application service's responsibility
```

**Naming**: domain services are named after domain concepts and verbs, not technical operations. `FundsTransferService` not `AccountUpdateService`. `PricingService` not `PriceCalculatorHelper`.

**Stateless**: domain services hold no persistent state. If state is needed, it belongs in an entity.

---

## Service Layer (Fowler)

The application's boundary — defines the set of operations the application exposes, coordinates domain objects in response to each, and presents a coherent interface to all callers (HTTP controllers, CLI commands, message consumers, background jobs).

**Key insight**: the Service Layer is deliberately thin. It is not where logic lives — it is where the application exposes its capabilities. All logic is delegated to the domain model.

```python
class BillingService:
    def charge_subscription(self, subscription_id: str) -> ChargeResult: ...
    def cancel_subscription(self, subscription_id: str, reason: str) -> None: ...
    def update_payment_method(self, subscription_id: str, token: str) -> None: ...
    def apply_coupon(self, subscription_id: str, coupon_code: str) -> None: ...
```

**Anti-pattern — Anemic Domain Model**: when the service layer contains all logic and domain objects are pure data containers with getters and setters. This looks like OOP but is procedural code. The tell: every domain operation is a service method; domain objects have no behaviour.

---

## Design Checklist

- [ ] Application services contain orchestration only — no `if` expressions encoding business rules
- [ ] Domain logic that fits naturally in an entity lives in that entity, not extracted to a service
- [ ] Domain services are stateless and named after domain concepts
- [ ] Transaction boundary is at the application service method level
- [ ] No business logic in controllers, handlers, or CLI commands — delegated to the service layer
- [ ] Domain objects are not anemic — they have behaviour, not just getters and setters
- [ ] Application services do not call other application services directly
