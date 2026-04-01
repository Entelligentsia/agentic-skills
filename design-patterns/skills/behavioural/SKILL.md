---
name: behavioural
description: Use when behaviour varies across cases, accumulates conditionals, or needs to be decoupled, queued, undone, or observed. Apply when a method is growing if/switch branches, an algorithm differs per context, a pipeline needs flexible steps, or objects need to react to each other without tight coupling. Covers all 10 GoF behavioural patterns.
---

# Behavioural Patterns

*Source: Gang of Four — Design Patterns (1994)*

## Pain Signals — You Are in This Branch When:

- A method keeps growing `if`/`switch` branches for each new case or plan
- The same algorithm is implemented differently in multiple places
- A pipeline of steps needs to be reordered, skipped, or extended without touching the core
- An object behaves completely differently depending on what state it is in
- Multiple objects need to react when one changes, but coupling them directly is fragile
- Actions need to be deferred, logged, retried, or undone
- You need to add new operations to a stable structure without modifying it

---

## Chain of Responsibility

Passes a request through a sequence of handlers. Each handler decides to process it, stop it, or pass it forward.

**Pain it removes**: a single method accumulating all validation and processing steps; steps that need to be reordered or inserted without changing the core.

**When to use**: middleware pipelines, request validation sequences, approval workflows where each level may approve or escalate.

```ruby
class Handler
  def initialize(next_handler = nil)
    @next = next_handler
  end

  def call(request)
    return unless handle?(request)
    @next&.call(request)
  end
end

class RateLimitHandler < Handler
  def handle?(request)
    return true if within_limit?(request)
    request.halt(429, "Too Many Requests")
    false
  end
end

class AuthHandler < Handler
  def handle?(request)
    return true if authenticated?(request)
    request.halt(401, "Unauthorized")
    false
  end
end

# Compose the chain
pipeline = RateLimitHandler.new(AuthHandler.new(RequestHandler.new))
pipeline.call(request)
```

**When NOT to use**: when steps always execute in sequence with no possibility of stopping (use a plain sequence of method calls instead).

**Health check**: each handler has one responsibility and a clear stop/continue contract. Breaks down when handlers mutate shared state or depend on each other's internals.

---

## Command

Encapsulates a request as an object, decoupling the sender from the receiver and enabling queuing, logging, retry, and undo.

**Pain it removes**: actions that need to be deferred, retried, audited, or undone cannot be done with direct method calls.

**When to use**: job queues, undo/redo stacks, audit logs, "run later" workflows, transactional outbox pattern.

```python
class SaveDocumentCommand:
    def __init__(self, document_id: str, content: str):
        self.document_id = document_id
        self.content = content

    def execute(self, service: DocumentService) -> None:
        service.save(self.document_id, self.content)

    def undo(self, service: DocumentService) -> None:
        service.restore_previous(self.document_id)

# Commands are objects — can be queued, serialized, retried
queue.push(SaveDocumentCommand(doc_id, content))
```

**When NOT to use**: when the operation is simple and immediate with no need for queuing, retry, or undo.

**Distinction from Strategy**: Command is an action (something that happened or will happen). Strategy is an algorithm (a way of doing something).

---

## Strategy

Defines a family of interchangeable algorithms behind a common interface. The caller selects the algorithm; switching algorithms does not change the caller.

**Pain it removes**: `if plan == 'X': do_this() elif plan == 'Y': do_that()` — branching that grows with each new variant and duplicates test setup.

**When to use**: payment providers, export formats, routing algorithms, rate limiting policies, notification channels, pricing rules per customer tier.

```python
class NotificationChannel:
    def send(self, user: User, message: str) -> None:
        raise NotImplementedError

class EmailChannel(NotificationChannel):
    def send(self, user: User, message: str) -> None:
        self._smtp.send(user.email, message)

class SmsChannel(NotificationChannel):
    def send(self, user: User, message: str) -> None:
        self._twilio.send(user.phone, message)

class NotificationService:
    def __init__(self, channel: NotificationChannel):
        self._channel = channel  # injected — caller stays stable

    def notify(self, user: User, message: str) -> None:
        self._channel.send(user, message)
```

**When NOT to use**: when there is only one algorithm now and no real expectation of variation. Premature Strategy adds indirection for no gain.

**Signal it's working**: adding a new variant requires adding one class and updating the selector — nothing else changes.

