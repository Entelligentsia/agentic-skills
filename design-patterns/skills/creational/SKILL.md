---
name: creational
description: Use when object creation is the source of pain — constructors growing too complex, the same setup repeated, unclear which concrete type to instantiate, or a shared instance causing hidden coupling. Apply before writing any factory, builder, or instantiation logic. Covers all 5 GoF creational patterns: Singleton, Builder, Factory Method, Abstract Factory, Prototype.
---

# Creational Patterns

*Source: Gang of Four — Design Patterns (1994)*

## Pain Signals — You Are in This Branch When:

- Constructors have too many parameters and valid combinations are unclear
- The same object setup sequence is repeated in multiple places
- "Which concrete class should I create here?" logic is scattered across files
- Tests require real infrastructure just to instantiate an object
- A shared instance is accessed globally and makes tests interfere with each other
- Cloning a configured object would be cheaper than rebuilding it from scratch

## Pattern Selection

| Question | Pattern |
|----------|---------|
| Truly need exactly one shared instance? | **Singleton** |
| Construction is complex or has many valid combinations? | **Builder** |
| Subclass or context decides the concrete type? | **Factory Method** |
| Need a matched family of related objects? | **Abstract Factory** |
| Cloning existing instance is cheaper than rebuilding? | **Prototype** |

---

## Singleton

Ensures a class has exactly one instance and provides a global access point to it.

**Pain it removes**: the need to coordinate access to a truly shared resource — a process-wide logger, a connection pool, a read-only configuration snapshot.

**When to use**: the object is **effectively stateless** or **safe to share** across the entire process. Examples: read-only config snapshot, process-wide logger wrapper, thread pool.

**When NOT to use**: when "easy access" is the only motivation. Singleton hides dependencies, makes tests interfere with each other, and is difficult to reset between test runs. If what you want is controlled wiring, dependency injection is almost always better.

```python
class Config:
    _instance: 'Config | None' = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load()
        return cls._instance

    def _load(self):
        self._values = load_from_environment()

    def get(self, key: str) -> str:
        return self._values[key]
```

**Risky when**: the singleton stores mutable state, request context, user sessions, or anything that must be reset between tests or requests.

**Better alternative in most cases**: pass the shared dependency explicitly via constructor injection, and let a DI container manage its lifecycle.

---

## Builder

Separates the construction of a complex object from its representation, allowing the same process to produce different valid configurations.

**Pain it removes**: constructors with many optional parameters where invalid combinations are easy to pass and hard to detect at the call site.

**When to use**: objects with many optional parameters; valid combinations that must be validated before the object is created; immutable objects that require all fields before construction; "known good" presets you want to expose without requiring callers to specify everything.

```python
# Without Builder — hard to read, easy to misuse
request = Request(url, method, headers, body, timeout, retry_count, cache_policy, auth)

# With Builder — intent is clear, validation happens at build()
request = (RequestBuilder()
    .url("https://api.example.com/orders")
    .method("POST")
    .headers(auth_headers)
    .timeout(seconds=2)
    .build())  # validates required fields and invalid combinations here
```

```python
class RequestBuilder:
    def __init__(self):
        self._url = None
        self._method = "GET"
        self._headers = {}
        self._timeout = 30

    def url(self, url: str) -> 'RequestBuilder':
        self._url = url
        return self

    def method(self, method: str) -> 'RequestBuilder':
        self._method = method
        return self

    def headers(self, headers: dict) -> 'RequestBuilder':
        self._headers = headers
        return self

    def timeout(self, seconds: int) -> 'RequestBuilder':
        self._timeout = seconds
        return self

    def build(self) -> Request:
        if not self._url:
            raise ValueError("url is required")
        return Request(self._url, self._method, self._headers, self._timeout)
```

**When NOT to use**: when all parameters are required (a constructor is clearer); when the object has few fields (keyword arguments solve it); when the language already provides named/optional arguments that make intent clear.

---

## Factory Method

Defines an interface for creating an object, but lets subclasses or implementations decide which class to instantiate. Defers instantiation to subclasses.

**Pain it removes**: creation logic that varies by subclass — the base class needs to create objects but should not be coupled to their concrete types.

