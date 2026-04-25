# 05 — Dependency Injection (tsyringe)

## What it is

A small DI container that builds your services and wires their dependencies for you. Instead of:

```ts
// Manual wiring — you do all the plumbing
const taskRepo = new Task();
const taskService = new TaskService(taskRepo);
const taskController = new TaskController(taskService);
```

You write:

```ts
const taskController = container.resolve(TaskController);
// tsyringe walks the constructor, builds dependencies, returns the wired instance
```

## Why use a container

Three reasons, in order of importance:

1. **Interface-based programming.** `TaskService` declares "I need *something* that implements `ITaskRepository`." The container decides what that something is. In tests, it's a mock; in prod, it's the MySQL-backed `Task` model. The service code is identical in both worlds.

2. **No "new" sprawl.** Without DI, the moment you add a fourth dependency to a service, you have to update every test, every CLI script, every job that builds it. With DI, you change *one line* in `container.ts`.

3. **Lifecycle control.** `container.register("ITaskRepository", { useClass: Task })` produces a new `Task` each resolve by default. Switching to a singleton is one option flip away. Doing that manually with `new` is a global-variable mess.

## The pieces

### `container.ts` — the registry

```ts
// src/container.ts
import "reflect-metadata";
import { container } from "tsyringe";
import { Task } from "./models/task.model";
import { User } from "./models/user.model";

container.register("ITaskRepository", { useClass: Task });
container.register("IUserRepository", { useClass: User });

export { container };
```

This is the **only place** that knows which concrete class fulfils which interface. Want to swap the Task repo for an in-memory implementation? Change one line:

```ts
container.register("ITaskRepository", { useClass: InMemoryTask });
```

### `@injectable()` — "this class is buildable by the container"

```ts
// src/services/task.service.ts
@injectable()
export class TaskService {
  constructor(
    @inject("ITaskRepository") private taskRepo: ITaskRepository
  ) {}
}
```

`@injectable()` does two things:
- Marks the class as a candidate for DI.
- Triggers TypeScript (with `emitDecoratorMetadata: true`) to emit constructor-parameter type info that tsyringe reads at runtime.

### `@inject("token")` — "give me the thing registered under this token"

For interfaces, you have to use a string token because **interfaces don't exist at runtime** in TypeScript. Once compiled, `ITaskRepository` is gone — only the string `"ITaskRepository"` survives.

For concrete classes (e.g. `TaskService`), you don't need `@inject` at all — tsyringe sees the constructor parameter type *is* a class and resolves it directly:

```ts
@injectable()
export class TaskController {
  constructor(private taskService: TaskService) {}  // no @inject needed
}
```

### `container.resolve(SomeClass)` — "build this for me"

This happens once per controller, in the route file:

```ts
// src/routes/tasks.routes.ts
const tasksController = container.resolve(TaskController);
```

`resolve(TaskController)` walks the constructor:
1. Sees `private taskService: TaskService`. Sees that `TaskService` is `@injectable()`. Builds it.
2. Building `TaskService` needs `@inject("ITaskRepository")`. Looks up the binding → `Task`. Builds it.
3. Building `Task` needs nothing. Done. Returns the chain back up.

Result: a fully wired `TaskController` instance.

## Why `import "reflect-metadata"` is at the top of `app.ts`

```ts
// src/app.ts — line 1
import "reflect-metadata";
import "./container";
import express from "express";
// ...
```

`reflect-metadata` is a polyfill that adds `Reflect.metadata`, `Reflect.getMetadata`, etc. to the global `Reflect` object. Without it, `@injectable()` throws at startup because tsyringe can't read the parameter types the compiler emitted.

**It must be the first import.** Importing it later means earlier modules already evaluated their decorators against an unpatched `Reflect`.

In tests, `reflect-metadata` is loaded via [`setupFiles`](../jest.config.ts) instead.

## How a request uses the container

```
Route file boots once:
  container.resolve(TaskController)
      → builds TaskService
          → builds Task (@inject "ITaskRepository")

Per-request:
  router.get("/", taskController.getAllTasks.bind(taskController))
                                  ^^^^^^^^^^
                  uses the already-resolved instance
```

Note the `.bind(taskController)` — Express strips the method off the instance, which would lose `this`. Binding fixes that. Without it, `this.taskService` inside the method is `undefined`.

## Lifetimes (worth knowing, not used today)

tsyringe supports several:

| Lifetime | Behavior |
|---|---|
| Default (transient) | New instance per `resolve()`. |
| `singleton` | One instance for the lifetime of the container. |
| `containerScoped` | One per child container — useful for per-request scoping. |
| `resolutionScoped` | One per top-level `resolve()` call. |

Right now everything is transient, but since each controller is `resolve`d only **once** at startup (in the route file), we effectively get singletons in practice. If you start adding background jobs or per-request request-scoped state, revisit this.

## Why DI > "just import the model"

Consider the alternative — services importing concrete models:

```ts
// BAD: service imports the concrete model
import { Task } from "../models/task.model";

export class TaskService {
  private repo = new Task();
  // ...
}
```

Problems:
- Can't unit-test without a real MySQL connection (because `new Task()` constructs the pool).
- Can't swap to Postgres / in-memory / a remote service without rewriting the service.
- Every test file mocks `mysql2` instead of mocking a tiny interface.

The interface + container split fixes all three.

## Common mistakes

- **Forgetting `@injectable()`.** Class won't resolve. Error message points at it.
- **Using `@inject(SomeInterface)` instead of `@inject("SomeInterface")`.** Interfaces don't exist at runtime; you must pass a string.
- **`new TaskController()` somewhere.** That bypasses the container; `taskService` won't be wired. Always go through `container.resolve(...)` (or accept the controller as a constructor dep, which also routes through the container).
- **Forgetting `.bind(controller)`.** Express calls the method standalone; `this` is `undefined`.
