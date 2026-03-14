import "reflect-metadata";
import jsonwebtoken from "jsonwebtoken";

process.env.JWT_SECRET = "test-secret";

// ============================================================
// Testing Decorators — HOW?
//
// Decorators modify methods at class DEFINITION time.
// So we define a dummy class with the decorator applied,
// then call the method with fake req/res objects.
//
// We DON'T need Express running. We just simulate
// what Express would pass to the method.
// ============================================================

import { authenticate, authorize } from "../../decorators/auth.decorator";

// ============================================================
// Helper: create fake req and res objects
//
// We don't need full Express objects — just the parts
// our decorators actually use:
// - req.headers.authorization (for authenticate)
// - req.user (for authorize)
// - res.status().json() (for error responses)
// ============================================================
function createMockRes() {
    const res: any = {};
    // res.status(401) returns res (for chaining)
    // res.json({...}) records the response
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function createMockReq(overrides: any = {}) {
    return {
        headers: {},
        ...overrides,
    } as any;
}

// ============================================================
// Generate a valid token for testing
// ============================================================
function generateTestToken(payload = { id: 1, email: "test@test.com", role: "user" }) {
    return jsonwebtoken.sign(payload, "test-secret", { expiresIn: "1h" });
}

// ============================================================
// @authenticate tests
// ============================================================
describe("@authenticate decorator", () => {

    // We create a dummy class and apply the decorator
    // This simulates what happens in your real controller
    class TestController {
        @authenticate
        async protectedMethod(req: any, res: any) {
            // If decorator passes, this runs
            res.json({ message: "success", user: req.user });
        }
    }

    const controller = new TestController();

    it("should return 401 if no Authorization header", async () => {
        // Arrange
        const req = createMockReq();
        const res = createMockRes();

        // Act
        await controller.protectedMethod(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                statusCode: 401,
                message: "Authentication required. Provide a Bearer token.",
            },
        });
    });

    it("should return 401 if header doesn't start with Bearer", async () => {
        // Arrange
        const req = createMockReq({
            headers: { authorization: "Basic some-token" },
        });
        const res = createMockRes();

        // Act
        await controller.protectedMethod(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 401 if token is invalid", async () => {
        // Arrange
        const req = createMockReq({
            headers: { authorization: "Bearer invalid-token-here" },
        });
        const res = createMockRes();

        // Act
        await controller.protectedMethod(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                statusCode: 401,
                message: "Invalid or expired token.",
            },
        });
    });

    it("should call original method and attach user on valid token", async () => {
        // Arrange
        const token = generateTestToken({ id: 1, email: "mahmoud@test.com", role: "admin" });
        const req = createMockReq({
            headers: { authorization: `Bearer ${token}` },
        });
        const res = createMockRes();

        // Act
        await controller.protectedMethod(req, res);

        // Assert: original method was called (returned success)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "success",
                user: expect.objectContaining({
                    id: 1,
                    email: "mahmoud@test.com",
                    role: "admin",
                }),
            })
        );
    });

    it("should attach decoded user to req.user", async () => {
        // Arrange
        const token = generateTestToken({ id: 5, email: "test@test.com", role: "user" });
        const req = createMockReq({
            headers: { authorization: `Bearer ${token}` },
        });
        const res = createMockRes();

        // Act
        await controller.protectedMethod(req, res);

        // Assert: req.user was set by the decorator
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe(5);
        expect(req.user.email).toBe("test@test.com");
    });
});

// ============================================================
// @authorize tests
//
// NOTE: @authorize assumes req.user is already set by @authenticate.
// In these tests we set req.user manually to isolate the decorator.
// ============================================================
describe("@authorize decorator", () => {

    // Admin-only method
    class TestController {
        @authorize("admin")
        async adminOnly(req: any, res: any) {
            res.json({ message: "admin access granted" });
        }
    }

    const controller = new TestController();

    it("should return 401 if req.user is missing", async () => {
        // Arrange: no user on request (authenticate didn't run)
        const req = createMockReq();
        const res = createMockRes();

        // Act
        await controller.adminOnly(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 403 if user role doesn't match", async () => {
        // Arrange: user exists but role is "user", not "admin"
        const req = createMockReq();
        req.user = { id: 1, email: "test@test.com", role: "user" };
        const res = createMockRes();

        // Act
        await controller.adminOnly(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                statusCode: 403,
                message: "Access denied. Required role: admin. Your role: user",
            },
        });
    });

    it("should call original method if role matches", async () => {
        // Arrange: user is admin
        const req = createMockReq();
        req.user = { id: 1, email: "test@test.com", role: "admin" };
        const res = createMockRes();

        // Act
        await controller.adminOnly(req, res);

        // Assert
        expect(res.json).toHaveBeenCalledWith({ message: "admin access granted" });
    });
});

// ============================================================
// @authenticate + @authorize together (integration)
//
// Decorator execution: BOTTOM-TO-TOP at definition time.
// At runtime, the OUTERMOST wrapper runs first.
//
// @authorize("admin")  ← outermost (runs 2nd at definition, 1st at runtime)
// @authenticate        ← innermost (runs 1st at definition, 2nd at runtime)
//
// WAIT — that means @authorize runs FIRST at runtime,
// but req.user isn't set yet!
//
// The trick: @authenticate must be ABOVE @authorize
// so that @authenticate is the outermost wrapper:
//
// @authenticate        ← outermost (runs 1st at runtime → sets req.user)
// @authorize("admin")  ← innermost (runs 2nd at runtime → checks role)
// ============================================================
describe("@authenticate + @authorize together", () => {

    class TestController {
        @authenticate
        @authorize("admin")
        async adminProtected(req: any, res: any) {
            res.json({ message: "you are an admin" });
        }
    }

    const controller = new TestController();

    it("should return 401 if no token", async () => {
        const req = createMockReq();
        const res = createMockRes();

        await controller.adminProtected(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 403 if token is valid but role is wrong", async () => {
        const token = generateTestToken({ id: 1, email: "test@test.com", role: "user" });
        const req = createMockReq({
            headers: { authorization: `Bearer ${token}` },
        });
        const res = createMockRes();

        await controller.adminProtected(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should pass if token is valid AND role is admin", async () => {
        const token = generateTestToken({ id: 1, email: "test@test.com", role: "admin" });
        const req = createMockReq({
            headers: { authorization: `Bearer ${token}` },
        });
        const res = createMockRes();

        await controller.adminProtected(req, res);

        expect(res.json).toHaveBeenCalledWith({ message: "you are an admin" });
    });
});