---

## State

Allows an object to alter its behaviour when its internal state changes. The object appears to change its class.

**Pain it removes**: methods full of `if self.status == 'draft': ... elif self.status == 'submitted': ...` that multiply with every new state.

**When to use**: objects with well-defined modes and transitions — order lifecycle, connection states, approval workflows, subscription status, document editing modes.

```python
class Order:
    def __init__(self):
        self._state = DraftState(self)

    def submit(self):
        self._state.submit()

    def cancel(self):
        self._state.cancel()

    def transition_to(self, state: OrderState):
        self._state = state

class DraftState:
    def submit(self):
        self.order.transition_to(SubmittedState(self.order))

    def cancel(self):
        self.order.transition_to(CancelledState(self.order))

class SubmittedState:
    def submit(self):
        raise InvalidTransition("Already submitted")

    def cancel(self):
        self.order.transition_to(CancelledState(self.order))
```

**When NOT to use**: when transitions are simple and few — a field and a conditional is clearer than a full State implementation.

**Distinction from Strategy**: Strategy is selected by the caller and held stable. State transitions itself based on internal rules.

---

## Observer

Defines a one-to-many dependency so that when one object changes state, all dependents are notified automatically.

**Pain it removes**: the subject needing to know about and directly call every interested party — tight coupling that makes adding subscribers painful.

**When to use**: event-driven UI updates, domain event notification, logging/metrics hooks, cache invalidation on data change.

```python
class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable) -> None:
        self._subscribers.setdefault(event_type, []).append(handler)

    def publish(self, event_type: str, event: Any) -> None:
        for handler in self._subscribers.get(event_type, []):
            handler(event)

# Subject publishes; observers subscribe — no direct coupling
bus.subscribe('order.submitted', send_confirmation_email)
bus.subscribe('order.submitted', reserve_inventory)
bus.subscribe('order.submitted', update_analytics)
```

**When NOT to use**: when the reaction is always the same single operation (just call it directly). Observer hides control flow — keep subscribers visible and documented.

**Risk**: surprising side effects from hidden observers. Every subscriber must be documented; avoid observers that trigger further observers.

---

## Memento

Captures and externalises an object's internal state so it can be restored later, without violating encapsulation.

**Pain it removes**: implementing undo/rollback requires exposing internal state or duplicating save logic across callers.

**When to use**: undo/redo stacks, draft-vs-published versioning, rollback on failure, wizard-style multi-step forms.

```python
@dataclass(frozen=True)
class EditorMemento:
    content: str
    cursor_position: int
    # immutable snapshot — internals not exposed as mutable

class Editor:
    def save(self) -> EditorMemento:
        return EditorMemento(self._content, self._cursor)

    def restore(self, memento: EditorMemento) -> None:
        self._content = memento.content
        self._cursor = memento.cursor_position

class History:
    def __init__(self):
        self._stack: list[EditorMemento] = []

    def push(self, memento: EditorMemento) -> None:
        self._stack.append(memento)

    def pop(self) -> EditorMemento:
        return self._stack.pop()
```

**When NOT to use**: when state is large and snapshots are expensive — consider event sourcing (record deltas, not full snapshots) instead.

---

## Mediator

Defines an object that encapsulates how a set of objects interact, promoting loose coupling by preventing direct references between them.

**Pain it removes**: objects that know too much about each other — changing one requires changing several others because they call each other directly.

