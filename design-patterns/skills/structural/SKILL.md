---
name: structural
description: Use when the pain is about how objects fit together — incompatible interfaces, subsystems too complex to use correctly, needing to add behaviour without subclassing, controlling access, or managing hierarchical structures. Apply when external types bleed into domain code, composition is hard to manage, or a subsystem requires too many steps in the right order. Covers all 7 GoF structural patterns.
---

# Structural Patterns

*Source: Gang of Four — Design Patterns (1994)*

## Pain Signals — You Are in This Branch When:

- External library or API types appear directly in domain or business logic
- A subsystem has a complex multi-step call sequence that callers frequently get wrong
- You need combinations of behaviours (logging + caching + retry) but subclassing every combo is impractical
- Access to an object needs to be deferred, controlled, or instrumented without changing the caller
- A domain naturally forms a hierarchy where leaves and containers need identical treatment
- Many objects duplicate the same large chunk of read-only data, causing memory pressure
- Two independent dimensions of variation are creating a matrix of subclasses

## Pattern Selection

| Question | Pattern |
|----------|---------|
| Bridging two incompatible interfaces? | **Adapter** |
| Subsystem too complex or sequential to use safely? | **Facade** |
| Need optional, combinable behaviours without subclass explosion? | **Decorator** |
| Need lazy loading, access control, caching, or remoting behind an interface? | **Proxy** |
| Hierarchy where leaves and containers are treated uniformly? | **Composite** |
| Many objects sharing large read-only data at memory cost? | **Flyweight** |
| Two independent variation dimensions creating a subclass matrix? | **Bridge** |

---

## Adapter

Converts the interface of one class into another that clients expect. Makes incompatible interfaces work together.

**Pain it removes**: existing code with a useful interface that does not match what the rest of the system expects — especially third-party libraries or legacy components you cannot modify.

**When to use**: integrating external dependencies without letting their interface shape leak into your domain; migrating from one library to another behind a stable internal interface.

```python
# What your domain expects
class PaymentProcessor:
    def process(self, amount: Money, card: Card) -> PaymentResult: ...

# What the provider offers
class StripeClient:
    def execute_payment(self, card_info: dict, transaction_amount: int) -> dict: ...

# Adapter — bridges the gap
class StripeAdapter(PaymentProcessor):
    def __init__(self, stripe: StripeClient):
        self._stripe = stripe

    def process(self, amount: Money, card: Card) -> PaymentResult:
        response = self._stripe.execute_payment(
            card_info=card.to_stripe_format(),
            transaction_amount=amount.in_cents()
        )
        return PaymentResult.from_stripe(response)
```

**Rule**: keep adapters focused on translation only. When an adapter starts containing business rules, extract those rules into a separate component — the adapter should stay a thin translation layer.

**When NOT to use**: when you control both interfaces and can simply change one of them. Adapter adds indirection — only worth it when the adaptee cannot be modified.

---

## Facade

Provides a simplified, single-entry-point interface to a complex subsystem. Reduces the chance that callers invoke steps incorrectly or in the wrong order.

**Pain it removes**: callers needing to know the internal step sequence of a subsystem to use it correctly — knowledge that spreads and drifts across the codebase.

**When to use**: a workflow involves multiple subsystem components that must be coordinated in a specific order; you want to make the common case simple while keeping the subsystem accessible for advanced cases.

```python
class VideoConversionFacade:
    def convert(self, file_path: str, target_format: str) -> str:
        probe = self._prober.probe(file_path)
        transcoded = self._transcoder.transcode(probe, target_format)
        metadata = self._metadata_extractor.extract(transcoded)
        url = self._uploader.upload(transcoded, metadata)
        self._cleaner.cleanup(transcoded)
        return url
```

**Important**: Facade does not lock callers out of the subsystem. It provides a convenient shortcut for the common path — callers that need fine-grained control can still use the subsystem directly.

**When NOT to use**: when the subsystem has only one or two steps and direct use is already clear.

---

## Decorator

Adds behaviour to individual objects dynamically, without affecting other objects of the same class and without subclassing.

