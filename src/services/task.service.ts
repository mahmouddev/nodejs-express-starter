import { injectable, inject } from "tsyringe";
import { ITaskRepository } from "../interfaces/task-repository.interface";
import { NotFoundError } from "../errors/not-found.error";

@injectable()
export class TaskService {
    constructor(
        @inject("ITaskRepository") private taskRepo: ITaskRepository
    ) {}

    async getAll() {
        return this.taskRepo.all();
    }

    async getById(id: number) {
        const task = await this.taskRepo.find(id);
        if (!task) {
            throw new NotFoundError("Task not found");
        }
        return task;
    }

    async create(data: any) {
        return this.taskRepo.create(data);
    }

    async update(id: number, data: any) {
        const existing = await this.taskRepo.find(id);
        if (!existing) {
            throw new NotFoundError("Task not found");
        }

        return this.taskRepo.update(id, {
            title: data.title ?? existing.title,
            description: data.description ?? existing.description,
            status: data.status ?? existing.status,
        });
    }

    async delete(id: number) {
        const existing = await this.taskRepo.find(id);
        if (!existing) {
            throw new NotFoundError("Task not found");
        }

        await this.taskRepo.delete(id);
        return existing;
    }
}