**When to use**: complex UI coordination (form fields affecting each other's state), workflow orchestration across multiple components, chat systems, air traffic control-style coordination.

```python
class FormMediator:
    def __init__(self, country_field, region_field, postal_field):
        self._country = country_field
        self._region = region_field
        self._postal = postal_field

    def on_country_changed(self, country: str) -> None:
        self._region.load_options_for(country)
        self._postal.set_format_for(country)
        self._region.clear()
        self._postal.clear()
```

**When NOT to use**: when the coordination logic is simple. Mediator risks becoming a "god object" — keep its responsibilities narrow and well-defined.

---

## Visitor

Lets you add new operations to an object structure without modifying the classes in that structure.

**Pain it removes**: needing to add new operations to a stable hierarchy without modifying every class in it — the classic problem with ASTs, document structures, and expression trees.

**When to use**: the object structure is stable (rarely gains new types) but operations on it change frequently; compiler passes, document export, tax calculation over an order structure.

```python
class OrderVisitor:
    def visit_line_item(self, item: LineItem) -> None: ...
    def visit_discount(self, discount: Discount) -> None: ...
    def visit_shipping(self, shipping: Shipping) -> None: ...

class TaxCalculatorVisitor(OrderVisitor):
    def __init__(self):
        self.total_tax = Money.zero()

    def visit_line_item(self, item: LineItem) -> None:
        self.total_tax += item.price * item.tax_rate

    def visit_discount(self, discount: Discount) -> None:
        pass  # discounts don't affect tax base in this jurisdiction

class OrderElement:
    def accept(self, visitor: OrderVisitor) -> None:
        raise NotImplementedError
```

**When NOT to use**: when the structure changes frequently (adding new element types requires updating every visitor). In application code, Strategy or Chain of Responsibility are usually simpler.

---

## Iterator

Provides a way to sequentially access elements of a collection without exposing its underlying representation.

**Pain it removes**: callers needing to know the internal structure of a collection to traverse it; multiple traversal strategies for the same structure.

**When to use**: custom collections with non-trivial traversal (trees, graphs, paginated remote results, lazy-loaded sequences).

```python
class PaginatedResultIterator:
    def __init__(self, fetch_page: Callable, page_size: int = 50):
        self._fetch = fetch_page
        self._page_size = page_size
        self._page = 0
        self._buffer = []
        self._exhausted = False

    def __iter__(self):
        return self

    def __next__(self):
        if not self._buffer:
            if self._exhausted:
                raise StopIteration
            results = self._fetch(page=self._page, size=self._page_size)
            self._page += 1
            if len(results) < self._page_size:
                self._exhausted = True
            self._buffer = results
        if not self._buffer:
            raise StopIteration
        return self._buffer.pop(0)
```

**When NOT to use**: when the language's built-in iteration primitives (list, generator, stream) already solve the problem. Only build a custom iterator when the traversal logic is genuinely non-trivial.

---

## Template Method

Defines the skeleton of an algorithm in a base class, deferring some steps to subclasses. Subclasses can override specific steps without changing the overall structure.

**Pain it removes**: the same algorithm structure repeated in multiple subclasses with only a few steps varying — duplication that diverges over time.

**When to use**: report generation pipelines, data import/export workflows, test setup/teardown patterns, HTTP request lifecycle hooks.

```python
class DataImporter:
    def run(self) -> ImportResult:
        """Template method — skeleton is fixed, steps are overridden."""
        raw = self.fetch()
        validated = self.validate(raw)
        transformed = self.transform(validated)
        return self.persist(transformed)

    def fetch(self) -> RawData:
        raise NotImplementedError

    def validate(self, raw: RawData) -> ValidatedData:
        # Default: pass through — subclasses override if needed
        return ValidatedData(raw)

    def transform(self, data: ValidatedData) -> DomainObjects:
        raise NotImplementedError

    def persist(self, objects: DomainObjects) -> ImportResult:
        raise NotImplementedError

class CsvOrderImporter(DataImporter):
    def fetch(self) -> RawData:
        return self._csv_reader.read(self._file_path)

    def transform(self, data: ValidatedData) -> DomainObjects:
        return [Order.from_csv_row(row) for row in data.rows]
```

**When NOT to use**: when the variation is better expressed as a Strategy (composition) than subclassing (inheritance). Prefer Strategy when you need to swap behaviour at runtime; use Template Method when the structure is fixed and variations are compile-time.

**Distinction from Strategy**: Template Method uses inheritance — the skeleton and steps live in a class hierarchy. Strategy uses composition — the algorithm is injected.

---

## Design Checklist

- [ ] Pattern chosen in response to a named, existing pain — not speculatively
- [ ] Chain of Responsibility: each handler has one responsibility and a clear stop/continue contract
- [ ] Command: actions are serialisable or at minimum recoverable on failure
- [ ] Strategy: adding a new variant touches only one new class and the selector
- [ ] State: all valid transitions are documented; invalid transitions raise explicitly
- [ ] Observer: all subscribers are documented; side effects are visible
- [ ] Memento: snapshots are immutable; restore does not expose internals
- [ ] Mediator: coordinator has a narrow, named responsibility — not a catch-all
- [ ] Visitor: used only when structure is stable and operations vary
- [ ] Template Method preferred only when variation is compile-time; Strategy preferred for runtime
