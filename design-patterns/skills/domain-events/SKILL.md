---
name: domain-events
description: Use when aggregates need to stay loosely coupled, side effects (emails, audit logs, projections) are tangled into domain operations, or one aggregate directly calls methods on another. Apply when something significant happens in the domain that other parts of the system need to react to without being tightly coupled. Covers Domain Events, publishing patterns, synchronous vs asynchronous handling, idempotency, and eventual consistency trade-offs.
---

# Domain Events Pattern

*Sources: Eric Evans — Domain-Driven Design (2003); Vaughn Vernon — Implementing DDD (2013)*

## Pain Signals — You Are in This Branch When:

- An aggregate directly calls a method on another aggregate after saving
- Side effects (send email, update inventory, log audit trail) are called directly inside domain methods
- Adding a new reaction to a domain operation requires modifying the operation itself
- A business transaction spans two aggregates that must stay consistent
- Tests of a domain operation fail because a side-effect dependency is missing
- The same domain operation triggers a growing list of unrelated follow-on actions

---

## Core Principle

A **Domain Event** represents something that happened in the domain that domain experts care about. It is a fact — immutable, past tense, cannot be rejected. Other parts of the system react to it; they do not modify it.

**Events vs Commands**:

| | Event | Command |
|--|-------|---------|
| **Tense** | Past — `OrderSubmitted` | Imperative — `SubmitOrder` |
| **Intent** | Announces a fact | Requests an action |
| **Can be rejected?** | No — already happened | Yes |
| **Consumers** | Many (broadcast) | One (targeted) |

---

## Defining a Domain Event

Events are **value objects** — immutable, no identity, equality by value. They carry exactly what happened and enough data for consumers to react without querying back.

```python
@dataclass(frozen=True)
class OrderSubmitted:
    order_id: OrderId
    customer_id: CustomerId
    total: Money
    item_count: int
    submitted_at: datetime
    # Enrich at creation time — consumers should not need to query back
```

**Naming rules**:
- Past tense: `OrderSubmitted`, `PaymentFailed`, `SubscriptionRenewed`
- Named after the business fact, not the technical operation
- Avoid: `OrderUpdated`, `RecordSaved`, `DataChanged` — too generic to be meaningful

**Include enough data**: a consumer should be able to react using only what is in the event. If consumers routinely query back for more information, the event is under-specified.

---

## Raising Events from Aggregates

Aggregates record events internally. The application service publishes them **after saving** — never before.

```python
class Order:
    def __init__(self):
        self._events: list[DomainEvent] = []

    def submit(self) -> None:
        if not self._items:
            raise EmptyOrderError()
        self._status = OrderStatus.SUBMITTED
        self._events.append(OrderSubmitted(
            order_id=self.id,
            customer_id=self._customer_id,
            total=self._total,
            item_count=len(self._items),
            submitted_at=datetime.utcnow()
        ))

    def pop_events(self) -> list[DomainEvent]:
        events, self._events = self._events, []
        return events

class OrderApplicationService:
    def submit_order(self, command: SubmitOrderCommand) -> None:
        order = self._orders.find_by_id(command.order_id)
        order.submit()
        self._orders.save(order)               # persist first
        self._events.publish(order.pop_events()) # then publish
```

**Save before publish**: always persist the aggregate before publishing events. Publishing first risks announcing a state that was never durably saved.

---

## Synchronous vs Asynchronous Handling

### Synchronous (same transaction)

Handler executes within the same transaction as the originating operation. Use when the reaction **must succeed or fail atomically** with the originator.

```
OrderSubmitted → reserve inventory  (must be atomic — same transaction)
```

**Risk**: slow or failing handlers block the originating operation and can cause transaction timeouts.

### Asynchronous (eventual consistency)

Events are published to a message bus; handlers run in separate transactions. Use when a delay in the reaction is **acceptable to the business**.

```
OrderSubmitted → send confirmation email    (delay is fine)
OrderSubmitted → update analytics dashboard (eventual is acceptable)
```

**Trade-off**: consumers may see stale state; events may be delivered more than once. Handlers must be designed for this.

---

## Idempotency

Asynchronous event handlers **must be idempotent** — processing the same event twice produces the same result as processing it once.

```python
class SendOrderConfirmationHandler:
    def handle(self, event: OrderSubmitted) -> None:
        if self._emails.already_sent_for(event.order_id):
            return  # idempotent guard — safe to process duplicate
        self._emails.send_confirmation(
            to=event.customer_id,
            order_id=event.order_id,
            total=event.total
        )
        self._emails.mark_sent(event.order_id)
```

---

## Transactional Outbox (reliable publishing)

Publishing to a message bus after saving introduces a window where the save succeeds but the publish fails. The Outbox pattern closes this gap.

```python
class OrderApplicationService:
    def submit_order(self, command: SubmitOrderCommand) -> None:
        with self._unit_of_work as uow:
            order = uow.orders.find_by_id(command.order_id)
            order.submit()
            uow.orders.save(order)
            # Write events to outbox in the same transaction as the aggregate
            uow.outbox.store(order.pop_events())
            uow.commit()
        # A separate process reads and publishes from the outbox reliably
```

---

## When to Use Domain Events

**Use when**:
- Two aggregates need to stay eventually consistent — one changes, the other reacts
- A side effect (email, audit, notification, projection) should happen after a domain operation
- You want to decouple producers from consumers across bounded contexts
- The reaction is likely to grow over time (new consumers should not require modifying the domain)

**When NOT to use**:
- As a substitute for a direct method call within the same aggregate
- When strong consistency is required everywhere and eventual consistency is not acceptable to the business
- As a generic internal pub/sub mechanism for non-domain concerns

---

## Design Checklist

- [ ] Events are named in past tense and represent meaningful business facts
- [ ] Events are immutable and carry sufficient data for consumers to react without querying back
- [ ] Aggregate saves before publishing events — never publish first
- [ ] Asynchronous handlers are idempotent
- [ ] Eventual consistency trade-offs are explicitly documented per event
- [ ] Side effects removed from domain methods — triggered by events instead
- [ ] Cross-aggregate consistency uses events, not direct aggregate-to-aggregate calls
