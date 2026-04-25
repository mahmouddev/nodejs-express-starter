# 02 — Getting Started

## What you need

- Node.js 18+ (the `tsconfig` targets ES2022, fully covered from Node 18)
- MySQL 8+ running locally or reachable over the network
- npm

## Install

```bash
cd nodejs-express-starter
npm install
```

## Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=task_api
DB_PORT=3306

JWT_SECRET=any_long_random_string
JWT_REFRESH_SECRET=different_long_random_string
```

> Generate secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. The two JWT secrets **must be different** — that's how rotation prevents a leaked access token from being used to mint refresh tokens.

You also need to **create the database** before first run (the app creates *tables*, not the database):

```sql
CREATE DATABASE task_api;
```

## Available scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start with `nodemon` + `ts-node`. Reloads on file change. |
| `npm run build` | Compile TypeScript → `dist/` via `tsc`. |
| `npm start` | Run compiled JS from `dist/`. Use this in production. |
| `npm test` | Run Jest unit tests. |
| `npm run test:watch` | Re-run tests on save. |

## First run

```bash
npm run dev
```

You should see:

```
Server is running on port 3000
```

On startup [`initDB()`](../src/database/migrations/init-db.ts) runs and creates three tables if they don't exist: `tasks`, `users`, `refresh_tokens`.

## First request — make a user, log in, create a task

```bash
# 1. Register an admin
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"secret123","role":"admin"}'

# 2. Login → returns { accessToken, refreshToken }
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"secret123"}'

# 3. Create a task (admin-only) — paste accessToken below
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"title":"My first task","description":"Long enough description","status":"active"}'

# 4. List tasks (public)
curl http://localhost:3000/tasks
```

If you got `422 Unprocessable Entity`, the [validation decorator](./12-validation.md) caught a problem with your body.
If you got `401`, the token is missing/expired — log in again.
If you got `403`, the user's role isn't `admin`.

## Production build

```bash
npm run build
NODE_ENV=production npm start
```

The compiled JS lives in `dist/`. The compiler also emits `.d.ts` files (because [`declaration: true`](./04-typescript-config.md)) — handy if you ever publish this as a library, harmless otherwise.

## Common setup gotchas

- **`Error: connect ECONNREFUSED 127.0.0.1:3306`** — MySQL isn't running, or `DB_HOST`/`DB_PORT` is wrong.
- **`Unknown database 'task_api'`** — you forgot to `CREATE DATABASE task_api;`. The migration creates *tables*, not the database itself.
- **`secretOrPrivateKey must have a value`** — `JWT_SECRET` or `JWT_REFRESH_SECRET` is missing from `.env`.
- **Decorators error on startup (`Reflect.metadata is not a function`)** — `import "reflect-metadata"` must be the **first line** in `app.ts`. It already is, so don't reorder it.
