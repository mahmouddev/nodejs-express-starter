import { IUserRepository } from "../interfaces/user-repository.interface";
import { injectable, inject } from 'tsyringe';
import { User } from "../types";
import jsonwebtoken from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// This handles the business logic:
// - register(name, email, password): hash password with bcrypt, save user, return JWT
// - login(email, password): find user, compare password, return JWT
// - generateToken(user): create JWT with user id, email, role
// - verifyToken(token): verify and decode JWT

@injectable()
export class UserService {
    constructor(
        @inject("IUserRepository") private userRepo: IUserRepository
    ) {}

    async all() {
        return this.userRepo.all();
    }

    async find(id: number) {
        return this.userRepo.find(id);
    }

    async create(data: any) {
        return this.userRepo.create(data);
    }

    async delete(id: number) {
        return this.userRepo.delete(id);
    }

    async register(data: any) {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        return this.userRepo.create({ ...data, password: hashedPassword });
    }

    async login(data: any) {
        const user = await this.userRepo.findByEmail(data.email);
        if (!user) {
            throw new Error('User not found');
        }

        const isValidPassword = await bcrypt.compare(data.password, user.password);
        if (!isValidPassword) {
            throw new Error('Invalid password');
        }

        const accessToken  = await this.generateToken(user);
        const refreshToken = await this.generateRefreshToken(user);
        
        // save refresh token to db 
        await this.userRepo.createRefreshToken(user.id, refreshToken);

        return { accessToken, refreshToken };
    }

    async logout(refreshToken: string) {
        await this.userRepo.deleteRefreshToken(refreshToken);
    }

    public async generateToken(user: { id: number; email: string; role: string }) {
        return jsonwebtoken.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: '15m' }
        );
    }

    public async generateRefreshToken(user: { id: number; email: string; role: string }) {
        return jsonwebtoken.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_REFRESH_SECRET!,
            { expiresIn: '7d' }
        );
    }

    public async verifyRefreshToken(token: string) {
        return jsonwebtoken.verify(token, process.env.JWT_REFRESH_SECRET!);
    }

    public async saveRefreshToken(userId: number, token: string) {
        await this.userRepo.createRefreshToken(userId, token);
    }

    public async deleteRefreshToken(token: string) {
        await this.userRepo.deleteRefreshToken(token);
    }



}
