# 15 — Testing

## What it is

Unit tests using **Jest** + **ts-jest**, focused on the service layer and the decorators. No HTTP-level integration tests yet — those would be an obvious next step (supertest).

```
src/tests/
├── decorators/
│   ├── auth.decorator.test.ts
│   ├── catch-errors.decorator.test.ts
│   └── validate.decorator.test.ts
└── services/
    ├── task.service.test.ts
    └── user.service.test.ts
```

## Why this scope (services + decorators, not controllers)

- **Services** carry the business rules — they're the highest-leverage thing to lock down with tests.
- **Decorators** are subtle: order, `this`-binding, async behavior, error flow. Tests document the contract.
- **Controllers** are just glue (parse `req`, call service, return JSON). Testing them means mocking `req`/`res`, which is high cost for low value. Once we add supertest-level integration tests, controllers get coverage for free.

## Jest config

```ts
// jest.config.ts
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  setupFiles: ["reflect-metadata"],
};
```

Why each line:

- **`preset: "ts-jest"`** — TypeScript transforms on the fly, no separate build step.
- **`testEnvironment: "node"`** — no JSDOM (we're not in a browser).
- **`roots: ["<rootDir>/src"]`** — scope to `src/` so Jest doesn't scan `dist/` or `node_modules`.
- **`testMatch: ["**/*.test.ts", "**/*.spec.ts"]`** — both naming conventions are accepted.
- **`tsconfig: "tsconfig.json"`** in the transform — uses the same compiler config as `npm run build`. **This is what makes decorators work in tests** — `experimentalDecorators` and `emitDecoratorMetadata` are inherited from the same config.
- **`setupFiles: ["reflect-metadata"]`** — auto-imports `reflect-metadata` before every test file. Without this, `@injectable()` and `@inject(...)` throw at test load time (mirroring the `import "reflect-metadata"` line in `app.ts`).

## How services are tested — mock the repo, build the service by hand

```ts
// src/tests/services/task.service.test.ts
import "reflect-metadata";
import { TaskService } from "../../services/task.service";
import { NotFoundError } from "../../errors/not-found.error";

const mockTaskRepo = {
  all:    jest.fn(),
  find:   jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const taskService = new TaskService(mockTaskRepo as any);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("TaskService.getById()", () => {
  it("returns the task if found", async () => {
    mockTaskRepo.find.mockResolvedValue({ id: 1, title: "X" });
    const result = await taskService.getById(1);
    expect(result).toEqual({ id: 1, title: "X" });
  });

  it("throws NotFoundError if missing", async () => {
    mockTaskRepo.find.mockResolvedValue(null);
    await expect(taskService.getById(999)).rejects.toThrow(NotFoundError);
  });
});
```

Three things to notice:

### 1. We bypass the DI container in tests

```ts
const taskService = new TaskService(mockTaskRepo as any);
```

We `new` the service directly with a fake repo. We *could* register the mock in tsyringe and resolve, but plain `new` is simpler and equivalent.

### 2. `as any` is a deliberate shortcut

The mock object satisfies the **shape** of `ITaskRepository` (`all`, `find`, `create`, `update`, `delete`), so functionally it implements the interface. The cast bypasses TS's structural check on the `jest.fn()` return types. Acceptable in tests.

### 3. `jest.clearAllMocks()` before each test

Without this, `mockTaskRepo.find.mock.calls` would accumulate across tests, and `mockResolvedValue` from one test would leak into the next.

## How decorators are tested

Decorators are pure functions — they take a method, return a wrapped method. To test, manually decorate a fake class method and call it:

```ts
// Pseudo-pattern (see src/tests/decorators/*)
class FakeController {
  @catchErrors
  async willThrow(req, res) {
    throw new NotFoundError("nope");
  }
}

it("translates AppError to its statusCode", async () => {
  const ctrl = new FakeController();
  const res = mockRes();         // { status: jest.fn().mockReturnThis(), json: jest.fn() }
  await ctrl.willThrow({} as any, res as any);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "nope not found" }));
});
```

Same idea for `@authenticate` (mock the `Authorization` header), `@authorize` (set `req.user.role`), and `@validate` (vary `req.body`).

## What's NOT tested yet (and what to do about it)

| Layer | Coverage | Recommended approach |
|---|---|---|
| Services | ✅ Mocked-repo unit tests | Add edge cases as bugs are found. |
| Decorators | ✅ Direct unit tests | More cases for chained decorators. |
| Controllers | ❌ | Use **supertest** to fire requests at `app`, mocking the service or container. |
| Models / SQL | ❌ | Use a **test database** (Docker MySQL) with `beforeEach` truncate. |
| End-to-end | ❌ | Postman / Playwright against a running instance. |

## The shape of a good test in this codebase

Three sections, with comments. Follow [Arrange / Act / Assert](https://wiki.c2.com/?ArrangeActAssert):

```ts
it("describes the scenario", async () => {
  // Arrange — set up mocks and inputs
  mockTaskRepo.find.mockResolvedValue(existing);

  // Act — call the thing under test
  const result = await taskService.update(1, { title: "New" });

  // Assert — check observable outcomes
  expect(mockTaskRepo.update).toHaveBeenCalledWith(1, { title: "New", ... });
});
```

A good test name reads as a sentence: `it("throws NotFoundError when task doesn't exist")`. Avoid `test1`, `should work`, etc.

## Running tests

```bash
npm test              # one-shot
npm run test:watch    # rerun on save — best in dev
```

## Common gotchas

- **`Reflect.getMetadata is not a function`** in tests → `setupFiles: ["reflect-metadata"]` is missing or removed from `jest.config.ts`.
- **Decorator tests fail with "cannot read properties of undefined"** → forgot `.bind` on the decorated method, or the wrapper isn't using `function` (arrow functions break `this`).
- **Mocks leak between tests** → add `jest.clearAllMocks()` in `beforeEach`.
- **TypeScript errors on mocks** → use `as any` for `jest.fn()` shapes; tightening can come with `jest-mock-extended`.
