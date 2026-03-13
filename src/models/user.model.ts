import { injectable } from "tsyringe";
import { BaseModel } from "./BaseModel";
import { User as UserType } from "../types";
import { IUserRepository } from "../interfaces/user-repository.interface";

@injectable()
export class User extends BaseModel implements IUserRepository {

    private table = "users";

    async all() {
        const [rows] = await this.pool.execute(`SELECT * FROM ${this.table}`);
        return rows as any[];
    }

    async find(id: number) {
        const [rows] = await this.pool.execute(`SELECT * FROM ${this.table} WHERE id = ?`, [id]);
        return (rows as any[])[0] || null;
    }

    async create(data: Partial<UserType>) {
        const [result] = await this.pool.query(
            `INSERT INTO ${this.table} (name, email, password , role) VALUES (?, ?, ?, ?)`,
            [data.name, data.email, data.password, data.role ?? "user"]
        );
        const insertId = (result as any).insertId;
        return this.find(insertId);
    }

    async delete(id: number) {
        await this.pool.execute(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
    }

    async findByEmail(email: string) {
        const [rows] = await this.pool.execute(`SELECT * FROM ${this.table} WHERE email = ?`, [email]);
        return (rows as any[])[0] || null;
    }

    async createRefreshToken(userId: number, token: string) {
        await this.pool.execute(`INSERT INTO refresh_tokens (user_id, token) VALUES (?, ?)`, [userId, token]);
    }

    async deleteRefreshToken(token:string){
        await this.pool.execute(`DELETE FROM refresh_tokens WHERE token = ?`, [token]);
    }

}
