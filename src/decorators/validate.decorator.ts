import Ajv from "ajv";
import addFormats from "ajv-formats";
import { Request, Response } from "express";

// Create a single AJV instance (reused across all decorators — efficient)
const ajv = new Ajv({ allErrors: true, removeAdditional: true, useDefaults: true });
addFormats(ajv);

/**
 * Method decorator that validates req.body against a JSON Schema
 * before the handler executes.
 *
 * Similar to LoopBack 4's @requestBody() — validation happens
 * at the decorator level, not in middleware.
 *
 * Usage:
 *   @validate(CreateTaskSchema)
 *   async createTask(req: Request, res: Response) { ... }
 */
export function validate(schema: object) {
    // Compile schema once at decoration time (not on every request)
    const compiledValidator = ajv.compile(schema);

    // Return the method decorator
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        // Save reference to the original method
        const originalMethod = descriptor.value;

        // Replace the method with a wrapper
        descriptor.value = async function (req: Request, res: Response) {
            // Validate req.body against the compiled schema
            const valid = compiledValidator(req.body);

            if (!valid) {
                // Format errors like LoopBack — 422 Unprocessable Entity
                const errors = compiledValidator.errors?.map((err) => ({
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

            // Validation passed — call the original method
            return originalMethod.apply(this, [req, res]);
        };

        return descriptor;
    };
}