# design-patterns

Canonical software design pattern skills for Claude Code agents, grounded in authoritative sources: Gang of Four's *Design Patterns* (1994), Martin Fowler's *Patterns of Enterprise Application Architecture* (2002), and Eric Evans' *Domain-Driven Design* (2003).

These skills are designed to **pull code toward proven patterns** rather than reinforce whatever conventions happen to exist in a codebase. Each skill is organised around the **pain that warrants the pattern**, not the pattern name — so agents start from friction, not from speculation.

---

## Start Here

| Skill | Purpose |
|-------|---------|
| [`pattern-selection`](skills/pattern-selection/SKILL.md) | **Invoke first.** Decision tree that maps pain to pattern. Use before choosing any pattern. |

---

## Creational Patterns

*When object creation is the source of pain.*

| Skill | Patterns Covered |
|-------|-----------------|
| [`creational`](skills/creational/SKILL.md) | Singleton, Builder, Factory Method, Abstract Factory, Prototype |

---

## Structural Patterns

*When the pain is about how objects fit together.*

| Skill | Patterns Covered |
|-------|-----------------|
| [`structural`](skills/structural/SKILL.md) | Adapter, Facade, Decorator, Proxy, Composite, Flyweight, Bridge |

---

## Behavioural Patterns

*When behaviour varies, accumulates conditionals, or needs decoupling.*

| Skill | Patterns Covered |
|-------|-----------------|
| [`behavioural`](skills/behavioural/SKILL.md) | Chain of Responsibility, Command, Strategy, State, Observer, Memento, Mediator, Visitor, Iterator, Template Method |

---

## Enterprise & Domain Patterns

*Fowler's PoEAA and Evans' DDD tactical patterns.*

| Skill | Patterns Covered | Key Sources |
|-------|-----------------|-------------|
| [`domain-modeling`](skills/domain-modeling/SKILL.md) | Entity, Value Object, Aggregate, Aggregate Root | Evans/DDD |
| [`data-access`](skills/data-access/SKILL.md) | Repository, Unit of Work, Data Mapper, Active Record | Fowler/PoEAA, Evans/DDD |
| [`service-layer`](skills/service-layer/SKILL.md) | Application Service, Domain Service, Service Layer | Fowler/PoEAA, Evans/DDD |
| [`domain-events`](skills/domain-events/SKILL.md) | Domain Events, Transactional Outbox, eventual consistency | Evans/DDD, Vernon/IDDD |
| [`cqrs`](skills/cqrs/SKILL.md) | Commands, Queries, Read Models, Projections | Young, Fowler |
| [`anti-corruption`](skills/anti-corruption/SKILL.md) | Anti-Corruption Layer, Gateway, Facade, Strangler Fig | Evans/DDD, Fowler |

---

## Complete Pattern Coverage

All 23 GoF patterns plus key enterprise patterns:

**Creational (5)**: Singleton, Builder, Factory Method, Abstract Factory, Prototype

**Structural (7)**: Adapter, Facade, Decorator, Proxy, Composite, Flyweight, Bridge

**Behavioural (10)**: Chain of Responsibility, Command, Strategy, State, Observer, Memento, Mediator, Visitor, Iterator, Template Method

**Enterprise/DDD**: Repository, Unit of Work, Data Mapper, Active Record, Application Service, Domain Service, Service Layer, Domain Events, CQRS, Anti-Corruption Layer, Gateway, Strangler Fig

---

## Design Philosophy

Every skill follows the same structure:

- **Pain Signals** — concrete code smells that indicate the pattern is warranted
- **Pattern Selection** — quick guide when multiple patterns could apply
- **Canonical definition** — what the pattern is, with source attribution
- **When to use** — the specific problem context
- **When NOT to use** — common misapplications and simpler alternatives
- **Code examples** — language-agnostic, focused on structure
- **Design checklist** — what engineers and reviewers should verify

The `pattern-selection` skill is the entry point. Invoke it first; it routes to the specific skill.

---

## Case Study

See [Maya's Case Study](docs/maya-case-study.md) — a walkthrough of reengineering an 80,000-line invoicing platform using these skills, from anemic domain model to rich architecture with an AI feature built on `llm-patterns`.

---

## Installation

```
/plugin marketplace add Entelligentsia/agentic-skills
/plugin install design-patterns@agentic-skills
/reload-plugins
```

---

## Usage with Forge

When Forge initialises a project with these skills installed, the Engineer persona is instructed to invoke `pattern-selection` before implementing any non-trivial design, and then the specific skill it points to. The Supervisor uses the design checklists as review criteria.

---

## Sources

- Martin Fowler — *Patterns of Enterprise Application Architecture* (2002)
- Eric Evans — *Domain-Driven Design* (2003)
- Vaughn Vernon — *Implementing Domain-Driven Design* (2013)
- Gang of Four — *Design Patterns: Elements of Reusable Object-Oriented Software* (1994)
- Greg Young — CQRS Documents (2010)
- Martin Fowler — bliki: CQRS, StranglerFigApplication, AntiCorruptionLayer
