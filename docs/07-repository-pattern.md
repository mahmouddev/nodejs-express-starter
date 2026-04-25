# 07 — Repository Pattern (Models)

## What it is

A pattern that hides the database behind an **interface**. Services talk to `ITaskRepository`; the concrete `Task` model implements that interface and is the only place that knows SQL.

```
ITaskRepository (interface)
        ▲
        │ implements
        │
   Task (model, knows SQL)
        │
        │ uses
        ▼
   BaseModel  →  db pool (mysql2/promise)
```

## Why use it

1. **Tests don't need a database.** [`task.service.test.ts`](../src/tests/services/task.service.test.ts) passes a fake object that implements `ITaskRepository`. The service can't tell the difference.
2. **Services stay storage-agnostic.** `TaskService` doesn't know whether tasks live in MySQL, Postgres, or memory. If we migrate, only the model changes.
3. **One place per query.** All SQL for tasks is in `task.model.ts`. No `SELECT *` scattered across controllers.

## The interface

```ts
// src/interfaces/task-repository.interface.ts
export interface ITaskRepository {
  all(): Promise<any[]>;
  find(id: number): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: number, data: any): Promise<any>;
  delete(id: number): Promise<void>;
}
```

Five methods — the standard CRUD shape. Any class that exposes these can be the task repository.

> **Why `any` and not `Task`?** Looser return typing here is intentional: rows come back from `mysql2` as `RowDataPacket`, not as our `Task` type. We could `as Task` after each query, but that's a runtime lie if the schema drifts. Tightening this is on the to-do list — see "Future improvements" below.

## `BaseModel` — shared pool

```ts
// src/models/BaseModel.ts
import db from "../config/database";

export class BaseModel {
  protected pool = db;
}
```

A two-line base class. Every model `extends BaseModel`, gaining `this.pool`. The pool is created once in [`config/database.ts`](../src/config/database.ts) and shared across the entire app — `mysql2` reuses connections automatically.

## A concrete model

```ts
// src/models/task.model.ts
@injectable()
export class Task extends BaseModel implements ITaskRepository {
  private table = "tasks";

  async all() {
    const [rows] = await this.pool.execute(`SELECT * FROM ${this.table}`);
    return rows as any[];
  }

  async find(id: number) {
    const [rows] = await this.pool.execute(
      `SELECT * FROM ${this.table} WHERE id = ?`, [id]
    );
    return (rows as any[])[0] || null;
  }

  // ...create, update, delete
}
```

Notes:

- **`@injectable()`** — required so tsyringe can build it via DI.
- **`implements ITaskRepository`** — TypeScript enforces the interface; missing or wrong methods fail compilation.
- **Parameterized queries (`?` placeholders).** `pool.execute(sql, [id])` uses prepared statements; no SQL injection. **Never** template-string interpolate user data.
- **`pool.query` vs `pool.execute`.** `query` runs raw SQL; `execute` uses prepared statements (cached on the server). Use `execute` whenever inputs come from outside.

## How services use repositories

```ts
// src/services/task.service.ts
@injectable()
export class TaskService {
  constructor(
    @inject("ITaskRepository") private taskRepo: ITaskRepository
  ) {}

  async getById(id: number) {
    const task = await this.taskRepo.find(id);
    if (!task) throw new NotFoundError("Task not found");
    return task;
  }
}
```

The service:
- Doesn't know `Task` exists.
- Doesn't know SQL exists.
- Adds the **business rule** "if not found, that's a 404."

## Wiring: interface → concrete

The `@inject("ITaskRepository")` token is bound in [`container.ts`](../src/container.ts):

```ts
container.register("ITaskRepository", { useClass: Task });
container.register("IUserRepository", { useClass: User });
```

When the container resolves `TaskService`, it sees the `@inject("ITaskRepository")` token, looks up the binding, and constructs `Task`. Swap the binding to switch implementations:

```ts
container.register("ITaskRepository", { useClass: InMemoryTaskRepo });
```

No service or controller code changes.

## Why string tokens

TypeScript interfaces don't exist at runtime — they're erased after compilation. tsyringe needs *something* to look up at runtime, so we pass a string. The convention `"ITaskRepository"` mirrors the interface name so the relationship is obvious in code.

The alternative — `Symbol("ITaskRepository")` — is slightly more collision-resistant but not worth the extra ceremony in a small app.

## The user model adds extra methods

`User` implements a richer interface because auth needs more than CRUD:

```ts
// src/interfaces/user-repository.interface.ts
export interface IUserRepository {
  all(): ...;
  find(id: number): ...;
  create(data: any): ...;
  delete(id: number): ...;
  findByEmail(email: string): ...;          // login lookup
  createRefreshToken(userId, token): ...;   // store after login
  deleteRefreshToken(token): ...;           // logout / rotation
}
```

The repo holds **persistence** for refresh tokens; the **business logic** of rotation lives in `UserService`. See [13 — Auth & JWT](./13-auth-jwt.md).

## Future improvements (not done yet)

- **Tighten return types.** Instead of `any[]`, use mapped types from the SQL row shape.
- **Generic `BaseModel<T>`.** A typed `find(id)` / `all()` that infers from `T`.
- **Query builder.** Right now SQL strings are inline. Once the app grows, a builder (or moving to Drizzle/Kysely/Prisma) would help.
- **Soft deletes.** Add a `deleted_at` column and filter at the repo level.

These are deliberate omissions — the simplest version that demonstrates the pattern is the one I shipped. Add complexity when there's a concrete reason.
