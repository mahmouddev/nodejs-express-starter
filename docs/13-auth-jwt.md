# 13 — Authentication & JWT Flow

## What it is

JWT-based auth with two tokens: a short-lived **access token** (15 minutes) and a long-lived **refresh token** (7 days). Refresh tokens are stored in MySQL so we can **revoke** them. Token rotation on refresh — old refresh token is deleted, new pair issued.

Pieces involved:

- [`UserService`](../src/services/user.service.ts) — sign, verify, store, revoke tokens.
- [`User` model](../src/models/user.model.ts) — `refresh_tokens` table I/O.
- [`@authenticate` decorator](../src/decorators/auth.decorator.ts) — verifies access token on protected routes.
- [`@authorize(...roles)` decorator](../src/decorators/auth.decorator.ts) — RBAC layer on top.
- [`UserController`](../src/controllers/user.controller.ts) — the four auth endpoints.

## Why two tokens

Three goals pull in different directions:

| Goal | Single long-lived token | Single short-lived token | Two-token (chosen) |
|---|---|---|---|
| Few re-logins | ✅ | ❌ | ✅ |
| Limit blast radius if leaked | ❌ | ✅ | ✅ |
| Revocation (logout, ban) | ❌ (stateless) | ❌ (stateless) | ✅ (refresh stored in DB) |

So: the **access token** is JWT (stateless, fast — no DB hit on every request) and lives 15 min. The **refresh token** is JWT but also persisted in `refresh_tokens` (stateful — can be revoked) and lives 7 days. This is the same pattern OAuth providers use.

## Why two separate secrets

```
JWT_SECRET=...           # signs/verifies ACCESS tokens
JWT_REFRESH_SECRET=...   # signs/verifies REFRESH tokens
```

If the access secret leaks, an attacker can mint *access tokens* but not refresh tokens — they can't extend their access beyond a single 15-minute window. Mixing the two would erase that boundary.

## The four endpoints

```
POST /auth/register       → create user (hashes password)
POST /auth/login          → returns { accessToken, refreshToken }
POST /auth/refresh-token  → rotates: returns NEW pair
POST /auth/logout         → invalidates a refresh token
```

## Register flow

```
Client                          UserController        UserService               UserRepo
  │  POST /auth/register           │                      │                       │
  │  {name,email,password,role}    │                      │                       │
  ├───────────────────────────────►│                      │                       │
  │                                ├─ register(body) ────►│                       │
  │                                │                      ├─ bcrypt.hash(pw, 10)  │
  │                                │                      ├─ create({...,hashed})►│
  │                                │                      │                       ├─ INSERT users
  │                                │                      │◄──────────────────────┤
  │                                │◄─────────────────────┤                       │
  │  201 + user                    │                      │                       │
  │◄───────────────────────────────┤                      │                       │
```

Code:

```ts
// UserService.register
const hashedPassword = await bcrypt.hash(data.password, 10);
return this.userRepo.create({ ...data, password: hashedPassword });
```

`bcrypt.hash(password, 10)` — 10 rounds is a sensible default (~100ms on a modern server). Higher means slower brute-force *and* slower legit logins; pick the highest you can tolerate.

## Login flow

```
1. Find user by email
2. bcrypt.compare(plain, hashed)  ← constant-time, prevents timing attacks
3. Sign access token   (JWT_SECRET, 15m)
4. Sign refresh token  (JWT_REFRESH_SECRET, 7d)
5. INSERT refresh token into DB     ← so we can revoke it later
6. Return { accessToken, refreshToken }
```

Code:

```ts
// UserService.login (essentials)
const user = await this.userRepo.findByEmail(data.email);
if (!user) throw new Error("User not found");

const isValid = await bcrypt.compare(data.password, user.password);
if (!isValid) throw new Error("Invalid password");

const accessToken  = await this.generateToken(user);
const refreshToken = await this.generateRefreshToken(user);
await this.userRepo.createRefreshToken(user.id, refreshToken);

return { accessToken, refreshToken };
```

> **Known issue.** Distinguishing "user not found" from "invalid password" leaks whether an email is registered. Both should throw the same `Unauthorized("Invalid credentials")`. Tracked in [11 — Errors](./11-errors.md).

## Authenticated requests

Client stores both tokens. Sends the access token on every protected request:

```
GET /tasks/admin-only
Authorization: Bearer <accessToken>
```

The `@authenticate` decorator on the method:

```ts
const token = req.headers.authorization?.split(" ")[1];
const decoded = jwt.verify(token, JWT_SECRET);   // throws on bad/expired token
req.user = decoded;                              // { id, email, role }
return original(req, res);
```

If `jwt.verify` throws, we return 401. Otherwise, the handler runs with `req.user` populated.

For role-restricted endpoints, `@authorize("admin")` checks `req.user.role`. See [06 — Decorators](./06-decorators.md).

## Token rotation (refresh flow)

When the access token expires, the client posts the refresh token:

```
POST /auth/refresh-token
{ "refreshToken": "..." }
```

Controller logic:

```ts
// 1. Verify JWT signature + expiry (uses REFRESH secret)
const decoded = await this.userService.verifyRefreshToken(refreshToken);

// 2. Delete the OLD refresh token from DB
await this.userService.deleteRefreshToken(refreshToken);

// 3. Generate NEW pair (rotation)
const newAccessToken  = await this.userService.generateToken(decoded);
const newRefreshToken = await this.userService.generateRefreshToken(decoded);

// 4. Save the NEW refresh token to DB
await this.userService.saveRefreshToken(decoded.id, newRefreshToken);

// 5. Return both
res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
```

**Why rotate** (not just re-issue access tokens):
- If a refresh token leaks, the legitimate user's next refresh invalidates the attacker's token (the old one is now deleted).
- It limits the time window of any single refresh token.
- Industry-standard recommendation (RFC 6749 / OAuth 2 best-practice).

> **Hardening idea (not implemented).** "Reuse detection": if a *deleted* refresh token is presented again, that's a strong signal of theft → revoke ALL of the user's refresh tokens. Worth adding when this gets to production.

## Logout

```ts
async logout(refreshToken: string) {
  await this.userRepo.deleteRefreshToken(refreshToken);
}
```

Just deletes the row. The next refresh attempt will fail JWT verification (token still cryptographically valid until 7d expiry, but DB lookup misses → reject). The access token can't be invalidated mid-life — it'll just expire on its own (within 15 min).

> Why not also blacklist the access token? Because that requires a per-request DB hit, defeating the point of stateless JWT. The 15-minute lifetime is the price you pay for that simplicity.

## Why password hashing matters

```ts
await bcrypt.hash(password, 10);  // on register
await bcrypt.compare(plain, hash);  // on login
```

- **bcrypt** salts automatically (no separate salt column).
- **`compare`** is constant-time — doesn't leak password length via timing.
- **Rounds (`10`)** = work factor. Each +1 doubles the cost.
- **Never log the plaintext.** Easy mistake; review your logger config.

## Environment

```
JWT_SECRET=<long random>
JWT_REFRESH_SECRET=<different long random>
```

Generate with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Rotate them in production by:
1. Adding a new secret as `JWT_SECRET_NEXT`.
2. Verifying tokens against both for the rollover window.
3. Switching to `JWT_SECRET_NEXT`.

(Not implemented — single-secret config today.)

## Summary cheat sheet

| Token | Secret | Lifetime | Stored | Revocable |
|---|---|---|---|---|
| Access | `JWT_SECRET` | 15 min | Client only | No (waits for expiry) |
| Refresh | `JWT_REFRESH_SECRET` | 7 days | Client + `refresh_tokens` | Yes (delete row) |
