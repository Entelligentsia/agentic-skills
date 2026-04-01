---
name: data-access
description: Use when persistence logic bleeds into domain or business code, tests require a real database to verify business logic, ORM types appear in service or handler code, or switching storage would require touching domain classes. Apply before writing any database query, repository, or ORM integration. Covers Repository, Unit of Work, Data Mapper, and Active Record with explicit guidance on when each applies.
---

# Data Access Patterns

*Sources: Martin Fowler — PoEAA (2002); Eric Evans — Domain-Driven Design (2003)*

## Pain Signals — You Are in This Branch When:

- `db.query(...)` or ORM calls appear inside service classes, domain objects, or route handlers
- Tests that cover business logic require a live database connection to run
- ORM model instances (e.g. SQLAlchemy models, ActiveRecord objects) are passed across layer boundaries into the domain
- "Which table do I query for this?" decisions appear inside business logic
- Changing the storage backend (e.g. Postgres → DynamoDB) would require touching domain code
- The same query is written in multiple places and diverges over time

## Pattern Selection

| Context | Pattern |
|---------|---------|
| Rich domain model; domain must not know about persistence | **Repository** |
| Multiple objects change in one business transaction | **Unit of Work** |
| Domain model and schema diverge significantly | **Data Mapper** |
| Simple CRUD; thin domain logic; speed of delivery | **Active Record** |

---

## Repository

Mediates between the domain and data mapping layers using a **collection-like interface**. The domain model has no awareness of how or where objects are stored.

**Pain it removes**: persistence logic leaking into domain objects and services; inability to test domain logic without a real database; switching storage requiring domain changes.

**When to use**: meaningful domain model with DDD aggregates; need to test domain logic without infrastructure; want to swap storage backends.

**When NOT to use**: simple CRUD with no real domain logic — the abstraction costs more than it saves.

```python
# Interface — defined in the domain layer, owned by the domain
class OrderRepository:
    def find_by_id(self, id: OrderId) -> Optional[Order]: ...
    def find_pending_for_customer(self, customer_id: CustomerId) -> list[Order]: ...
    def save(self, order: Order) -> None: ...
    def remove(self, order: Order) -> None: ...

# Implementation — in the infrastructure layer
class SqlOrderRepository(OrderRepository):
    def find_by_id(self, id: OrderId) -> Optional[Order]:
        row = self._db.query(
            "SELECT * FROM orders WHERE id = %s", (str(id),)
        )
        return self._mapper.to_domain(row) if row else None

    def find_pending_for_customer(self, customer_id: CustomerId) -> list[Order]:
        rows = self._db.query(
            "SELECT * FROM orders WHERE customer_id = %s AND status = 'pending'",
            (str(customer_id),)
        )
        return [self._mapper.to_domain(row) for row in rows]
```

**Rules**:
- One repository per **aggregate root** only — not per table, not per entity inside an aggregate
- Repository interface lives in the **domain layer** — the domain defines what it needs, infrastructure satisfies it
- Returns fully reconstituted domain objects, not raw rows or ORM model instances
- Query methods express domain intent: `find_overdue_invoices()` not `find_where_due_date_lt_now_and_status_ne_paid()`

**Common violations**:
- `LineItemRepository` — LineItem is internal to Order; access it through `OrderRepository`
- Repository returning ORM instances directly to callers instead of domain objects
- Domain logic inside repository query methods
- Repository accepting raw SQL fragments as parameters

---

## Unit of Work

Maintains a list of objects affected by a business transaction and coordinates writing changes and resolving concurrency conflicts at commit time.

**Pain it removes**: multiple objects being saved piecemeal across a business operation — inconsistent state if one save succeeds and another fails.

**When to use**: a single business operation modifies multiple aggregates or entities that must all succeed or fail together.

```python
class UnitOfWork:
    def __enter__(self):
        self._transaction = self._db.begin()
        self._dirty: list = []
        return self

    def register_dirty(self, entity) -> None:
        self._dirty.append(entity)

    def commit(self) -> None:
        for entity in self._dirty:
            self._mapper.save(entity)
        self._transaction.commit()

    def __exit__(self, exc_type, *_):
        if exc_type:
            self._transaction.rollback()

# Usage
with UnitOfWork() as uow:
    order = uow.orders.find_by_id(order_id)
    order.submit()
    uow.register_dirty(order)
    uow.commit()
```

**Note**: Most modern ORMs implement Unit of Work implicitly (SQLAlchemy session, Entity Framework DbContext, Hibernate session). Understand what your ORM provides before building your own.

---

## Data Mapper

Transfers data between domain objects and the database while keeping them **completely independent** of each other. Neither the domain object nor the database schema knows about the other.

**Pain it removes**: domain model and schema that differ significantly — the domain uses a rich object graph while the schema is normalised differently; direct ORM mapping forces the domain to mirror the schema.

**When to use**: the domain model and database schema have materially different shapes; you cannot afford coupling between them.

```python
class OrderMapper:
    def to_domain(self, row: dict) -> Order:
        return Order(
            id=OrderId(row['id']),
            status=OrderStatus[row['status']],
            customer_id=CustomerId(row['customer_id']),
            items=[self._line_item_mapper.to_domain(i) for i in row['items']]
        )

    def to_row(self, order: Order) -> dict:
        return {
            'id': str(order.id),
            'status': order.status.name,
            'customer_id': str(order.customer_id),
            'items': [self._line_item_mapper.to_row(i) for i in order.items]
        }
```

---

## Active Record

A domain object that wraps a database row and includes both data access logic and domain logic in the same class.

**Pain it removes**: the ceremony of mapping layers when the domain is simple and tables map closely to objects.

**When to use**: domain logic is thin; tables map closely to objects; speed of delivery is the priority; the project is unlikely to need a rich domain model.

```python
class User(ActiveRecord):
    table = 'users'

    def deactivate(self) -> None:
        self.status = 'inactive'
        self.save()  # persistence built into the domain object
```

**Known trade-off**: domain objects become untestable without a database. Acceptable when domain logic is genuinely thin; painful when complexity grows.

**When NOT to use**: rich domain model with complex invariants; need to test domain logic in isolation; schema and domain model diverge; you are applying DDD aggregates.

---

## Design Checklist

- [ ] Repository interface defined in domain layer; implementation in infrastructure layer
- [ ] Repositories exist only for aggregate roots — not for tables or internal entities
- [ ] Query methods are named after domain concepts, not SQL operations
- [ ] No SQL, ORM types, or persistence concerns leak into domain layer code
- [ ] Transaction boundaries align with business operations — one business operation, one transaction
- [ ] Active Record only chosen when domain logic is verifiably thin
- [ ] Unit of Work used when multiple objects must change atomically
