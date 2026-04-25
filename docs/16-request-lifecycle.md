# 16 — Request Lifecycle

## What it is

A single end-to-end walkthrough: what happens between a client sending an HTTP request and receiving the response. Pulls together every piece in the previous docs.

## Boot phase (happens once, before any request)

```
1. node dist/index.js
2. import "./app.ts"
3.   import "reflect-metadata"          ← polyfills Reflect.metadata, REQUIRED for DI
4.   import "./container"               ← runs container.register(...) for ITaskRepository, IUserRepository
5.   import express, taskRoutes, authRoutes, ...
6.     ↳ taskRoutes runs: const tasksController = container.resolve(TaskController)
7.        ↳ tsyringe builds TaskService    (uses @inject("ITaskRepository") → resolves Task model)
8.        ↳ tsyringe builds Task model     (creates BaseModel.pool reference — already exists)
9.   app.use(json), app.use(logger), app.use("/tasks", taskRoutes), ...
10.  app.use(notFound), app.use(errorHandler)   ← LAST
11.  initDB()                           ← fire-and-forget; creates tables if missing
12.  app.listen(3000)
```

After this point, the app is hot. Each request reuses the same:
- DB pool
- Resolved controller instances
- Compiled AJV validators
- Container registrations

## Request phase (happens per request)

A real example: `POST /tasks` from an admin user, valid body.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HTTP request arrives                                                   │
│                                                                         │
│    POST /tasks HTTP/1.1                                                 │
│    Authorization: Bearer eyJhbGc...                                     │
│    Content-Type: application/json                                       │
│    {"title":"Write docs","description":"a 10+ char description"}        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
                  ┌────────────────────────┐
                  │  express.json()        │   parses body → req.body
                  │                        │
                  │  Then logger()         │   → console: "POST /tasks - <ts>"; calls next()
                  └────────────┬───────────┘
                               │
                               ▼
                  ┌────────────────────────┐
                  │  router.post("/", ...) │   matches /tasks → /
                  │                        │
                  │  bound handler runs:   │   tasksController.createTask.bind(tasksController)
                  └────────────┬───────────┘
                               │
                               ▼

  Decorator chain (applied bottom-up at class load, executes top-down at runtime):

  ┌────────────────────────────────────────────────────────────────────┐
  │  @catchErrors  (outermost)                                         │
  │    try {                                                           │
  │      ┌──────────────────────────────────────────────────────────┐  │
  │      │ @authenticate                                            │  │
  │      │   reads Authorization header                             │  │
  │      │   jwt.verify(token, JWT_SECRET) → { id, email, role }    │  │
  │      │   sets req.user                                          │  │
  │      │      ┌──────────────────────────────────────────────┐    │  │
  │      │      │ @authorize("admin")                          │    │  │
  │      │      │   req.user.role === "admin" ? continue : 403 │    │  │
  │      │      │      ┌──────────────────────────────────┐    │    │  │
  │      │      │      │ @validate(CreateTaskSchema)      │    │    │  │
  │      │      │      │   compiledValidator(req.body)    │    │    │  │
  │      │      │      │   ok? continue : 422             │    │    │  │
  │      │      │      │      ┌────────────────────────┐  │    │    │  │
  │      │      │      │      │  createTask handler    │  │    │    │  │
  │      │      │      │      │  this.taskService     ←──── ACTUAL  │ │
  │      │      │      │      │    .create(req.body)   │  │  WORK   │ │
  │      │      │      │      │  res.status(201).json  │  │         │ │
  │      │      │      │      └────────────────────────┘  │    │    │  │
  │      │      │      └──────────────────────────────────┘    │    │  │
  │      │      └──────────────────────────────────────────────┘    │  │
  │      └──────────────────────────────────────────────────────────┘  │
  │    } catch (err instanceof AppError) { res.status(err.statusCode)..│
  │      else { res.status(500)... }                                   │
  └────────────────────────────────────────────────────────────────────┘

                               │
                               ▼
                  ┌────────────────────────┐
                  │  Service: TaskService  │   no req/res, plain values
                  │   .create(body) →      │
                  │     repo.create(body)  │
                  └────────────┬───────────┘
                               │
                               ▼
                  ┌────────────────────────┐
                  │  Repository: Task      │   pool.execute(INSERT ...)
                  │   .create(body) →      │   pool.execute(SELECT new row)
                  │     returns the row    │
                  └────────────┬───────────┘
                               │
                               ▼
                  ┌────────────────────────┐
                  │  MySQL                 │
                  └────────────┬───────────┘
                               │
                               ▼

  Returns up the stack: row → service → controller → res.status(201).json(task)

┌─────────────────────────────────────────────────────────────────────────┐
│  HTTP response                                                          │
│                                                                         │
│    HTTP/1.1 201 Created                                                 │
│    Content-Type: application/json                                       │
│    {"id":7,"title":"Write docs","description":"...","status":"active"}  │
└─────────────────────────────────────────────────────────────────────────┘
```

## What happens at each failure point

| Failure | Caught by | Status | Body |
|---|---|---|---|
| Missing `Authorization` header | `@authenticate` | **401** | `{ error: { ... "Authentication required..." } }` |
| Token expired / invalid | `@authenticate` | **401** | `{ error: { ... "Invalid or expired token." } }` |
| Wrong role | `@authorize` | **403** | `{ error: { ... "Access denied. Required role: admin..." } }` |
| Body fails schema | `@validate` | **422** | `{ error: { ... details: [...] } }` |
| Service throws `NotFoundError` | `@catchErrors` | **404** | `{ success: false, message, error: "NotFoundError" }` |
| Service throws plain `Error` | `@catchErrors` | **500** | generic message |
| Sync error before decorators | `errorHandler` middleware | **500** (or `err.status`) | `{ message }` |
| Route doesn't match anything | `notFound` middleware | **404** | `{ error: "Route not found" }` |

## A second example: unauthenticated read

`GET /tasks` from an anonymous user:

```
1. json() — no body, fine
2. logger — logs the request
3. /tasks router → tasksController.getAllTasks
4. @catchErrors wraps the call
   ↳ getAllTasks runs (no @authenticate decorator on this method!)
       → taskService.getAll()
           → taskRepo.all()
               → pool.execute("SELECT * FROM tasks")
   ↳ res.json(rows)
5. 200 OK with the array
```

The auth decorators are missing on read methods *by design* — the API is "public reads, admin writes." If you wanted reads to also require auth, just add `@authenticate` above `getAllTasks` — no other code changes.

## Where each layer's responsibility ends

| Layer | Owns | Hands off via |
|---|---|---|
| Express middleware | Parsing, logging, last-resort errors | `next()` |
| Router | URL → method mapping | function call |
| Decorators | Auth, validation, error translation | `originalMethod.apply(this, [req, res])` |
| Controller | HTTP ↔ service translation | service method call |
| Service | Business rules | repository method call |
| Repository | SQL | `pool.execute` |
| Pool / mysql2 | Connection management, prepared statements | the network |

Each handoff is a function call, not a framework hook — which is what makes the request flow easy to step through with a debugger.

## Reading order (you've made it!)

If you started at [01](./01-architecture.md) and followed the index in [README](./README.md), you now have a complete mental model of the project. Use this last doc as the **map** when something breaks: trace the request from the top, ask "which layer would catch this?", jump to that doc.

Anything that's still unclear is a documentation bug. Open the file and fix it — that's why these docs live in the repo.
