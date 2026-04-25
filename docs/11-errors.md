# 11 — Errors

## What it is

A small custom-error hierarchy that lets services throw **domain errors** which automatically translate to the right HTTP status. Together with [`@catchErrors`](./06-decorators.md) and the [error-handler middleware](./10-middleware.md), this is the project's error pipeline.

```
errors/
├── app-error.ts          (base — message + statusCode)
├── not-found.error.ts    (extends AppError, status 404)
└── unauthorized.error.ts (extends AppError, status 401)
```

## Why custom errors

The default `Error` class doesn't carry an HTTP status. So either:
- Every controller writes `res.status(404).json(...)` everywhere — duplication.
- Or services return *result objects* like `{ ok: false, code: 404 }` — clutter.
- Or services throw plain `Error` and the catch tries to parse the message — brittle.

A typed error hierarchy fixes all three: services throw `new NotFoundError("Task")`, and the wrapper around the controller knows how to translate it.

## `AppError` — the base

```ts
// src/errors/app-error.ts
export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

Carries:
- A human-readable `message` (becomes the response body).
- A `statusCode` (becomes the HTTP status).
- A `name` (defaults to the subclass name — `"NotFoundError"`, `"Unauthorized"` — useful for logging).

Anything else (`details`, `cause`, etc.) can be added when needed. Keeping the base small is intentional.

## Specialized errors

### `NotFoundError`

```ts
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}
```

Pass the resource name; get a 404 with a sensible message. Used in `TaskService` whenever a lookup misses.

### `Unauthorized`

```ts
export class Unauthorized extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}
```

Defined but not yet used in services — the auth decorators currently send 401 responses directly. **TODO:** convert `UserService.login`'s plain-`Error` throws to `new Unauthorized("Invalid credentials")` so the same error path is used for both auth failures.

## How errors get translated to HTTP

Two layers, in order:

### Layer 1: `@catchErrors` (per-method)

```ts
// src/decorators/catch-errors.decorator.ts
try {
  return await originalMethod.apply(this, [req, res]);
} catch (error) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: error.name,
    });
  }
  // Unknown error
  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: "InternalServerError",
  });
}
```

The vast majority of errors hit this wrapper. The response shape is consistent:

```json
{
  "success": false,
  "message": "Task not found",
  "error": "NotFoundError"
}
```

### Layer 2: `errorHandler` middleware (app-wide)

```ts
// src/middleware/error-handler.ts
export function errorHandler(err, req, res, next) {
  console.error(err);
  if (err instanceof AppError) {
    res.status(err.statusCode || 500).json({ message: err.message });
  } else {
    res.status(err.status || 500).json({ message: err.message });
  }
}
```

The safety net for anything that escapes the per-method wrapper — typically synchronous errors thrown before the wrapper takes effect. Returns a slightly simpler shape (just `{ message }`), which is **inconsistent** with `@catchErrors`. Worth aligning.

> **Known inconsistency.** Two different response shapes depending on which catcher fires. Not great. Picking the `@catchErrors` shape and adopting it in the middleware is a straightforward cleanup.

## How a service throws

```ts
// src/services/task.service.ts
async getById(id: number) {
  const task = await this.taskRepo.find(id);
  if (!task) throw new NotFoundError("Task not found");
  return task;
}
```

The service is unaware of HTTP. It throws a domain error; the controller's `@catchErrors` decorator translates it. Result: any consumer of `TaskService` gets correct error semantics — even non-HTTP consumers.

## End-to-end flow

```
Service:  throw new NotFoundError("Task not found")
   │
   ▼
@catchErrors:  caught, error instanceof AppError
   │
   ▼
Response:  HTTP 404 + { success: false, message: "Task not found", error: "NotFoundError" }
```

If the error is *not* an `AppError`:

```
throw new Error("DB pool exploded")
   │
   ▼
@catchErrors:  caught, NOT an AppError
   │
   ▼
Response:  HTTP 500 + { success: false, message: "Internal server error", error: "InternalServerError" }
```

Generic 500. Detail is logged to the console; clients see a generic message — the right behavior to avoid leaking internals.

## Adding a new error type

```ts
// src/errors/forbidden.error.ts
import { AppError } from "./app-error";

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}
```

Use it from a service:

```ts
if (task.ownerId !== userId) throw new ForbiddenError("Not your task");
```

`@catchErrors` automatically returns 403 because `instanceof AppError` is true and `statusCode` is 403.

## Anti-patterns

- **Throwing plain `Error` from a service for an expected condition.** That becomes a 500. Use an `AppError` subclass.
- **`res.status(...)` from a service.** Service code shouldn't touch HTTP. Throw instead.
- **Swallowing errors in a catch.** Either re-throw, or wrap as a domain error. Never `console.log("oops")` and continue.
- **Leaking internals in messages.** `new AppError("Connection ECONNREFUSED to 10.0.5.2:3306", 500)` exposes infrastructure detail. Keep messages user-safe; log the rest.
