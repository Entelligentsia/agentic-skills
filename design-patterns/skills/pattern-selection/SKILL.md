---
name: pattern-selection
description: INVOKE THIS FIRST before choosing, introducing, or reviewing any design pattern. Use when you are about to add a pattern, refactor toward one, or assess whether existing code uses the right one. Maps the friction you feel to the pattern that removes it — start from the pain, not from a pattern name.
---

# Pattern Selection — Decision Tree

*Source: Gang of Four — Design Patterns (1994); Martin Fowler — PoEAA (2002); Evans — DDD (2003)*

## The Rule

**Name the pain before naming the pattern.** A pattern applied without a clear pain statement is speculation. Patterns fail not because they are wrong in theory, but because they were applied to a problem that did not exist yet, or the wrong problem.

Ask first: *What is the friction I am trying to remove?*

---

## The Three Branches

### Branch 1 — Is the pain about creating objects?

Signals:
- Constructors accumulating optional parameters with unclear valid combinations
- The same setup sequence repeated in multiple places
- "Which concrete class should I create here?" logic scattered across files
- Tests require real infrastructure just to instantiate a domain object

| Further question | Pattern |
|-----------------|---------|
| Truly need exactly one shared instance? | **Singleton** — but only if stateless or safe to share |
| Construction is complex or easy to misuse? | **Builder** |
| Subclass/context decides the concrete type? | **Factory Method** |
| Need a family of related objects that must match? | **Abstract Factory** |
| Cloning a configured instance is cheaper than rebuilding? | **Prototype** |

→ Invoke the `creational` skill.

---

### Branch 2 — Is the pain about how objects fit together?

Signals:
- External library interfaces bleeding into domain logic
- Vendor-specific types appearing in business code
- Subsystems requiring a specific multi-step call sequence that callers get wrong
- You need to combine behaviours (logging + caching + retry) without a subclass for every combination
- Access to an object needs to be controlled or deferred

| Further question | Pattern |
|-----------------|---------|
| Bridging two incompatible interfaces? | **Adapter** |
| Subsystem too complex or easy to misuse? | **Facade** |
| Need optional features without subclass explosion? | **Decorator** |
| Need lazy loading, auth, caching, or remoting behind an interface? | **Proxy** |
| Domain forms a hierarchy; leaves and containers need uniform treatment? | **Composite** |
| Many objects share identical intrinsic data at memory cost? | **Flyweight** |
| Two independent dimensions of variation causing subclass matrix? | **Bridge** |

→ Invoke the `structural` skill.

---

### Branch 3 — Is the pain about behaviour that changes or varies?

Signals:
- A method accumulating `if`/`switch` branches that grow with each new case
- The same algorithm implemented differently per customer, plan, or context
- A pipeline where steps need to be reordered, inserted, or removed
- An object behaves completely differently depending on its current state
- Multiple objects need to react when another changes, but should not be tightly coupled

| Further question | Pattern |
|-----------------|---------|
| Request passes through independent steps, any of which may stop it? | **Chain of Responsibility** |
| Actions need to be queued, logged, retried, or undone? | **Command** |
| Same operation, multiple interchangeable algorithms? | **Strategy** |
| Behaviour is entirely driven by internal state and transitions? | **State** |
| One-to-many notification without tight coupling? | **Observer** |
| Need to save and restore object state without exposing internals? | **Memento** |
| Objects coordinate through a central point to avoid direct coupling? | **Mediator** |
| New operations over a stable object structure, without modifying it? | **Visitor** |
| Uniform traversal over a collection, hiding its internal structure? | **Iterator** |
| Algorithm has a fixed skeleton, steps vary by subclass? | **Template Method** |

→ Invoke the `behavioural` skill.

---

### Branch 4 — Is the pain about the domain model itself?

Signals:
- Business rules scattered across services, controllers, and utilities
- Objects that are just data bags — no behaviour, only getters/setters
- Unclear ownership: which object is responsible for enforcing an invariant?
- "Valid" object states are allowed by the code but forbidden by the business

→ Invoke the `domain-modeling` skill.

---

### Branch 5 — Is the pain about persistence and data access?

Signals:
- Database queries appearing in domain objects or service logic
- Tests require a real database to test business logic
- Switching storage backend would require touching domain code
- ORM model instances leaking across layer boundaries

→ Invoke the `data-access` skill.

---

### Branch 6 — Is the pain about service boundaries and responsibilities?

Signals:
- Services doing both orchestration and business logic
- Business rules duplicated across multiple service methods
- Unclear what a service method's single responsibility is
- Domain logic living in controllers or API handlers

→ Invoke the `service-layer` skill.

---

### Branch 7 — Is the pain about integrating external systems?

Signals:
- External API types appearing in domain code
- A single provider change requires touching many files
- A legacy system must keep running while a new one is built alongside it
- Domain vocabulary conflicting with a third-party system's vocabulary

→ Invoke the `anti-corruption` skill.

---

### Branch 8 — Is the pain about coupling between aggregates or bounded contexts?

Signals:
- One aggregate directly calling methods on another
- Changes to one part of the domain trigger unpredictable cascades
- Side effects (emails, audit logs, projections) tangled into domain operations
- Read performance suffering under the domain model's shape

→ Invoke the `domain-events` or `cqrs` skill.

---

## Common Confusions

| These feel similar... | Distinction |
|----------------------|-------------|
| Strategy vs State | Strategy: caller swaps algorithm. State: object transitions itself based on internal rules. |
| Decorator vs Proxy | Decorator adds domain behaviour. Proxy controls access or adds infrastructure concerns. |
| Facade vs Adapter | Facade simplifies. Adapter translates between incompatible interfaces. |
| Observer vs Domain Events | Observer is in-process, synchronous. Domain Events can cross boundaries, be async. |
| Factory Method vs Abstract Factory | Factory Method: one product type, subclass decides. Abstract Factory: a family of related products. |
| Command vs Strategy | Command represents an action as an object (queue, undo). Strategy represents an interchangeable algorithm. |
| Chain of Responsibility vs Decorator | Chain: each handler decides to stop or pass. Decorator: each wrapper always delegates, just adds behaviour. |

---

## The Final Check

Before applying any pattern, confirm:

- [ ] I can name the specific pain this pattern removes
- [ ] The pain exists now, not hypothetically
- [ ] A simpler solution (a function, a method, a conditional) would not suffice
- [ ] I know what the code looks like *without* the pattern and why that is worse