**Pain it removes**: needing combinations of behaviours (logging + caching + encryption) that would require a subclass for every combination if done via inheritance.

**When to use**: cross-cutting concerns (logging, caching, retry, rate limiting, validation) that should be composable independently; wrapping objects to add behaviour at runtime.

```python
class DataStore:
    def fetch(self, key: str) -> bytes: ...
    def store(self, key: str, data: bytes) -> None: ...

class CachingDecorator(DataStore):
    def __init__(self, inner: DataStore, cache: Cache):
        self._inner = inner
        self._cache = cache

    def fetch(self, key: str) -> bytes:
        hit = self._cache.get(key)
        if hit is not None:
            return hit
        data = self._inner.fetch(key)
        self._cache.set(key, data)
        return data

    def store(self, key: str, data: bytes) -> None:
        self._cache.invalidate(key)
        self._inner.store(key, data)

class LoggingDecorator(DataStore):
    def __init__(self, inner: DataStore, logger: Logger):
        self._inner = inner
        self._logger = logger

    def fetch(self, key: str) -> bytes:
        self._logger.debug(f"fetch {key}")
        return self._inner.fetch(key)

    def store(self, key: str, data: bytes) -> None:
        self._logger.debug(f"store {key} ({len(data)} bytes)")
        self._inner.store(key, data)

# Compose decorators freely
store = LoggingDecorator(
    CachingDecorator(S3DataStore(bucket), RedisCache()),
    logger
)
```

**Rules**: each decorator implements the same interface as the component it wraps; each decorator has exactly one added concern; order matters — document the expected stacking order.

**When NOT to use**: when the behaviour applies uniformly to all instances (add it to the base class); when decorator ordering creates hard-to-reason-about interactions.

**Distinction from Proxy**: Decorator adds domain or cross-cutting behaviour. Proxy controls access or adds infrastructure concerns (lazy load, auth, remoting) — the intent differs even if the structure looks similar.

---

## Proxy

Controls access to another object. The proxy and the real object share the same interface; the proxy decides whether, when, and how to forward calls.

**Pain it removes**: needing to add access control, lazy initialisation, caching, instrumentation, or location transparency to an object without changing the caller or the real object.

**Common proxy types**:

| Type | Use case |
|------|----------|
| **Virtual** | Lazy initialisation — defer expensive creation until first use |
| **Protection** | Access control — only forward if caller has permission |
| **Caching** | Return cached result without calling the real object |
| **Remote** | Hide that the object is on another machine |
| **Logging/Monitoring** | Record calls transparently for observability |

```python
# Protection proxy — tenant isolation
class SecureOrderRepository(OrderRepository):
    def __init__(self, inner: OrderRepository, auth: AuthContext):
        self._inner = inner
        self._auth = auth

    def find_by_id(self, id: OrderId) -> Optional[Order]:
        order = self._inner.find_by_id(id)
        if order and order.tenant_id != self._auth.tenant_id:
            raise AccessDenied(f"Order {id} not accessible")
        return order

    def save(self, order: Order) -> None:
        if not self._auth.has_permission('orders.write'):
            raise AccessDenied("Insufficient permissions")
        self._inner.save(order)
```

**When NOT to use**: when a simple conditional inside the real object is clearer; when the added indirection obscures more than it clarifies.

---

## Composite

Composes objects into tree structures to represent part-whole hierarchies. Lets clients treat individual objects and compositions of objects uniformly.

**Pain it removes**: callers needing to distinguish between leaf nodes and container nodes when traversing or operating on a hierarchy — leading to `isinstance` checks and branching everywhere.

**When to use**: the domain naturally forms a hierarchy (file system, UI component tree, organisational chart, order with line items and bundles, expression tree); you want to apply operations uniformly across the whole structure.

