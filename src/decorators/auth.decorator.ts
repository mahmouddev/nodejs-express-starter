import { Request, Response } from "express";
import jsonwebtoken from "jsonwebtoken";

// Extend Express Request to carry the authenticated user
export interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        email: string;
        role: string;
    };
}

/**
 * @authenticate — method decorator (NOT a factory — no parentheses)
 *
 * Checks Authorization header for "Bearer <token>".
 * Verifies JWT, attaches decoded user to req.user.
 * If no token or invalid → 401 Unauthorized.
 *
 * Usage:
 *   @authenticate
 *   async getProfile(req, res) { ... }
 */
export function authenticate(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (req: AuthenticatedRequest, res: Response) {
        // 1. Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: {
                    statusCode: 401,
                    message: "Authentication required. Provide a Bearer token.",
                },
            });
        }

        const token = authHeader.split(" ")[1];

        try {
            // 2. Verify the token
            const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET!) as {
                id: number;
                email: string;
                role: string;
            };

            // 3. Attach user to request — available in the controller method
            req.user = decoded;

            // 4. Call the original method
            return originalMethod.apply(this, [req, res]);
        } catch (error) {
            return res.status(401).json({
                error: {
                    statusCode: 401,
                    message: "Invalid or expired token.",
                },
            });
        }
    };

    return descriptor;
}

/**
 * @authorize(...roles) — method decorator factory (WITH parentheses)
 *
 * Checks if the authenticated user has the required role.
 * If not → 403 Forbidden.
 *
 * IMPORTANT: Decorator execution order is BOTTOM-TO-TOP.
 * So @authenticate must be BELOW @authorize:
 *
 *   @authorize("admin")    ← runs SECOND (checks role)
 *   @authenticate           ← runs FIRST (verifies token, attaches req.user)
 *   async deleteTask(req, res) { ... }
 */
export function authorize(...roles: string[]) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (req: AuthenticatedRequest, res: Response) {
            // req.user was attached by @authenticate (which ran first)
            if (!req.user) {
                return res.status(401).json({
                    error: {
                        statusCode: 401,
                        message: "Authentication required.",
                    },
                });
            }

            if (!roles.includes(req.user.role)) {
                return res.status(403).json({
                    error: {
                        statusCode: 403,
                        message: `Access denied. Required role: ${roles.join(" or ")}. Your role: ${req.user.role}`,
                    },
                });
            }

            return originalMethod.apply(this, [req, res]);
        };

        return descriptor;
    };
}