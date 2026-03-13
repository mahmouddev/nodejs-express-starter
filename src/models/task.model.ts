import { injectable } from "tsyringe";
import { BaseModel } from "./BaseModel";
import { Task as TaskType } from "../types";
import { ITaskRepository } from "../interfaces/task-repository.interface";

@injectable()
export class Task extends BaseModel implements ITaskRepository {

    private table = "tasks";

    async all() {
        const [rows] = await this.pool.execute(`SELECT * FROM ${this.table}`);
        return rows as any[];
    }

    async find(id: number) {
        const [rows] = await this.pool.execute(`SELECT * FROM ${this.table} WHERE id = ?`, [id]);
        return (rows as any[])[0] || null;
    }

    async create(data: Partial<TaskType>) {
        const [result] = await this.pool.query(
            `INSERT INTO ${this.table} (title, description, status) VALUES (?, ?, ?)`,
            [data.title, data.description, data.status ?? "active"]
        );
        const insertId = (result as any).insertId;
        return this.find(insertId);
    }

    async update(id: number, data: Partial<TaskType>) {
        await this.pool.query(
            `UPDATE ${this.table} SET title = ?, description = ?, status = ? WHERE id = ?`,
            [data.title, data.description, data.status, id]
        );
        return this.find(id);
    }

    async delete(id: number) {
        await this.pool.execute(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
    }
}