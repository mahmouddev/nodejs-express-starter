# Project Documentation

Welcome. This folder is the **deep-dive companion** to the top-level [README](../README.md). The README answers *"what is this and how do I run it?"*. These docs answer *"why is it built this way and how do I use each piece?"*.

Read top-to-bottom if you're new to the project. Otherwise, jump to the section you care about.

## Table of Contents

| # | Doc | What it covers |
|---|-----|----------------|
| 01 | [Architecture Overview](./01-architecture.md) | High-level layering, request lifecycle, design philosophy |
| 02 | [Getting Started](./02-getting-started.md) | Install, env setup, scripts, first request |
| 03 | [Project Structure](./03-project-structure.md) | What lives where and why |
| 04 | [TypeScript Configuration](./04-typescript-config.md) | `tsconfig.json` flags explained |
| 05 | [Dependency Injection (tsyringe)](./05-dependency-injection.md) | Container, `@injectable`, `@inject`, why DI here |
| 06 | [Custom Decorators](./06-decorators.md) | `@authenticate`, `@authorize`, `@validate`, `@catchErrors` |
| 07 | [Repository Pattern (Models)](./07-repository-pattern.md) | `BaseModel`, interfaces, swappable data layer |
| 08 | [Service Layer](./08-services.md) | Where business logic lives |
| 09 | [Controllers & Routes](./09-controllers-routes.md) | Wiring HTTP to services through the container |
| 10 | [Middleware](./10-middleware.md) | logger, error-handler, not-found |
| 11 | [Errors](./11-errors.md) | `AppError`, `NotFoundError`, `Unauthorized`, error flow |
| 12 | [Validation](./12-validation.md) | AJV + JSON Schema via `@validate` |
| 13 | [Authentication & JWT Flow](./13-auth-jwt.md) | Access + refresh tokens, rotation, logout |
| 14 | [Database & Migrations](./14-database.md) | Connection pool, `initDB()`, schema |
| 15 | [Testing](./15-testing.md) | Jest + ts-jest, mocking, decorator tests |
| 16 | [Request Lifecycle](./16-request-lifecycle.md) | A request from socket to response, end-to-end |

## How to read these docs

Each doc follows the same shape:

1. **What it is** — one paragraph.
2. **Why it exists** — the design problem it solves.
3. **How to use it** — concrete examples from this codebase.
4. **Gotchas** — things that bit me while building it.

If anything looks wrong or out of date, edit the file — these docs live in the repo, not on a wiki, on purpose.
