# 04 — TypeScript Configuration

## What it is

The compiler config in [`tsconfig.json`](../tsconfig.json). Every flag here is a deliberate choice — none are TypeScript's default.

## Full file, annotated

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",                  // Output JS version
    "module": "commonjs",                // Output module system
    "lib": ["ES2022"],                   // Built-in types available at compile time
    "outDir": "./dist",                  // Where compiled JS lands
    "rootDir": "./src",                  // Compiler's input root
    "strict": true,                      // All strict type-checks ON
    "esModuleInterop": true,             // import x from "cjs-pkg" works
    "skipLibCheck": true,                // Don't type-check node_modules
    "forceConsistentCasingInFileNames": true, // ./Foo ≠ ./foo
    "resolveJsonModule": true,           // import json files
    "declaration": true,                 // Emit .d.ts
    "experimentalDecorators": true,      // Legacy (stage-2) decorators
    "emitDecoratorMetadata": true        // Emit Reflect.metadata for DI
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/learning"]
}
```

## Why each flag

### `"target": "ES2022"`

Output modern JS. Node 18+ runs ES2022 natively, so the compiler doesn't need to downlevel anything (no `Promise` polyfills, no `class` rewrites). Smaller, faster output.

### `"module": "commonjs"`

The Node ecosystem still runs almost entirely on CommonJS — `require()`, `module.exports`. Going ESM (`module: "nodenext"`) would mean `.mjs` extensions, no `__dirname`, and friction with libraries like `tsyringe` and `reflect-metadata`. CommonJS is the path of least resistance for a server app.

### `"lib": ["ES2022"]`

Tells TS *only* the JS standard library is available — no DOM, no `window`. This is a Node app; if I accidentally typed `document.getElementById`, it should be a compile error.

### `"outDir": "./dist"` + `"rootDir": "./src"`

Mirrors `src/foo/bar.ts` → `dist/foo/bar.js`. `rootDir` also makes the compiler error if something tries to import from outside `src/` (which would scramble the `dist` layout).

### `"strict": true`

Master switch for **eight** strictness flags including `strictNullChecks` (forces handling `null`/`undefined`), `noImplicitAny`, and `strictPropertyInitialization`. This is where most "TypeScript caught a real bug" moments come from. Always on for new projects.

### `"esModuleInterop": true`

Lets you write `import express from "express"` even though `express` is CommonJS and has no proper default export. Without it, you'd need the awkward `import * as express from "express"`. This is so universal it's effectively a default in modern projects.

### `"skipLibCheck": true`

Don't type-check `*.d.ts` files inside `node_modules`. Two benefits: faster builds, and you don't get blocked by type errors in third-party libraries you can't fix anyway.

### `"forceConsistentCasingInFileNames": true`

`./services/Task.service` and `./services/task.service` resolve to the same file on macOS (case-insensitive FS) but **fail** on Linux CI (case-sensitive). This flag makes them an error locally, so the bug is caught before deploy.

### `"resolveJsonModule": true`

Allows `import schema from "./schema.json"` and gives it a typed shape. We don't import JSON heavily today, but turning it on costs nothing.

### `"declaration": true`

Emits `.d.ts` alongside `.js`. Not strictly needed for an app, but it makes the output self-describing — useful if any part of this is ever extracted into a library.

### `"experimentalDecorators": true` ⭐

**Required.** This enables the legacy (TC39 stage-2) decorator syntax — the kind that lets you write `@injectable()`, `@validate(schema)`, `@catchErrors`. TypeScript 5+ supports a *new* (stage-3) decorator standard by default, but `tsyringe`, `class-validator`, NestJS, TypeORM, and basically every decorator-using library still expects the legacy form. Turning this on opts back into it.

### `"emitDecoratorMetadata": true` ⭐

**Required for DI.** Tells the compiler to emit hidden `Reflect.metadata("design:paramtypes", [...])` calls describing constructor parameter types. tsyringe reads that metadata at runtime to figure out *what to inject*:

```ts
@injectable()
class TaskService {
  constructor(@inject("ITaskRepository") private repo: ITaskRepository) {}
}
//                                                  ^^^^^^^^^^^^^^^^
// Without emitDecoratorMetadata, tsyringe can't see this type at runtime.
```

Pairs with the `import "reflect-metadata"` line at the top of [`app.ts`](../src/app.ts) — that import installs `Reflect.metadata` globally; this flag makes the compiler use it.

### `"include": ["src/**/*"]`

Compile everything under `src/`. Recursive glob, simple.

### `"exclude": ["node_modules", "dist", "src/learning"]`

- `node_modules` — never compile dependencies.
- `dist` — don't recompile your own output.
- `src/learning` — sandbox files that aren't part of the API. They sit inside `src/` for convenience (so they can `import` from neighboring files when experimenting), but they don't ship to production.

## Flags I deliberately did NOT set

| Flag | Why not |
|---|---|
| `"sourceMap": true` | Would help debugging; can be added later. Adds build time. |
| `"strictPropertyInitialization": false` (override) | I want it ON — catches "I forgot to init this in the constructor." |
| `"noUnusedLocals": true` | Useful, but noisy during refactors. Leaving off for now. |
| `"paths" / "baseUrl"` | Path aliases are nice but introduce another layer of resolution that has to be configured for ts-node, jest, AND tsc. Not worth it for a project this size. |
| `"isolatedModules": true` | Only matters under bundlers like esbuild/swc. We use plain `tsc`. |

## How to verify the config

```bash
# Compile once
npm run build

# Show the config TypeScript actually uses (after extends/overrides):
npx tsc --showConfig
```

If you change a flag, run the test suite and `npm run build` — both exercise the compiler.
