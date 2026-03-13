export interface Task {
    id?: number;
    title: string;
    description: string;
    status: TaskStatus;
    createdAt: Date;
    updatedAt: Date;
}

export type TaskStatus = "active" | "inactive" | "completed";

export interface User {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    password: string;
}

export enum UserRole {
    ADMIN = "admin",
    USER = "user",
    MODERATOR = "moderator",
}

export enum HttpStatus {
    OK = 200,
    CREATED = 201,
    BAD_REQUEST = 400,
    NOT_FOUND = 404,
    INTERNAL_SERVER_ERROR = 500,
}

export interface ApiResponse<T> {
    data: T;
    success: boolean;
    message: string;
}

export type CreateTaskDTO = Omit<Task, "id" | "createdAt">;
export type UpdateTaskDTO = Partial<CreateTaskDTO>;
export type TaskPreview = Pick<Task, "id" | "title" | "status">;
