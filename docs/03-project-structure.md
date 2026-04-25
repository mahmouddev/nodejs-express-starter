# 03 — Project Structure

## What it is

A breakdown of every folder and file in `src/`, with the **reason** each one exists separately.

## The tree

```
src/
├── app.ts                 # Express app: middleware, routes, listen
├── index.ts               # Entry point — just imports app.ts
├── container.ts           # tsyringe DI registrations
├── types.ts               # Shared TS types & enums (Task, User, HttpStatus, DTOs)
│
├── config/
│   └── database.ts        # MySQL connection pool (mysql2/promise)
│
├── controllers/
│   ├── task.controller.ts # /tasks request handlers
│   └── user.controller.ts # /auth request handlers
│
├── services/
│   ├── task.service.ts    # Task business logic
│   └── user.service.ts    # Auth, JWT signing, password hashing
│
├── interfaces/
│   ├── task-repository.interface.ts   # ITaskRepository contract
│   └── user-repository.interface.ts   # IUserRepository contract
│
├── models/
│   ├── BaseModel.ts       # Holds the shared db pool
│   ├── task.model.ts      # Task implements ITaskRepository (SQL)
│   └── user.model.ts      # User implements IUserRepository (SQL)
│
├── routes/
│   ├── tasks.routes.ts    # GET/POST/PUT/DELETE /tasks
│   └── auth.routes.ts     # POST /auth/register, /login, /logout, /refresh-token
│
├── middleware/
│   ├── logger.ts          # Logs method + URL + timestamp
│   ├── error-handler.ts   # Last-resort error → JSON
│   ├── not-found.ts       # 404 for unmatched routes
│   └── validate.ts        # Legacy field-presence middleware (superseded by @validate)
│
├── decorators/
│   ├── auth.decorator.ts          # @authenticate, @authorize
│   ├── validate.decorator.ts      # @validate(JSONSchema)
│   └── catch-errors.decorator.ts  # @catchErrors
│
├── errors/
│   ├── app-error.ts       # Base AppError (message + statusCode)
│   ├── not-found.error.ts # NotFoundError extends AppError(404)
│   └── unauthorized.error.ts # Unauthorized extends AppError(401)
│
├── validators/
│   └── task.schema.ts     # AJV JSON Schemas for create/update task
│
├── database/
│   └── migrations/
│       └── init-db.ts     # CREATE TABLE IF NOT EXISTS for all tables
│
├── tests/
│   ├── decorators/        # Decorator unit tests
│   └── services/          # Service unit tests with mocked repos
│
└── learning/              # Standalone TS / Node learning playground
    ├── typescript-basics.ts
    ├── core-modules.ts
    ├── event-loop.ts
    ├── http-server.ts
    └── demo.txt
```

## Why each folder is separate

### `controllers/` vs `services/` vs `models/`

This is the **three-tier split**:

- **Controllers** — talk HTTP. Read `req`, write `res`. They never touch the database.
- **Services** — talk *business*. They take plain values, throw domain errors (`NotFoundError`), return plain values. Importing `express` here is a smell.
- **Models** (a.k.a. repositories) — talk SQL. They take plain values, return rows.

Why split? Because each layer changes for a *different reason*:
- Controllers change when the HTTP shape changes (route paths, status codes).
- Services change when business rules change ("only the owner can update a task").
- Models change when the database changes (Postgres migration, schema tweak).

### `interfaces/`

The **contract** between services and models. Services depend on `ITaskRepository`, not on `Task`. The DI container ([`container.ts`](../src/container.ts)) decides which concrete class fulfills the contract. Without these interfaces, DI would degrade to "fancy `new`."

### `decorators/`

Cross-cutting concerns extracted as method decorators. Lives in its own folder because each one is independently reusable. See [06 — Decorators](./06-decorators.md).

### `errors/`

Custom error classes that carry an HTTP status code. Throwing `new NotFoundError("Task")` from a service automatically becomes a `404` in the response, courtesy of `@catchErrors`. See [11 — Errors](./11-errors.md).

### `validators/`

Just JSON Schemas. They live separately from the controller because:
- Schemas are **reusable** (the same `CreateTaskSchema` could power an OpenAPI spec or a CLI).
- Schemas are **data**, not code — keeping them in their own file makes diffs cleaner.

### `middleware/`

Express-style functions `(req, res, next)`. Two of these (`logger`, `error-handler`, `not-found`) are application-level — they wrap *every* request. There's also a legacy `validate.ts` middleware that predates the `@validate` decorator; it's kept around as a reference but isn't wired up.

### `database/migrations/`

Right now this is a single bootstrap script (`initDB`). The folder name is forward-looking: when the schema starts evolving, the next file would be `2026-01-add-due-date.ts`, etc. Treat `initDB` as the "version 0" baseline.

### `config/`

Anything that reads `process.env` and produces a long-lived singleton. Today only the DB pool. JWT secrets are read in the user service directly because they're only used in one place.

### `learning/`

A scratch space with standalone Node/TS examples (event loop, streams, generics, raw HTTP). **Excluded from the build** by [`tsconfig.json`](../tsconfig.json) (`exclude: ["src/learning"]`), so it never ships to production. Useful for reference and experiments without polluting the real source tree.

### `tests/`

Mirrors the layout of the code it tests (`tests/services/` mirrors `services/`). Keeping tests in a separate top-level folder (rather than `*.test.ts` next to source) means the source folders stay focused and `roots` in [`jest.config.ts`](../jest.config.ts) stays simple. See [15 — Testing](./15-testing.md).

## Top-level files

| File | Purpose |
|---|---|
| [`package.json`](../package.json) | Scripts + deps. |
| [`tsconfig.json`](../tsconfig.json) | Compiler config — see [04](./04-typescript-config.md). |
| [`jest.config.ts`](../jest.config.ts) | Test runner config — see [15](./15-testing.md). |
| `.env.example` | Template for `.env`. **Always update both files** when adding a new env var. |
| `.env` | Local secrets. **Never commit.** |
| [`README.md`](../README.md) | Quick-start. The first thing a stranger reads. |

## Naming conventions

- Files: `kebab-case.ts` (`task.service.ts`, `not-found.error.ts`).
- Classes: `PascalCase` (`TaskService`, `NotFoundError`).
- Interfaces: `IPascalCase` (`ITaskRepository`) — the `I` is intentional because tsyringe uses **string tokens** to identify them at runtime, and the `I` keeps token names easy to read.
- Decorators: `camelCase`, used as `@authenticate`, `@validate(...)`.
