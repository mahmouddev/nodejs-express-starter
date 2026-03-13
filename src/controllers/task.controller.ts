import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { ITaskRepository } from '../interfaces/task-repository.interface';
import { validate } from '../decorators/validate.decorator';
import { CreateTaskSchema, UpdateTaskSchema } from '../validators/task.schema';
import { authenticate, authorize } from '../decorators/auth.decorator';
import { catchErrors } from '../decorators/catch-errors.decorator';
import { NotFoundError } from '../errors/not-found.error';

@injectable()
export class TaskController {

    constructor(
        @inject("ITaskRepository") private taskRepo: ITaskRepository
    ) {}

    @catchErrors
    async getAllTasks(req: Request, res: Response) {
        const tasks = await this.taskRepo.all();
        res.json(tasks);
    }

    @catchErrors
    async getTaskById(req: Request, res: Response) {
        const task = await this.taskRepo.find(Number(req.params.id));
        if (!task) {
            throw new NotFoundError('Task not found');
        }
        res.json(task);
    }

    @catchErrors
    @validate(CreateTaskSchema)
    @authorize('admin')
    @authenticate
    async createTask(req: Request, res: Response) {
        const task = await this.taskRepo.create(req.body);
        res.status(201).json(task);
    }

    @catchErrors
    @validate(UpdateTaskSchema)
    @authorize('admin')
    @authenticate
    async updateTask(req: Request, res: Response) {
        const existing = await this.taskRepo.find(Number(req.params.id));
        if (!existing) {
            throw new NotFoundError('Task not found');
        }

        const updatedTask = await this.taskRepo.update(Number(req.params.id), {
            title: req.body.title ?? existing.title,
            description: req.body.description ?? existing.description,
            status: req.body.status ?? existing.status,
        });
        res.json(updatedTask);
    }

    @catchErrors
    @authorize('admin')
    @authenticate
    async deleteTask(req: Request, res: Response) {
        const existing = await this.taskRepo.find(Number(req.params.id));
        if (!existing) {
            throw new NotFoundError('Task not found');
        }

        await this.taskRepo.delete(Number(req.params.id));
        res.json(existing);
    }
}