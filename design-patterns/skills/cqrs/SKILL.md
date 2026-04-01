---
name: cqrs
description: Use when read and write performance requirements diverge significantly, complex reporting is painful through the domain model, or you need to scale reads and writes independently. Apply before splitting any command/query handler or building read-optimised projections. Covers Command Query Responsibility Segregation — including when it is overkill — with guidance on applying only as much separation as the problem demands.
---

# CQRS — Command Query Responsibility Segregation

*Sources: Greg Young (2010); Martin Fowler — bliki/CQRS; Vaughn Vernon — Implementing DDD (2013)*

## Pain Signals — You Are in This Branch When:

- Read queries are slow because the domain model's shape is optimised for writes, not reads
- Complex reporting requires loading and traversing large object graphs just to flatten them for display
- Read and write load profiles are very different and need to scale independently
- The domain model is rich and correct for writes but awkward to query from
- Event sourcing is in use and projections are needed for efficient reads

**Before applying CQRS, confirm the pain exists.** Fowler's warning: "CQRS is a significant mental leap for all concerned, so shouldn't be tackled unless the benefit is worth that leap."

---

## Core Principle

**Commands** change state and return nothing (or minimal acknowledgement).
**Queries** read state and change nothing — calling a query twice returns the same result given no intervening commands.

These two concerns have fundamentally different requirements. Optimise them separately.

---

## The Spectrum — Apply Only What the Problem Demands

```
Minimal                  Moderate                    Full
────────────────────────────────────────────────────────────
Single model             Separate handlers           Separate models
Same DB                  Same DB                     Separate DBs
No projections           Direct DB reads             Event-driven projections
                         in query handlers           Read stores
```

**Most systems need at most the moderate level.** Full CQRS with separate read/write stores and event-sourced projections is a significant commitment — justified only in specific circumstances.

---

## Commands

A command is an **intent to change state**. It may be rejected. It returns nothing meaningful on success (or just an ID if a resource was created).

```python
# Command — named in imperative form
@dataclass
class SubmitOrderCommand:
    order_id: OrderId
    submitted_by: UserId

class SubmitOrderHandler:
    def handle(self, cmd: SubmitOrderCommand) -> None:
        # Validate first — reject invalid commands before touching the domain
        order = self._orders.find_by_id(cmd.order_id)
        if order is None:
            raise OrderNotFound(cmd.order_id)

        order.submit()               # domain logic enforced in the aggregate
        self._orders.save(order)
        self._events.publish(order.pop_events())
```

**Rules**:
- Commands are validated before execution — reject clearly invalid commands with a descriptive error
- One handler per command type
- Handler is thin orchestration — domain logic stays in domain objects
- Commands do not return domain objects — fire-and-react, not fire-and-inspect

---

## Queries

A query **reads and returns data**. It has no side effects. It does not need to go through the domain model.

```python
# Query — named after what it returns
@dataclass
class GetOrderSummaryQuery:
    order_id: OrderId

class GetOrderSummaryHandler:
    def handle(self, query: GetOrderSummaryQuery) -> OrderSummaryDto:
        # Can read directly from DB — no domain model required
        row = self._db.query_one("""
            SELECT id, status, customer_name, total_cents, item_count, submitted_at
            FROM order_summaries
            WHERE id = %s
        """, (str(query.order_id),))
        if row is None:
            raise OrderNotFound(query.order_id)
        return OrderSummaryDto(**row)
```

**Key insight**: queries bypass the domain model entirely. They read from the database (or a read-optimised projection) directly. This is where significant performance gains come from — no object graph loading, no mapping overhead.

---

## Read Models (Projections)

In full CQRS, the read side maintains **denormalised views** built by consuming domain events. These are optimised for specific query shapes.

```python
class OrderSummaryProjection:
    """Keeps the read model up to date by consuming domain events."""

    def on_order_submitted(self, event: OrderSubmitted) -> None:
        self._read_db.upsert('order_summaries', {
            'id': str(event.order_id),
            'status': 'submitted',
            'customer_id': str(event.customer_id),
            'total_cents': event.total.in_cents(),
            'item_count': event.item_count,
            'submitted_at': event.submitted_at.isoformat()
        })

    def on_order_shipped(self, event: OrderShipped) -> None:
        self._read_db.update('order_summaries',
            where={'id': str(event.order_id)},
            values={'status': 'shipped', 'shipped_at': event.shipped_at.isoformat()}
        )
```

**Trade-off**: read models are **eventually consistent** with the write side. The lag is typically milliseconds to seconds but must be explicitly acceptable to the business for every use case.

---

## When CQRS Is Warranted

- Read and write performance requirements diverge significantly (heavy reads, complex writes)
- Complex reporting requirements are painful or slow through the normalised domain model
- Event sourcing is already in use (CQRS pairs naturally — the event log is the write side)
- Read and write workloads need to scale on different infrastructure
- Multiple specialised read models serve different query shapes from the same write model

## When CQRS Is Overkill

- Simple CRUD with little domain logic
- Small team where the cognitive overhead outweighs the benefit
- Strong read consistency is required everywhere — eventual read models do not satisfy the requirement
- Early in the project before read/write patterns are understood
- The application is read-heavy with simple writes — a single indexed query model is sufficient

---

## Design Checklist

- [ ] Commands named in imperative form; queries named after what they return
- [ ] Commands return nothing (or just an ID) — never domain objects
- [ ] Queries have no side effects — safe to call repeatedly
- [ ] Query handlers read directly, bypassing domain model where appropriate
- [ ] Read models are explicitly documented as eventually consistent, with acceptable lag confirmed
- [ ] Full CQRS with separate stores adopted only where trade-offs are consciously accepted
- [ ] Command validation happens before the handler executes domain logic
- [ ] The level of CQRS separation matches the actual problem — not applied speculatively
