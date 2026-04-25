# 14 — Database & Migrations

## What it is

MySQL via the `mysql2/promise` driver. A single shared **connection pool** is created in [`config/database.ts`](../src/config/database.ts) and consumed by every model through [`BaseModel`](../src/models/BaseModel.ts). Schema is bootstrapped at startup by [`initDB()`](../src/database/migrations/init-db.ts).

## Why MySQL (and not Postgres / SQLite / Mongo)

- **Familiar in the Node ecosystem.** Most LAMP-history teams already run MySQL.
- **`mysql2` is mature** with a clean Promise API and prepared statements built in.
- **The schema is relational** (users, tasks, refresh tokens with foreign keys) — relational DB is the right shape.

Postgres would be an equally good choice; the only thing that would change is the driver. Mongo would be wrong here — there's no document-shaped data.

## The connection pool

```ts
// src/config/database.ts
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();
const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

const db = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: Number(DB_PORT),
});

export default db;
```

### Why a pool (not single connections)

- A **connection** is single-threaded; a `SELECT` blocks anything else on it.
- A **pool** maintains N connections (default 10 in `mysql2`); `pool.execute()` borrows one, runs the query, returns it.
- Concurrent requests run in parallel without code-level coordination.

### Why this is loaded once

`createPool` is invoked at module load. Every model that does `import db from "../config/database"` gets the **same pool**. `BaseModel` exposes it as `this.pool`, so every subclass shares it without re-creating connections.

If you imported & created a new pool per request, you'd quickly exhaust MySQL's connection limit.

## `BaseModel` — the only line that touches the pool

```ts
// src/models/BaseModel.ts
import db from "../config/database";

export class BaseModel {
  protected pool = db;
}
```

Two-line class. Every model `extends BaseModel`. The reason to have this base at all (instead of having each model import `db` itself) is so:
- The dependency on the pool is centralized — easy to swap or wrap (e.g. for query logging).
- Models can be tested by overriding `this.pool` in a subclass.

## Querying with prepared statements

```ts
const [rows] = await this.pool.execute(
  `SELECT * FROM ${this.table} WHERE id = ?`,
  [id]
);
```

Two important details:

- **`pool.execute`** uses prepared statements (driver caches the plan). Use this for any query with user input.
- **`?` placeholders** mean values are passed as parameters, never interpolated into the SQL. **Prevents SQL injection.** Never write `WHERE id = ${id}`.

Use **`pool.query`** instead of `execute` only when you literally need a non-prepared query (rare — the driver still escapes values).

## The schema (init-db.ts)

```ts
// src/database/migrations/init-db.ts
await connection.query(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    status      ENUM('active','inactive','completed') DEFAULT 'active',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`);

await connection.query(`
  CREATE TABLE IF NOT EXISTS users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    email      VARCHAR(255) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,
    role       ENUM('admin','user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

await connection.query(`
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    token      VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
```

### Design notes

- **`CREATE TABLE IF NOT EXISTS`** — idempotent. Safe to run on every boot.
- **`ENUM`** — DB-level constraint on `status` and `role`. Belt-and-suspenders with the JSON Schema validator.
- **`TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE ...`** — DB handles `created_at` / `updated_at` automatically; the app never sets them.
- **`ON DELETE CASCADE`** on `refresh_tokens.user_id` — delete the user, all their refresh tokens go too. Prevents orphans.
- **`UNIQUE` on `users.email`** — DB enforces uniqueness. Cheaper and more reliable than checking from the app (which has TOCTOU race conditions).
- **The `users.role` ENUM is `('admin','user')`** but `types.ts` defines `UserRole.MODERATOR` — the schema and the enum disagree. **Bug to fix:** add `'moderator'` to the SQL ENUM, or remove it from `UserRole`.

## Running migrations

`initDB()` is called once in [`app.ts`](../src/app.ts):

```ts
initDB();
app.listen(PORT, ...);
```

> **Caveat:** `initDB()` is fire-and-forget here. The server starts listening before migrations finish. In a real deploy, you'd `await initDB()` first. For local dev, the race is usually harmless because the first request takes longer than table creation.

## Adding a new migration

The current setup is a single bootstrap script. When the schema starts changing, the cleanest evolution is:

1. Rename `init-db.ts` to `0001-init.ts`.
2. Add new files like `0002-add-task-due-date.ts`.
3. Track applied migrations in a `_migrations` table.
4. Run them in order.

Or adopt a tool: **knex migrations**, **dbmate**, or **node-pg-migrate**'s MySQL fork. Worth doing the moment you need a second migration.

## Connection pool tuning (defaults are fine, but...)

`mysql2` defaults: `connectionLimit: 10`, `queueLimit: 0`. If your traffic exceeds 10 simultaneous queries:
- `connectionLimit: 20+` — more concurrency.
- `queueLimit: N` — bound the request queue (vs. unbounded growth).
- `idleTimeout` — release idle connections after T ms.

Pass these to `createPool({...})` when needed.

## Common DB gotchas

- **`ER_NOT_SUPPORTED_AUTH_MODE`** — MySQL 8 default auth (`caching_sha2_password`) confuses some clients. Run `ALTER USER ... IDENTIFIED WITH mysql_native_password BY '...'` or upgrade the driver.
- **`Pool is closed`** — something called `pool.end()`. Don't.
- **Querying after a `DROP DATABASE`** — connections are still pointed at the old DB; tear down the pool and restart.
- **Timestamps are server-local.** Set MySQL's session timezone to UTC and you avoid DST surprises.