**When to use**: a base class defines a workflow that includes creating objects, and subclasses must control what gets created; plugin architectures where the framework creates objects defined by the application.

```python
class DocumentCreator:
    def create_document(self) -> Document:
        raise NotImplementedError

    def open_and_render(self, path: str) -> None:
        doc = self.create_document()   # factory method
        doc.load(path)
        doc.render()

class WordDocumentCreator(DocumentCreator):
    def create_document(self) -> Document:
        return WordDocument()

class PdfDocumentCreator(DocumentCreator):
    def create_document(self) -> Document:
        return PdfDocument()
```

**Simpler alternative** — a standalone factory function — is often cleaner when you do not need inheritance:

```python
def create_payment_processor(provider: str) -> PaymentProcessor:
    registry = {
        'stripe': StripeProcessor,
        'paypal': PayPalProcessor,
        'bank_transfer': BankTransferProcessor,
    }
    cls = registry.get(provider)
    if cls is None:
        raise ValueError(f"Unknown provider: {provider}")
    return cls()
```

**When NOT to use**: when the type is always the same (instantiate directly); when a simple dictionary dispatch is sufficient.

---

## Abstract Factory

Provides an interface for creating **families of related objects** without specifying their concrete classes. Ensures that objects from the same family are used together.

**Pain it removes**: needing to create sets of objects that must be compatible with each other (e.g., UI components from the same platform, infrastructure components for the same cloud provider).

**When to use**: you need to enforce that a set of related objects (button + dialog + input, or client + serialiser + validator) all come from the same "family"; you need to switch entire families at once.

```python
class UIFactory:
    def create_button(self) -> Button: ...
    def create_dialog(self) -> Dialog: ...
    def create_input(self) -> Input: ...

class WebUIFactory(UIFactory):
    def create_button(self) -> Button: return HtmlButton()
    def create_dialog(self) -> Dialog: return HtmlDialog()
    def create_input(self) -> Input: return HtmlInput()

class NativeUIFactory(UIFactory):
    def create_button(self) -> Button: return NativeButton()
    def create_dialog(self) -> Dialog: return NativeDialog()
    def create_input(self) -> Input: return NativeInput()

class App:
    def __init__(self, ui: UIFactory):
        self._button = ui.create_button()
        self._dialog = ui.create_dialog()
```

**When NOT to use**: when products are unrelated and do not need to be consistent; when there is genuinely only one product family now and no realistic expectation of a second.

**Warning**: Abstract Factory is one of the most over-applied patterns. The indirection cost is real — only introduce it when multiple families and family-switching are actual requirements.

---

## Prototype

Creates new objects by cloning an existing, fully configured instance rather than constructing from scratch.

**Pain it removes**: expensive or complex initialisation that would need to be repeated every time a new object of the same configuration is needed.

**When to use**: initialisation is expensive (database lookup, network call, complex computation) and new objects are variations of a known template; game objects sharing expensive setup but with unique position/state.

```python
import copy

class ReportTemplate:
    def __init__(self):
        self._layout = self._load_layout()      # expensive
        self._styles = self._load_styles()      # expensive
        self._data = {}

    def clone(self) -> 'ReportTemplate':
        return copy.deepcopy(self)              # cheap copy of expensive setup

    def with_data(self, data: dict) -> 'ReportTemplate':
        clone = self.clone()
        clone._data = data
        return clone

# Build once, clone many
base_template = ReportTemplate()
monthly_report = base_template.with_data(monthly_data)
quarterly_report = base_template.with_data(quarterly_data)
```

**When NOT to use**: when construction is cheap and cloning would be more complex than constructing; when deep copy semantics are unclear (shared mutable references in the clone).

---

## Design Checklist

- [ ] Singleton only chosen when the object is stateless or safe to share — not for "easy access"
- [ ] Builder's `build()` validates all required fields and invalid combinations before constructing
- [ ] Builder methods return `self` to enable fluent chaining
- [ ] Factory Method used when subclass controls the type; standalone factory function used otherwise
- [ ] Abstract Factory only introduced when multiple product families are a real, current requirement
- [ ] Prototype used only when initialisation cost justifies the cloning complexity
- [ ] Simple construction (few required params, no variation) uses direct instantiation — no pattern
