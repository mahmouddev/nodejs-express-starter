import { Request, Response } from 'express';
import { injectable } from 'tsyringe';
import { validate } from '../decorators/validate.decorator';
import { CreateTaskSchema, UpdateTaskSchema } from '../validators/task.schema';
import { authenticate, authorize } from '../decorators/auth.decorator';
import { catchErrors } from '../decorators/catch-errors.decorator';
import { TaskService } from '../services/task.service';

@injectable()
export class TaskController {

    constructor(private taskService: TaskService) {}

    @catchErrors
    async getAllTasks(req: Request, res: Response) {
        const tasks = await this.taskService.getAll();
        res.json(tasks);
    }

    @catchErrors
    async getTaskById(req: Request, res: Response) {
        const task = await this.taskService.getById(Number(req.params.id));
        res.json(task);
    }

    @catchErrors
    @authenticate
    @authorize('admin')
    @validate(CreateTaskSchema)
    async createTask(req: Request, res: Response) {
        const task = await this.taskService.create(req.body);
        res.status(201).json(task);
    }

    @catchErrors
    @authenticate
    @authorize('admin')
    @validate(UpdateTaskSchema)
    async updateTask(req: Request, res: Response) {
        const updatedTask = await this.taskService.update(Number(req.params.id), req.body);
        res.json(updatedTask);
    }

    @catchErrors
    @authenticate
    @authorize('admin')
    async deleteTask(req: Request, res: Response) {
        const deleted = await this.taskService.delete(Number(req.params.id));
        res.json(deleted);
    }
}