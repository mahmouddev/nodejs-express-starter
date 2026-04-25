# 12 — Validation

## What it is

Request-body validation using **AJV** (a fast JSON Schema validator) wired in via the **`@validate(schema)`** method decorator. JSON Schemas live in [`src/validators/`](../src/validators/); the decorator lives in [`src/decorators/validate.decorator.ts`](../src/decorators/validate.decorator.ts).

## Why JSON Schema (and not Zod / Joi / class-validator)

- **It's a standard.** The same schema can document the API (OpenAPI), validate at the edge, and validate again at a second service boundary if I ever split things up.
- **AJV is fast.** It compiles schemas to optimized JS functions. Validation is essentially free per request.
- **No coupling to TS classes.** Zod ties validation to a TS expression; class-validator ties it to TS classes. JSON Schema is plain data — easy to ship to other languages or to a CLI.

That said, Zod has the best DX for TS-first projects. This is a deliberate "learn the patterns by hand" choice; Zod would be a fine swap.

## A schema

```ts
// src/validators/task.schema.ts
export const CreateTaskSchema = {
  type: "object",
  properties: {
    title:       { type: "string", minLength: 3, maxLength: 255 },
    description: { type: "string", minLength: 10 },
    status: {
      type: "string",
      enum: ["active", "inactive", "completed"],
      default: "active",
    },
  },
  required: ["title", "description"],
  additionalProperties: false,
};
```

Three constraints worth calling out:

- **`required`** — `title` and `description` must be present. `status` is optional.
- **`additionalProperties: false`** — extra fields are rejected, not silently kept. (But see "removeAdditional" below for a softer mode.)
- **`enum` + `default`** — `status` is constrained to three values; if missing, AJV writes `"active"` for you.

There's also an `UpdateTaskSchema` with the same fields but `required: []` — for PATCH-like updates.

## The decorator

```ts
// src/decorators/validate.decorator.ts (essentials)
const ajv = new Ajv({ allErrors: true, removeAdditional: true, useDefaults: true });
addFormats(ajv);

export function validate(schema: object) {
  const compiledValidator = ajv.compile(schema);  // <-- compile ONCE

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (req: Request, res: Response) {
      const valid = compiledValidator(req.body);
      if (!valid) {
        const errors = compiledValidator.errors?.map(err => ({
          field: err.instancePath.replace("/", "") || err.params?.missingProperty,
          message: err.message,
        }));
        return res.status(422).json({
          error: {
            statusCode: 422,
            name: "UnprocessableEntityError",
            message: "The request body is invalid.",
            details: errors,
          },
        });
      }
      return originalMethod.apply(this, [req, res]);
    };
    return descriptor;
  };
}
```

Three design choices:

### 1. AJV options are intentional

```ts
new Ajv({ allErrors: true, removeAdditional: true, useDefaults: true })
```

| Option | Effect |
|---|---|
| `allErrors: true` | Collect *every* validation failure (not just the first) — better error messages. |
| `removeAdditional: true` | Strip unknown fields from `req.body` before the handler runs. Combined with `additionalProperties: false`, this means clients sending junk fields succeed (with the junk silently removed) — this is more permissive than rejecting outright. |
| `useDefaults: true` | Apply `default` values from the schema. So `status` ends up as `"active"` if omitted. |

> If you'd rather **reject** unknown fields (stricter), drop `removeAdditional` and rely solely on `additionalProperties: false`. Today we strip silently; that's a deliberate forgiveness toward clients.

### 2. Schemas compile once

`ajv.compile(schema)` runs at **decoration time** (class load), not on every request. The compiled function is reused. This makes per-request validation effectively free.

### 3. 422 Unprocessable Entity (not 400)

422 is the right code for "we understood you, but the body fails our rules." 400 is for "we couldn't parse what you sent." LoopBack and Spring Boot follow this convention.

## Using it on a controller method

```ts
// src/controllers/task.controller.ts
@catchErrors
@authenticate
@authorize("admin")
@validate(CreateTaskSchema)
async createTask(req: Request, res: Response) {
  const task = await this.taskService.create(req.body);
  res.status(201).json(task);
}
```

The decorator order matters — see [06 — Decorators](./06-decorators.md). Put `@validate` closest to the method so it runs **last** (after auth), only validating bodies for users who actually have permission to submit.

## Example response

A bad POST `/tasks`:

```json
{
  "title": "x",
  "status": "weird"
}
```

Returns:

```json
{
  "error": {
    "statusCode": 422,
    "name": "UnprocessableEntityError",
    "message": "The request body is invalid.",
    "details": [
      { "field": "title",       "message": "must NOT have fewer than 3 characters" },
      { "field": "description", "message": "must have required property 'description'" },
      { "field": "status",      "message": "must be equal to one of the allowed values" }
    ]
  }
}
```

`allErrors: true` is what gives you the full list rather than failing on the first issue.

## Adding a new schema

1. Create `src/validators/<resource>.schema.ts`. Export a constant `<Action><Resource>Schema`.
2. Import + apply in the controller: `@validate(MySchema)`.
3. Done. No registration step.

## What validation does NOT do

- **Authorization.** That's `@authorize`. Validation only checks shape.
- **Business rules** ("title must be unique"). That belongs in the service — schema can't know about your DB.
- **Sanitization for output.** Schema strips fields *coming in*; if you need to reshape responses, do that in the controller or a serializer.

## Format extensions (`addFormats(ajv)`)

`ajv-formats` adds support for things like `format: "email"`, `format: "date-time"`, `format: "uuid"`. We don't use them in the current schemas but the plugin is loaded so the moment a schema declares `{ format: "email" }`, it just works.
