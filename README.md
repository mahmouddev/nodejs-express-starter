# Node.js + Express + TypeScript Starter

A production-ready REST API boilerplate built with Express and TypeScript. Covers real-world patterns: Dependency Injection, Custom Decorators, JWT Authentication with Refresh Tokens, Repository Pattern, and Schema Validation.

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express 5
- **Database:** MySQL (mysql2/promise)
- **DI Container:** tsyringe
- **Authentication:** JWT (access + refresh tokens)
- **Password Hashing:** bcryptjs
- **Validation:** AJV (JSON Schema)

## Project Structure

```
src/
├── config/          # Database connection pool
├── controllers/     # Request handlers (TaskController, UserController)
├── decorators/      # Custom method decorators
│   ├── auth.decorator.ts         # @authenticate, @authorize
│   ├── validate.decorator.ts     # @validate (JSON Schema)
│   └── catch-errors.decorator.ts # @catchErrors
├── errors/          # Custom error classes (AppError, NotFoundError, UnauthorizedError)
├── interfaces/      # Repository contracts (ITaskRepository, IUserRepository)
├── middleware/      # Express middleware (logger, error-handler, not-found)
├── models/          # Database models with BaseModel pattern
├── routes/          # Route definitions
├── services/        # Business logic layer
├── validators/      # JSON Schema definitions
├── types.ts         # Shared TypeScript types, interfaces, enums
├── container.ts     # DI container registration
├── app.ts           # Express app setup
├── index.ts         # Entry point
└── learning/        # Standalone learning examples (TypeScript, Streams, Event Loop)
```

## Features

- **Custom Decorators** — `@authenticate`, `@authorize`, `@validate`, `@catchErrors` eliminate boilerplate from controllers
- **Dependency Injection** — tsyringe container with interface-based registration
- **JWT Auth** — Access token (15min) + Refresh token (7 days) with rotation
- **Repository Pattern** — Database logic separated from business logic
- **Schema Validation** — AJV-based request body validation via decorators
- **Custom Error Classes** — `AppError`, `NotFoundError`, `UnauthorizedError` with proper HTTP status codes
- **Auto Migration** — Tables created automatically on startup

## API Endpoints

### Auth
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | /auth/register | Register new user | No |
| POST | /auth/login | Login, returns access + refresh tokens | No |
| POST | /auth/refresh-token | Rotate tokens | No |
| POST | /auth/logout | Invalidate refresh token | No |

### Tasks
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | /tasks | Get all tasks | No |
| GET | /tasks/:id | Get task by ID | No |
| POST | /tasks | Create task | Admin |
| PUT | /tasks/:id | Update task | Admin |
| DELETE | /tasks/:id | Delete task | Admin |

## Getting Started

```bash
# 1. Clone
git clone <repo-url>
cd nodejs-express-starter

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your MySQL credentials

# 4. Run development server
npm run dev

# 5. Build for production
npm run build
npm start
```

## Environment Variables

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=task_api
DB_PORT=3306
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
```

## Decorator Usage Example

```typescript
@catchErrors                    // Catches errors, returns proper HTTP status
@validate(CreateTaskSchema)     // Validates request body against JSON Schema
@authorize("admin")             // Checks user role
@authenticate                   // Verifies JWT token
async createTask(req, res) {
    // Clean business logic only — no try/catch, no auth checks, no validation
    const task = await this.taskRepo.create(req.body);
    res.status(201).json(task);
}
```

## Learning Resources

The `src/learning/` folder contains standalone examples covering:
- **typescript-basics.ts** — Generics, utility types, type guards, enums
- **core-modules.ts** — fs, path, EventEmitter, Streams (Readable, Transform, Writable)
- **event-loop.ts** — Event loop phases, Promise.all/race/any/allSettled
- **http-server.ts** — Raw HTTP server without Express

## License

MIT
