# 08 — Service Layer

## What it is

The middle tier of the app. Services contain **business logic** — the rules that apply regardless of whether a request came in over HTTP, a CLI script, or a background job.

| Layer | Knows about | Does not know about |
|---|---|---|
| Controller | HTTP, `req`, `res`, status codes | Database |
| **Service** | **Domain rules, validation logic, transactions** | **HTTP, SQL** |
| Repository | SQL | Business rules |

## Why this layer exists

Tutorials often skip the service layer and put business logic in the controller. That works for the first 10 endpoints, then breaks down because:

- Logic gets duplicated (the same "task must exist" check in `update`, `delete`, `assignToUser`, etc.).
- You can't reuse it from non-HTTP entry points (a cron job, a CLI command, a tRPC procedure).
- Tests have to mock `req`/`res` even though they only care about the rule.

Pulling logic out into services solves all three.

## Two services in this project

### `TaskService`

```ts
// src/services/task.service.ts
@injectable()
export class TaskService {
  constructor(
    @inject("ITaskRepository") private taskRepo: ITaskRepository
  ) {}

  async getAll() { return this.taskRepo.all(); }

  async getById(id: number) {
    const task = await this.taskRepo.find(id);
    if (!task) throw new NotFoundError("Task not found");
    return task;
  }

  async create(data: any) {
    return this.taskRepo.create(data);
  }

  async update(id: number, data: any) {
    const existing = await this.taskRepo.find(id);
    if (!existing) throw new NotFoundError("Task not found");
    return this.taskRepo.update(id, {
      title: data.title ?? existing.title,
      description: data.description ?? existing.description,
      status: data.status ?? existing.status,
    });
  }

  async delete(id: number) {
    const existing = await this.taskRepo.find(id);
    if (!existing) throw new NotFoundError("Task not found");
    await this.taskRepo.delete(id);
    return existing;
  }
}
```

Notice:

- **No `req`/`res`.** Pure values in, pure values out.
- **`NotFoundError` instead of `res.status(404).json(...)`.** The service raises a domain error; `@catchErrors` converts it to HTTP. This means the **same** `getById` logic could power a CLI without modification.
- **Read-then-write for updates.** This pattern (`find` → merge with new data → `update`) is what gives PATCH-like behavior on top of a full `UPDATE` query. Fields not provided keep their old values.
- **No transactions yet.** For multi-step writes (e.g. "delete user *and* their tasks"), this is where you'd open a transaction. Today nothing needs it.

### `UserService`

Bigger because auth is concentrated here:

```ts
// src/services/user.service.ts
@injectable()
export class UserService {
  constructor(
    @inject("IUserRepository") private userRepo: IUserRepository
  ) {}

  async register(data) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.userRepo.create({ ...data, password: hashedPassword });
  }

  async login(data) {
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) throw new Error("User not found");

    const ok = await bcrypt.compare(data.password, user.password);
    if (!ok) throw new Error("Invalid password");

    const accessToken  = await this.generateToken(user);
    const refreshToken = await this.generateRefreshToken(user);
    await this.userRepo.createRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  }

  // generateToken / generateRefreshToken / verifyRefreshToken
  // saveRefreshToken / deleteRefreshToken / logout
}
```

Responsibilities:
- **Password hashing on register** (`bcrypt.hash` — never store plaintext).
- **Password comparison on login** (`bcrypt.compare` — constant-time).
- **JWT signing** (access = 15 min, refresh = 7 days, separate secrets).
- **Refresh token persistence** (so we can revoke them).

See [13 — Auth & JWT](./13-auth-jwt.md) for the full token flow.

> **Known issue:** `login` throws `new Error("User not found")` and `new Error("Invalid password")` — generic `Error`, not `AppError`. `@catchErrors` will treat both as 500. Tightening this to `new Unauthorized("Invalid credentials")` (and giving the *same* message in both cases — to avoid leaking which email is registered) is a one-line fix on the to-do list.

## How a service is consumed

```ts
// Controller — just translates HTTP ↔ service
@catchErrors
async getTaskById(req: Request, res: Response) {
  const task = await this.taskService.getById(Number(req.params.id));
  res.json(task);
}
```

The controller's job here is exactly:
1. Parse the input from `req`.
2. Call the service.
3. Shape the output onto `res`.

Anything more substantial belongs in the service.

## Why services are `@injectable()`

```ts
@injectable()
export class TaskService { ... }
```

So tsyringe can build them. The container resolves `TaskController` → sees it needs `TaskService` → builds `TaskService` → sees it needs `@inject("ITaskRepository")` → looks up `Task` → done. See [05 — Dependency Injection](./05-dependency-injection.md).

## When to add a new service

Whenever a piece of logic:
- Touches multiple repositories (e.g. "create a project AND assign owner"),
- Implements a domain rule independent of HTTP (e.g. "an invoice can't be paid twice"),
- Or needs to be reused outside controllers (cron jobs, CLI, websocket handlers).

If the work is purely "fetch and return" without rules, you *could* call the repo directly from the controller — but in this codebase we always go through a service for consistency. The cost is a thin pass-through method; the benefit is a single place to add a rule when one inevitably appears.

## Anti-patterns to avoid

- **`import { Request } from 'express'` in a service.** That's the bright line. If you find yourself writing it, the work belongs in a controller.
- **Returning `res` directly.** Services return values; the controller decides the response shape.
- **Building HTTP error responses.** Throw a domain error (`NotFoundError`, `Unauthorized`) and let the decorator/middleware translate.
- **Reaching into `req.body` from inside a service.** Pass parsed values as arguments. The service shouldn't know what an HTTP body looks like.
