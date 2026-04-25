# 10 — Middleware

## What it is

Express middleware: functions with the signature `(req, res, next) => void`. They form a pipeline. Each one can read/modify `req`, write a response (ending the chain), or call `next()` to pass control along.

The app uses three application-level middleware (logger, not-found, error-handler) plus Express's built-in `json()`. Most cross-cutting concerns that *would* be middleware in a typical Express app live in [decorators](./06-decorators.md) instead — see that doc for the rationale.

## The pipeline in `app.ts`

```ts
app.use(json());          // 1. Parse JSON bodies
app.use(logger);          // 2. Log every request

app.use("/tasks", taskRoutes);
app.use("/auth",  authRoutes);

app.use(notFound);        // 3. Catch unmatched routes (404)
app.use(errorHandler);    // 4. Catch errors (must be LAST)
```

The order is load-bearing.

## `json()` — body parser

Built into Express 5. Parses `Content-Type: application/json` request bodies and assigns them to `req.body`. Without it, `req.body` is `undefined` and every controller blows up.

> If you need to handle other content types (`urlencoded`, `multipart`), add their parsers here. Today the API only accepts JSON.

## `logger` — request log

```ts
// src/middleware/logger.ts
export function logger(req, res, next) {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
}
```

Every request prints `GET /tasks - 2026-04-25T12:34:56.789Z`. **Calling `next()` is mandatory** — without it, the request hangs forever waiting for the next handler.

This is intentionally minimal. In production you'd swap for `pino-http` or `morgan` (status codes, response time, request ID). Replacing it is a one-line change.

## `notFound` — 404 catch-all

```ts
// src/middleware/not-found.ts
export function notFound(req, res) {
  res.status(404).json({ error: "Route not found" });
}
```

Mounted **after** every route. Express tries each matcher in order; if nothing handles the URL, control falls through to `notFound`, which returns 404.

> Don't mount this before routes — it would 404 every request before the matchers got a chance.

## `errorHandler` — last-resort error catcher

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

Express identifies a function as an error handler by **its arity** — four arguments (`err, req, res, next`), not three. **Must be registered last.** Anything thrown synchronously, or any `next(err)` call, ends up here.

> In practice, most errors are caught earlier by [`@catchErrors`](./06-decorators.md) before reaching this. This middleware is the safety net for anything that escapes — for example, an error thrown synchronously *outside* the decorated method (rare).

## What's NOT middleware in this project

To make the comparison concrete, here's what would be middleware in a typical Express app vs where it lives here:

| Concern | Typical Express | Here |
|---|---|---|
| JWT verification | `app.use(authMiddleware)` or `router.use(...)` | [`@authenticate`](./06-decorators.md) decorator |
| Role check | `router.post("/", roleCheck("admin"), ...)` | [`@authorize("admin")`](./06-decorators.md) decorator |
| Body validation | `router.post("/", validateMiddleware(schema), ...)` | [`@validate(schema)`](./06-decorators.md) decorator |
| Try/catch wrapper | `app.use(asyncWrapper)` per route | [`@catchErrors`](./06-decorators.md) decorator |

The decorator versions are **per-method**, declarative, and visible at the point of use. See [06 — Decorators](./06-decorators.md) for why.

## The legacy `validate.ts` middleware

```ts
// src/middleware/validate.ts
export function validate(fields: string[]) {
  return (req, res, next) => {
    for (const field of fields) {
      if (!req.body[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }
    next();
  };
}
```

This is the **old** body validation: just checks that named fields are present. It was superseded by the [`@validate(JSONSchema)`](./12-validation.md) decorator, which:
- Validates types and constraints (length, enum, format), not just presence.
- Strips unknown fields and applies defaults.
- Returns a structured 422 with field-level errors.

The file is kept as a historical reference and is **not wired up** anywhere.

## Writing your own middleware

```ts
export function myMiddleware(req: Request, res: Response, next: NextFunction) {
  // pre-handler logic
  next();
  // (rarely) post-handler logic — but res may already be sent
}
```

Three rules:
1. Either call `next()` **or** end the response (`res.json`, `res.status(...).end`). Never both.
2. To pass an error along, call `next(err)` — Express will skip ahead to the next *error* handler.
3. Async middleware needs a try/catch around the body, or wrap with `Promise.resolve(...).catch(next)`.

## Mental model

Middleware is the **pre-route** plumbing. Decorators are the **per-method** plumbing. Routes are the URL map. Controllers are the per-request work. Errors funnel back up through `@catchErrors` and ultimately `errorHandler`.
