import "reflect-metadata";
import { TaskService } from "../../services/task.service";
import { NotFoundError } from "../../errors/not-found.error";

// ============================================================
// Mock the task repository
// Same idea as user.service.test.ts — fake the database layer
// ============================================================
const mockTaskRepo = {
    all: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

const taskService = new TaskService(mockTaskRepo as any);

beforeEach(() => {
    jest.clearAllMocks();
});

describe("TaskService", () => {

    // ---- getAll() ----

    describe("getAll()", () => {

        it("should return all tasks from repository", async () => {
            // Arrange
            const fakeTasks = [
                { id: 1, title: "Task 1", status: "pending" },
                { id: 2, title: "Task 2", status: "done" },
            ];
            mockTaskRepo.all.mockResolvedValue(fakeTasks);

            // Act
            const result = await taskService.getAll();

            // Assert
            expect(result).toEqual(fakeTasks);
            expect(mockTaskRepo.all).toHaveBeenCalledTimes(1);
        });

        it("should return empty array when no tasks exist", async () => {
            // Arrange
            mockTaskRepo.all.mockResolvedValue([]);

            // Act
            const result = await taskService.getAll();

            // Assert
            expect(result).toEqual([]);
        });
    });

    // ---- getById() ----

    describe("getById()", () => {

        it("should return the task if found", async () => {
            // Arrange
            const fakeTask = { id: 1, title: "Task 1", status: "pending" };
            mockTaskRepo.find.mockResolvedValue(fakeTask);

            // Act
            const result = await taskService.getById(1);

            // Assert
            expect(result).toEqual(fakeTask);
            expect(mockTaskRepo.find).toHaveBeenCalledWith(1);
        });

        it("should throw NotFoundError if task doesn't exist", async () => {
            // Arrange
            mockTaskRepo.find.mockResolvedValue(null);

            // Act & Assert
            await expect(taskService.getById(999)).rejects.toThrow(NotFoundError);
            await expect(taskService.getById(999)).rejects.toThrow("Task not found");
        });
    });

    // ---- create() ----

    describe("create()", () => {

        it("should create and return the new task", async () => {
            // Arrange
            const input = { title: "New Task", description: "desc", status: "pending" };
            const created = { id: 1, ...input };
            mockTaskRepo.create.mockResolvedValue(created);

            // Act
            const result = await taskService.create(input);

            // Assert
            expect(result).toEqual(created);
            expect(mockTaskRepo.create).toHaveBeenCalledWith(input);
        });
    });

    // ---- update() ----

    describe("update()", () => {

        it("should throw NotFoundError if task doesn't exist", async () => {
            // Arrange
            mockTaskRepo.find.mockResolvedValue(null);

            // Act & Assert
            await expect(
                taskService.update(999, { title: "Updated" })
            ).rejects.toThrow(NotFoundError);
        });

        it("should merge new data with existing and update", async () => {
            // Arrange: existing task in DB
            const existing = { id: 1, title: "Old Title", description: "Old Desc", status: "pending" };
            mockTaskRepo.find.mockResolvedValue(existing);
            mockTaskRepo.update.mockResolvedValue({ ...existing, title: "New Title" });

            // Act: only update the title
            const result = await taskService.update(1, { title: "New Title" });

            // Assert: update was called with merged fields
            expect(mockTaskRepo.update).toHaveBeenCalledWith(1, {
                title: "New Title",
                description: "Old Desc",   // kept from existing
                status: "pending",          // kept from existing
            });
        });

        it("should use existing values when fields are not provided", async () => {
            // Arrange
            const existing = { id: 1, title: "My Task", description: "My Desc", status: "done" };
            mockTaskRepo.find.mockResolvedValue(existing);
            mockTaskRepo.update.mockResolvedValue(existing);

            // Act: send empty update
            await taskService.update(1, {});

            // Assert: all fields kept from existing
            expect(mockTaskRepo.update).toHaveBeenCalledWith(1, {
                title: "My Task",
                description: "My Desc",
                status: "done",
            });
        });
    });

    // ---- delete() ----

    describe("delete()", () => {

        it("should throw NotFoundError if task doesn't exist", async () => {
            // Arrange
            mockTaskRepo.find.mockResolvedValue(null);

            // Act & Assert
            await expect(taskService.delete(999)).rejects.toThrow(NotFoundError);
        });

        it("should delete and return the deleted task", async () => {
            // Arrange
            const existing = { id: 1, title: "Task to delete", status: "pending" };
            mockTaskRepo.find.mockResolvedValue(existing);
            mockTaskRepo.delete.mockResolvedValue(undefined);

            // Act
            const result = await taskService.delete(1);

            // Assert
            expect(mockTaskRepo.delete).toHaveBeenCalledWith(1);
            expect(result).toEqual(existing); // returns the deleted task
        });
    });
});