```python
class FileSystemNode:
    def size(self) -> int: ...
    def name(self) -> str: ...

class File(FileSystemNode):
    def size(self) -> int:
        return self._bytes

class Directory(FileSystemNode):
    def __init__(self, name: str):
        self._name = name
        self._children: list[FileSystemNode] = []

    def add(self, node: FileSystemNode) -> None:
        self._children.append(node)

    def size(self) -> int:
        return sum(child.size() for child in self._children)

# Client calls size() on any node — doesn't know if it's a file or directory
root = Directory("root")
root.add(File("readme.txt", 1024))
docs = Directory("docs")
docs.add(File("spec.pdf", 204800))
root.add(docs)
print(root.size())  # works uniformly
```

**When NOT to use**: when the hierarchy is shallow or simple and distinguishing leaves from containers is not a real burden; when the uniformity breaks down (leaves and containers need very different operations).

---

## Flyweight

Shares common state among many fine-grained objects to reduce memory consumption.

**Pain it removes**: large numbers of objects duplicating identical intrinsic data, causing memory pressure.

**When to use**: you have a very large number of objects that share most of their state; the shared (intrinsic) state can be cleanly separated from the unique (extrinsic) state; editors, renderers, particle systems, large in-memory caches.

```python
class CharacterFormat:
    """Flyweight — shared intrinsic state."""
    def __init__(self, font: str, size: int, bold: bool, colour: str):
        self.font = font
        self.size = size
        self.bold = bold
        self.colour = colour

class FormatFactory:
    _cache: dict[tuple, CharacterFormat] = {}

    @classmethod
    def get(cls, font: str, size: int, bold: bool, colour: str) -> CharacterFormat:
        key = (font, size, bold, colour)
        if key not in cls._cache:
            cls._cache[key] = CharacterFormat(font, size, bold, colour)
        return cls._cache[key]

class Character:
    """Extrinsic state — unique per character."""
    def __init__(self, char: str, position: int, format: CharacterFormat):
        self.char = char
        self.position = position
        self.format = format  # shared — points to flyweight
```

**When NOT to use**: when the number of objects is small and memory is not a concern; when separating intrinsic and extrinsic state makes the code significantly harder to understand.

---

## Bridge

Decouples an abstraction from its implementation so that the two can vary independently.

**Pain it removes**: two independent dimensions of variation creating a combinatorial subclass explosion (e.g. `WindowsCircle`, `LinuxCircle`, `WindowsSquare`, `LinuxSquare`).

**When to use**: you have two orthogonal dimensions that vary independently; you want to switch implementations at runtime; you want to extend both dimensions without multiplying subclasses.

```python
# Implementation interface
class Device:
    def is_enabled(self) -> bool: ...
    def enable(self) -> None: ...
    def disable(self) -> None: ...
    def get_volume(self) -> int: ...
    def set_volume(self, volume: int) -> None: ...

class TV(Device): ...
class Radio(Device): ...

# Abstraction — works with any Device implementation
class RemoteControl:
    def __init__(self, device: Device):
        self._device = device

    def toggle_power(self) -> None:
        if self._device.is_enabled():
            self._device.disable()
        else:
            self._device.enable()

class AdvancedRemote(RemoteControl):
    def mute(self) -> None:
        self._device.set_volume(0)

# Both dimensions vary independently — no matrix of subclasses
tv_remote = AdvancedRemote(TV())
radio_remote = RemoteControl(Radio())
```

**When NOT to use**: when there is only one implementation now and no realistic second dimension; when the abstraction and implementation are unlikely to vary independently. Bridge adds indirection — the cost must be worth it.

---

## Design Checklist

- [ ] Adapter used only when the adaptee cannot be modified; contains translation only — no business rules
- [ ] Facade covers the common path; does not prevent advanced callers from accessing the subsystem directly
- [ ] Each Decorator implements the same interface as its wrapped component
- [ ] Each Decorator has exactly one added concern; stacking order is documented
- [ ] Proxy type is named and documented (virtual / protection / caching / remote / monitoring)
- [ ] Composite used only when leaves and containers genuinely need uniform treatment
- [ ] Flyweight intrinsic/extrinsic state separation is clearly documented
- [ ] Bridge introduced only when two genuine independent variation dimensions exist
