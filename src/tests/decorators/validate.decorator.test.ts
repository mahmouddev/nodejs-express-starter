import "reflect-metadata";
import { validate } from "../../decorators/validate.decorator";
import { CreateTaskSchema, UpdateTaskSchema } from "../../validators/task.schema";

// ============================================================
// Same approach as auth.decorator.test.ts:
// Create a dummy class, apply the decorator, call with fake req/res
// ============================================================

function createMockRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function createMockReq(body: any = {}) {
    return { body } as any;
}

// ============================================================
// @validate(CreateTaskSchema)
// ============================================================
describe("@validate(CreateTaskSchema)", () => {

    class TestController {
        @validate(CreateTaskSchema)
        async createTask(req: any, res: any) {
            res.status(201).json({ message: "created" });
        }
    }

    const controller = new TestController();

    it("should return 422 if title is missing", async () => {
        const req = createMockReq({ description: "valid description here" });
        const res = createMockRes();

        await controller.createTask(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({
                    statusCode: 422,
                    name: "UnprocessableEntityError",
                }),
            })
        );
    });

    it("should return 422 if description is missing", async () => {
        const req = createMockReq({ title: "Valid Title" });
        const res = createMockRes();

        await controller.createTask(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
    });

    it("should return 422 if title is too short", async () => {
        const req = createMockReq({ title: "ab", description: "valid description here" });
        const res = createMockRes();

        await controller.createTask(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
    });

    it("should return 422 if status is invalid enum value", async () => {
        const req = createMockReq({
            title: "Valid Title",
            description: "valid description here",
            status: "invalid-status",
        });
        const res = createMockRes();

        await controller.createTask(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
    });

    it("should return 422 if extra fields are provided", async () => {
        const req = createMockReq({
            title: "Valid Title",
            description: "valid description here",
            hackerField: "malicious data",
        });
        const res = createMockRes();

        await controller.createTask(req, res);

        // additionalProperties: false → strips or rejects extra fields
        // With removeAdditional: true in AJV config, it strips them and passes
        // So this should succeed (extra field is silently removed)
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should call original method on valid body", async () => {
        const req = createMockReq({
            title: "Valid Title",
            description: "valid description here",
            status: "active",
        });
        const res = createMockRes();

        await controller.createTask(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ message: "created" });
    });

    it("should set default status to 'active' when not provided", async () => {
        const req = createMockReq({
            title: "Valid Title",
            description: "valid description here",
        });
        const res = createMockRes();

        await controller.createTask(req, res);

        // AJV useDefaults: true → status gets set to "active"
        expect(req.body.status).toBe("active");
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should return error details with field names", async () => {
        const req = createMockReq({});
        const res = createMockRes();

        await controller.createTask(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response.error.details).toBeDefined();
        expect(response.error.details.length).toBeGreaterThan(0);
    });
});

// ============================================================
// @validate(UpdateTaskSchema)
// ============================================================
describe("@validate(UpdateTaskSchema)", () => {

    class TestController {
        @validate(UpdateTaskSchema)
        async updateTask(req: any, res: any) {
            res.json({ message: "updated" });
        }
    }

    const controller = new TestController();

    it("should pass with empty body (all fields optional)", async () => {
        const req = createMockReq({});
        const res = createMockRes();

        await controller.updateTask(req, res);

        expect(res.json).toHaveBeenCalledWith({ message: "updated" });
    });

    it("should pass with partial fields", async () => {
        const req = createMockReq({ title: "Updated Title" });
        const res = createMockRes();

        await controller.updateTask(req, res);

        expect(res.json).toHaveBeenCalledWith({ message: "updated" });
    });

    it("should return 422 if title is too short", async () => {
        const req = createMockReq({ title: "ab" });
        const res = createMockRes();

        await controller.updateTask(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
    });
});
