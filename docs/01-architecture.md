# 01 — Architecture Overview

## What it is

A layered REST API. Each HTTP request flows through a fixed pipeline: **Route → Controller → Service → Repository → Database**, with cross-cutting concerns (auth, validation, error handling) attached as **decorators** rather than as middleware.

## Why it exists this way

I wanted a starter that mirrors how production Node apps are actually structured (NestJS, LoopBack, AdonisJS) without pulling in a full framework. Three things drive the design:

1. **Separation of concerns.** Controllers shouldn't talk to the database. Services shouldn't know about HTTP. Repositories shouldn't know about business rules. Each layer has one job.
2. **Testability.** Because services depend on **interfaces** (`ITaskRepository`), I can swap in a mock in unit tests without touching MySQL. See [`task.service.test.ts`](../src/tests/services/task.service.test.ts).
3. **Less boilerplate per route.** Auth checks, role checks, body validation, and try/catch are *repeated* in most Express apps. Lifting them into decorators keeps controller methods focused on the actual work.

## The layers

```
┌──────────────────────────────────────────────────────────┐
│  HTTP Request                                            │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│  Global middleware  (logger → json parser)               │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│  Router         /tasks, /auth                            │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│  Controller method                                       │
│   wrapped (bottom-to-top) by decorators:                 │
│     @authenticate  → verifies JWT, sets req.user         │
│     @authorize     → checks role                         │
│     @validate      → validates req.body                  │
│     @catchErrors   → try/catch around the whole stack    │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│  Service       (business logic, throws AppError)         │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│  Repository    (Task / User implements I*Repository)     │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│  MySQL pool    (mysql2/promise)                          │
└──────────────────────────────────────────────────────────┘
```

If any layer throws, control returns up to `@catchErrors`, which translates the error into an HTTP response. If something escapes that, the global `errorHandler` middleware catches it.

## The "no service knows about Express" rule

A core invariant: **services and repositories never import from `express`**.

- Controllers receive `Request` / `Response`, extract what they need, call the service.
- Services receive plain values (numbers, DTOs), call the repository, throw domain errors.
- Repositories receive plain values, return plain rows.

This is what makes the service layer trivially unit-testable — no mocking of `req`/`res`, just function calls.

## Cross-cutting concerns: decorators, not middleware

Most Express tutorials handle auth and validation as **middleware** (`app.use(authMiddleware)`). I deliberately moved both to **method decorators** because:

- Decorators sit *on the method that needs them*, so the rule is visible at the point of use.
- Order is explicit (`@authenticate` runs before `@authorize`).
- Skipping a decorator on one route is easy and obvious — middleware-based opt-outs are clumsy.
- It mirrors how NestJS / LoopBack guard routes.

See [06 — Custom Decorators](./06-decorators.md) for the deep dive.

## Dependency Injection: why tsyringe

Each service depends on a **repository interface**, not a concrete class. The DI container ([`container.ts`](../src/container.ts)) maps interface tokens to concrete implementations:

```ts
container.register("ITaskRepository", { useClass: Task });
```

Routers ask the container to resolve a controller; the container builds the controller, finds it needs `TaskService`, builds that, finds it needs `ITaskRepository`, looks up the binding, and injects `Task`. **You never call `new` for a service or repo in production code.**

That makes swapping the repo (e.g. for an in-memory test double, or a Postgres impl) a one-line change.

See [05 — Dependency Injection](./05-dependency-injection.md).

## Where each concern lives

| Concern | Lives in | Why there |
|---|---|---|
| HTTP parsing, status codes | Controllers | Only place that imports `express` |
| Business rules (e.g. "task must exist") | Services | Reusable across HTTP, CLI, jobs |
| SQL queries | Repositories (models) | Swappable, mockable |
| Auth / role checks | Decorators | Declarative, per-method |
| Body validation | Decorators (AJV) | Declarative, per-method |
| Error → HTTP mapping | `@catchErrors` + `errorHandler` middleware | Consistent shape |
| Token signing/verifying | `UserService` | Single source of truth |
| Connection pool | `config/database.ts` | Created once, shared |

## Reading order

If this is your first time in the codebase: **02 → 03 → 04 → 05 → 06 → 16** is the fastest path to "I understand what's happening."
