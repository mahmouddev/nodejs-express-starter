import "reflect-metadata";
import { container } from "tsyringe";
import { Task } from "./models/task.model";
import { User } from "./models/user.model";

// Register: when someone asks for "ITaskRepository", give them a Task instance
container.register("ITaskRepository", { useClass: Task });
container.register("IUserRepository", { useClass: User });

export { container };