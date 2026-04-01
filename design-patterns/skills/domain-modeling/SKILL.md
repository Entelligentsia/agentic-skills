---
name: domain-modeling
description: Use when business objects have no behaviour (anemic model), invariants are enforced in services or controllers instead of domain classes, ownership of business rules is unclear, or the code allows states the business forbids. Apply before designing or reviewing any business domain class. Covers DDD tactical patterns: Entity, Value Object, Aggregate, Aggregate Root.
---

# Domain Modeling Patterns

*Sources: Eric Evans — Domain-Driven Design (2003); Martin Fowler — PoEAA (2002)*

## Pain Signals — You Are in This Branch When:

- Domain objects are data bags — getters, setters, no behaviour
- Business rules live in service classes, not in domain objects
- The same invariant is enforced in multiple places and can drift
- Code allows combinations (e.g. a submitted order with no items) the business forbids
- "Which object owns this rule?" is unclear or contested
- Objects are compared by field equality when they should be compared by identity, or vice versa
- External objects hold direct references to internal members of a cluster

---

## Entity

An object defined by its **identity**, not its attributes. Two entities with the same values are still different if they have different IDs.

**When to use**: the object has a lifecycle, changes over time, and must be tracked individually.

```python
class Order:
    id: OrderId          # identity — never changes
    status: OrderStatus  # state — changes over lifecycle
    items: list[LineItem]

    def add_item(self, product: Product, quantity: int) -> None:
        # business rule enforced at mutation point
        if self.status != OrderStatus.DRAFT:
            raise InvalidOperation("Cannot add items to a submitted order")
        self._items.append(LineItem(product, quantity))
```

**Invariant rule**: state mutations go through methods that enforce business rules — never via direct field assignment from outside the class.

---

## Value Object

An object defined entirely by its **attributes**. Immutable. Equality by value. No identity.

**When to use**: the concept has no lifecycle of its own; two instances with identical values are interchangeable; the value represents a measurement, descriptor, or range.

```python
class Money:
    def __init__(self, amount: Decimal, currency: Currency):
        if amount < 0:
            raise ValueError("Amount cannot be negative")
        self._amount = amount
        self._currency = currency

    def add(self, other: 'Money') -> 'Money':
        if self._currency != other._currency:
            raise CurrencyMismatch()
        return Money(self._amount + other._amount, self._currency)
        # returns NEW instance — never mutates self

    def __eq__(self, other):
        return self._amount == other._amount and self._currency == other._currency
```

**Common violation**: adding an `id` field to a value object. If it needs an ID, it is an Entity.

**When NOT to use**: when you need to track the object through changes across transactions. Use an Entity instead.

---

## Aggregate

A **cluster of domain objects** (Entities and Value Objects) treated as a single unit for the purpose of data changes. Has exactly one **Aggregate Root**.

**Consistency boundary**: all invariants that span multiple objects within the cluster are enforced inside the aggregate. No invariant should span two aggregates — that requires eventual consistency via Domain Events.

```python
class Order:               # Aggregate Root
    id: OrderId
    items: list[LineItem]  # internal — part of aggregate
    total: Money           # value object — part of aggregate

    def submit(self) -> None:
        if not self._items:
            raise EmptyOrderError("Cannot submit an order with no items")
        if self._total > self._customer.credit_limit:
            raise CreditLimitExceeded()
        self._status = OrderStatus.SUBMITTED
        self._record_event(OrderSubmitted(self.id))
```

**Rules**:
- External objects hold references only to the **root**, never to internal members
- All changes to the aggregate go through the root — never bypass it
- One repository per aggregate root (not one per table or per internal entity)
- Keep aggregates small — the consistency boundary, not the object graph

**Sizing heuristic**: if two things must always be consistent within a single transaction, they belong in the same aggregate. If eventual consistency is acceptable, split them — smaller aggregates have less contention.

---

## Aggregate Root

The single Entity in an aggregate that **external objects are permitted to reference**. Controls all access to the aggregate's internals.

**Common violations to catch in review**:
- Direct references to internal entities from outside the aggregate (e.g. `lineItem.discount = ...` from a service)
- A repository for a non-root entity (`LineItemRepository` when `LineItem` is internal to `Order`)
- Bypassing the root to mutate an internal entity
- Aggregate root loading the entire object graph eagerly regardless of what is needed

---

## Design Checklist

- [ ] Every Entity has a stable, domain-meaningful ID
- [ ] Value Objects are immutable — methods return new instances, never mutate
- [ ] Value Objects compared by value equality, not reference
- [ ] Aggregates enforce all internal invariants through the root
- [ ] No cross-aggregate object references — only references by ID
- [ ] Aggregates are sized by consistency requirements, not by relationship graph
- [ ] Business rules live in domain methods — not in services, controllers, or handlers
- [ ] No anemic domain objects (data bags with no behaviour)
