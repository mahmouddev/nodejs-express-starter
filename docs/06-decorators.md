# 06 — Custom Decorators

## What they are

Method decorators that wrap a controller method to add behavior **before** (and around) it runs. We have four:

| Decorator | What it does | Failure response |
|---|---|---|
| `@catchErrors` | Wraps the method in try/catch. Maps `AppError` → matching status, anything else → 500. | based on error |
| `@authenticate` | Reads `Authorization: Bearer ...`, verifies JWT, attaches `req.user`. | 401 |
| `@authorize(...roles)` | After `@authenticate`, checks `req.user.role` is in `roles`. | 403 |
| `@validate(schema)` | Compiles a JSON Schema once, validates `req.body` on every call. | 422 |

## Why decorators (and not middleware)

- **Locality.** The auth requirement sits *on the method that needs it*. You can read the method and immediately see "this is admin-only, validates body, catches errors." With middleware you'd have to cross-reference the route file.
- **Per-method opt-in.** `getAllTasks` doesn't need auth; `createTask` does. With per-route middleware, you have to pick: either `router.use(auth)` (too coarse) or pass middleware on each line (verbose). Decorators sit at the method.
- **Composition order is explicit.** Decorators stack visually; you read top-to-bottom, but they apply **bottom-to-top** at runtime — see the section below.
- **It's the modern pattern.** NestJS, LoopBack, AdonisJS, TypeORM all use this style. Building it from scratch is a great way to *understand* it before reaching for a framework.

## How they're stacked

A real example, from [`task.controller.ts`](../src/controllers/task.controller.ts):

```ts
@catchErrors                  // outermost — wraps everything
@authenticate                 // verifies JWT, sets req.user
@authorize('admin')           // checks role
@validate(CreateTaskSchema)   // innermost — validates body last, before the handler
async createTask(req, res) {
  const task = await this.taskService.create(req.body);
  res.status(201).json(task);
}
```

### Decorator execution order

> **Decorators apply bottom-up, but execute top-down.**

When the class is loaded, decorators *apply* from bottom to top:

```
@validate(...)    ← applied first (closest to method)
@authorize('admin')
@authenticate
@catchErrors      ← applied last (outermost wrapper)
```

So at runtime, when the request comes in, the wrappers fire in **reverse**:

```
@catchErrors      ← runs FIRST (sets up try/catch)
  @authenticate   ← runs next (verifies token)
    @authorize    ← runs next (checks role)
      @validate   ← runs next (validates body)
        actual handler
```

Mental model: each decorator wraps the layers below it. Outermost = runs first.

> **Practical rule:** put `@authenticate` *below* `@authorize`. `@authorize` reads `req.user`, which `@authenticate` sets — so `@authenticate` must wrap closer to the body. The comment in [`auth.decorator.ts`](../src/decorators/auth.decorator.ts) makes this explicit.

## How a decorator works internally

A method decorator has this signature:

```ts
function myDecorator(
  target: any,              // the class prototype
  propertyKey: string,      // the method name
  descriptor: PropertyDescriptor  // { value: theMethod, ... }
) {
  const original = descriptor.value;
  descriptor.value = async function (req, res) {
    // ...do stuff before...
    return original.apply(this, [req, res]);  // <-- preserve `this`
    // ...or do stuff after...
  };
}
```

Two important details:

1. **`original.apply(this, [req, res])`** — using `this` keeps the controller's instance context, so `this.taskService` still works.
2. **`async function`** — must be a `function` expression, not an arrow function, so `this` binds correctly.

## Decorator vs decorator factory

Two flavors used in the project:

```ts
@authenticate              // decorator — used WITHOUT parentheses
@authorize("admin")        // factory — used WITH parentheses
@validate(CreateTaskSchema) // factory — config baked in
@catchErrors               // decorator — no config
```

A **factory** returns a decorator, so it can capture configuration in a closure (the `roles` array, the compiled schema). A plain decorator takes no config.

Rule of thumb: if you need to parameterize behavior per method, use a factory.

## `@catchErrors` — the safety net

```ts
// src/decorators/catch-errors.decorator.ts
descriptor.value = async function (req, res) {
  try {
    return await originalMethod.apply(this, [req, res]);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ /* ... */ });
    }
    return res.status(500).json({ /* generic */ });
  }
};
```

This is what lets services throw `new NotFoundError("Task")` and get a clean 404. Without it, every controller would need its own try/catch, or every error would have to fall through to Express's default error handler (and lose its status code).

> The Express-level [`error-handler.ts`](../src/middleware/error-handler.ts) is the **second** safety net. `@catchErrors` handles the common case; the middleware catches anything that escapes (e.g. an error thrown synchronously before the wrapper is reached). See [11 — Errors](./11-errors.md).

## `@authenticate` — JWT verification

```ts
// Pseudocode
const token = req.headers.authorization?.replace("Bearer ", "");
const decoded = jwt.verify(token, JWT_SECRET);
req.user = decoded;       // { id, email, role }
return original(req, res);
```

After this runs, every downstream layer can read `req.user` (the type is `AuthenticatedRequest`).

## `@authorize(...roles)` — RBAC

```ts
if (!roles.includes(req.user.role)) {
  return res.status(403).json({ /* forbidden */ });
}
```

Simple role-based check. It assumes `req.user` exists (set by `@authenticate`); if not, it 401s defensively. This is why decorator order matters.

## `@validate(schema)` — AJV body validation

```ts
const compiledValidator = ajv.compile(schema);  // happens ONCE at decoration time
descriptor.value = async function (req, res) {
  if (!compiledValidator(req.body)) {
    return res.status(422).json({ /* details */ });
  }
  return original(req, res);
};
```

Two design wins:
- **Compile once.** `ajv.compile(schema)` runs at *decoration time* (class load), not per request. Subsequent calls are just function calls.
- **Mutates body.** AJV options `removeAdditional: true` and `useDefaults: true` mean the body is sanitized in place — extra fields stripped, missing fields filled with `default`. The handler always sees a clean shape.

See [12 — Validation](./12-validation.md) for full schema details.

## Building your own decorator

Boilerplate to copy:

```ts
export function myDecorator(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const original = descriptor.value;
  descriptor.value = async function (req: Request, res: Response) {
    // do stuff before
    const result = await original.apply(this, [req, res]);
    // do stuff after
    return result;
  };
}
```

Or as a factory:

```ts
export function myDecoratorWithConfig(opts: SomeOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // same shape as above, with `opts` in scope
  };
}
```

## Limitations of this approach

- **Not type-checked at the route level.** Express's `router.get(...)` accepts any handler signature, so the controller could declare `req: AuthenticatedRequest` but Express wouldn't enforce that auth was applied. We rely on convention.
- **`req.user` typing requires the `AuthenticatedRequest` type.** Plain `Request` doesn't include it.
- **Stage-2 decorators are non-standard.** The TC39 stage-3 proposal is shipping; eventually we'll migrate. For now, [`experimentalDecorators`](./04-typescript-config.md) keeps things working.
