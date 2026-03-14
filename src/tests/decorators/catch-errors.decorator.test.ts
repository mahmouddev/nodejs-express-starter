import "reflect-metadata";
import { catchErrors } from "../../decorators/catch-errors.decorator";
import { AppError } from "../../errors/app-error";
import { NotFoundError } from "../../errors/not-found.error";

function createMockRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function createMockReq() {
    return {} as any;
}

describe("@catchErrors decorator", () => {

    it("should call original method when no error thrown", async () => {
        class TestController {
            @catchErrors
            async successMethod(req: any, res: any) {
                res.json({ message: "ok" });
            }
        }

        const controller = new TestController();
        const req = createMockReq();
        const res = createMockRes();

        await controller.successMethod(req, res);

        expect(res.json).toHaveBeenCalledWith({ message: "ok" });
    });

    it("should catch AppError and return its statusCode", async () => {
        class TestController {
            @catchErrors
            async failMethod(req: any, res: any) {
                throw new AppError("Something went wrong", 400);
            }
        }

        const controller = new TestController();
        const req = createMockReq();
        const res = createMockRes();

        await controller.failMethod(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Something went wrong",
            error: "AppError",
        });
    });

    it("should catch NotFoundError and return 404", async () => {
        class TestController {
            @catchErrors
            async failMethod(req: any, res: any) {
                throw new NotFoundError("Task");
            }
        }

        const controller = new TestController();
        const req = createMockReq();
        const res = createMockRes();

        await controller.failMethod(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Task not found",
            error: "NotFoundError",
        });
    });

    it("should catch unknown errors and return 500", async () => {
        class TestController {
            @catchErrors
            async failMethod(req: any, res: any) {
                throw new Error("unexpected crash");
            }
        }

        const controller = new TestController();
        const req = createMockReq();
        const res = createMockRes();

        await controller.failMethod(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Internal server error",
            error: "InternalServerError",
        });
    });

    it("should catch non-Error throws and return 500", async () => {
        class TestController {
            @catchErrors
            async failMethod(req: any, res: any) {
                throw "string error";  // someone threw a string
            }
        }

        const controller = new TestController();
        const req = createMockReq();
        const res = createMockRes();

        await controller.failMethod(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
