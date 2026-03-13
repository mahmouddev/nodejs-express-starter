export interface CreateTaskInput {
    title: string;
    description: string;
    status?: string;
}

export interface UpdateTaskInput {
    title?: string;
    description?: string;
    status?: string;
}

export const CreateTaskSchema = {
    type: "object",
    properties: {
        title: { type: "string", minLength: 3, maxLength: 255 },
        description: { type: "string", minLength: 10 },
        status: {
            type: "string",
            enum: ["active", "inactive", "completed"],
            default: "active",
        },
    },
    required: ["title", "description"],
    additionalProperties: false,
};

export const UpdateTaskSchema = {
    type: "object",
    properties: {
        title: { type: "string", minLength: 3, maxLength: 255 },
        description: { type: "string", minLength: 10 },
        status: {
            type: "string",
            enum: ["active", "inactive", "completed"],
        },
    },
    required: [],
    additionalProperties: false,
};