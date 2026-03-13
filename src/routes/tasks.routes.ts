import { Router } from "express";
import { container } from "../container";
import { TaskController  } from "../controllers/task.controller";

const router = Router();

// Container resolves TaskController with all its dependencies injected
const tasksController = container.resolve(TaskController);

// No validation middleware needed — @validate decorator handles it on the controller
router.get("/", tasksController.getAllTasks.bind(tasksController));
router.get("/:id", tasksController.getTaskById.bind(tasksController));
router.post("/", tasksController.createTask.bind(tasksController));
router.put("/:id", tasksController.updateTask.bind(tasksController));
router.delete("/:id", tasksController.deleteTask.bind(tasksController));


export default router;
