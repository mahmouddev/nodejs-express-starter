export interface Task {
    id?: number;
    title: string;
    description: string;
    status: TaskStatus;
    createdAt: Date;
    updatedAt: Date;
}

type TaskStatus = "active" | "inactive" | "completed";

export interface User{
    id: number;
    name: string;
    email: string;
    role: UserRole;
    password: string;
}

function wrapInArray<T>(value: T) {
    return [value];
}

interface ApiResponse<T> {
    data: T;
    success: boolean;
    message: string;
}

enum UserRole {
    ADMIN = "admin",
    USER = "user",
    MODERATOR = "moderator"
}

enum HttpStatus {
    OK = 200,
    CREATED = 201,
    BAD_REQUEST = 400,
    NOT_FOUND = 404,
    INTERNAL_SERVER_ERROR = 500
}

type CreatTaskDTO = Omit<Task, "id"| "createdAt">
type UpdateTaskDTO = Partial<CreatTaskDTO>
type TaskPreview = Pick<Task, "id"| "title" | "status">

function isString(value: unknown): value is string {
    return typeof value === "string";
}

function isTask(value: unknown): value is Task {
    return (
        typeof value === "object" &&
        value !== null &&
        "id" in value &&
        "title" in value &&
        "description" in value &&
        "status" in value &&
        "createdAt" in value
    );
}
