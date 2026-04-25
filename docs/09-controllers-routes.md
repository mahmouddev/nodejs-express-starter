# 09 — Controllers & Routes

## What they are

- **Routes** map URL paths to controller methods.
- **Controllers** are the only layer that touches `req` and `res`. They translate HTTP into service calls.

## Why this split

Routes and controllers are two different things:
- A *route* is a URL → method binding. It changes when the API surface changes.
- A *controller method* is a behavior. It changes when business needs change.

Keeping them in separate files means changing one rarely touches the other.

## A controller

```ts
// src/controllers/task.controller.ts
@injectable()
export class TaskController {
  constructor(private taskService: TaskService) {}

  @catchErrors
  async getAllTasks(req: Request, res: Response) {
    const tasks = await this.taskService.getAll();
    res.json(tasks);
  }

  @catchErrors
  @authenticate
  @authorize("admin")
  @validate(CreateTaskSchema)
  async createTask(req: Request, res: Response) {
    const task = await this.taskService.create(req.body);
    res.status(201).json(task);
  }
}
```

Each method is a thin adapter: parse input, call service, write response. The decorators above the method document and enforce the cross-cutting concerns — see [06 — Decorators](./06-decorators.md).

## A route file

```ts
// src/routes/tasks.routes.ts
import { Router } from "express";
import { container } from "../container";
import { TaskController } from "../controllers/task.controller";

const router = Router();
const tasksController = container.resolve(TaskController);

router.get("/",        tasksController.getAllTasks.bind(tasksController));
router.get("/:id",     tasksController.getTaskById.bind(tasksController));
router.post("/",       tasksController.createTask.bind(tasksController));
router.put("/:id",     tasksController.updateTask.bind(tasksController));
router.delete("/:id",  tasksController.deleteTask.bind(tasksController));

export default router;
```

Three things to notice:

### 1. `container.resolve(TaskController)` — once, at module load

The controller is built **once**, not per-request. tsyringe wires `TaskService` and `ITaskRepository` automatically. See [05 — DI](./05-dependency-injection.md).

### 2. `.bind(tasksController)` — keep `this` alive

Express calls handlers as plain functions, which strips `this`. Without `.bind`, `this.taskService` inside the method is `undefined`. Always bind.

Alternative: arrow methods on the class:

```ts
getAllTasks = async (req: Request, res: Response) => { ... };
```

I chose **regular methods + bind** because decorators only apply to declared methods (not class fields). Switching to arrow methods would break the decorator pattern.

### 3. No middleware on the route

There's no `router.post("/", authMiddleware, validateMiddleware, handler)`. Auth and validation are decorators on the controller method instead. The route file's only job is the URL → method mapping.

## How routes plug into the app

```ts
// src/app.ts
import taskRoutes from "./routes/tasks.routes";
import authRoutes from "./routes/auth.routes";

app.use(json());
app.use(logger);

app.use("/tasks", taskRoutes);
app.use("/auth",  authRoutes);

app.use(notFound);
app.use(errorHandler);
```

Order matters here:
- `json()` parses the body before any route sees it.
- `logger` runs on every request.
- Routes register in order — first match wins.
- `notFound` is the catch-all 404; it must come **after** all routes.
- `errorHandler` must come **last**; Express identifies it by its 4-argument signature.

## The auth controller — slightly different

`UserController` has methods that don't use `@catchErrors`:

```ts
async login(req: Request, res: Response) {
  const { accessToken, refreshToken } = await this.userService.login(req.body);
  res.json({ accessToken, refreshToken });
}
```

If `login` throws, Express's default error handler fires, which lands in our `errorHandler` middleware. That's fine — but mixing decorated and undecorated methods is inconsistent. **TODO:** add `@catchErrors` everywhere, then standardize the error shape.

## Why controllers are `@injectable()`

So the container can resolve them. Even though `TaskController`'s constructor parameter is a class type (`TaskService`, no `@inject` needed), the container still needs to know `TaskController` is a candidate for DI — that's what `@injectable()` says.

## Common controller patterns

### Reading params

```ts
const id = Number(req.params.id);
```

> `Number(req.params.id)` returns `NaN` for non-numeric strings; the repo's `WHERE id = ?` then matches nothing and returns `null`, which the service translates to `NotFoundError`. That's "OK by accident." A nicer approach: validate the param. On the to-do list.

### Reading body

```ts
const task = await this.taskService.create(req.body);
```

Trust `req.body` here because `@validate(CreateTaskSchema)` sanitized it just before the handler. Without `@validate`, never trust the body shape.

### Reading the authenticated user

```ts
@authenticate
async me(req: AuthenticatedRequest, res: Response) {
  res.json(req.user);
}
```

`AuthenticatedRequest` is the typed extension `Request & { user?: { id, email, role } }`. Use it in any handler decorated with `@authenticate`.

### Sending responses

```ts
res.json(data);                    // 200 + JSON
res.status(201).json(data);        // 201 + JSON
res.status(400).json({ error });   // explicit status
```

Don't `res.send` — JSON in, JSON out is the convention.

## Anti-patterns

- **Querying the DB from a controller.** That's the repo's job; go through a service.
- **Building business rules in a controller.** That's the service's job.
- **Forgetting `.bind`.** Manifests as `Cannot read properties of undefined (reading '<service>')`.
- **Reordering decorators.** `@authorize` *must* sit above `@authenticate` (so `@authenticate` wraps it closer to the body and runs first). See [06 — Decorators](./06-decorators.md).
