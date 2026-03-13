export interface IUserRepository {
    all(): Promise<any[]>;
    find(id: number): Promise<any | null>;
    create(data: any): Promise<any>;
    delete(id: number): Promise<void>;
    findByEmail(email: string): Promise<any | null>;
    createRefreshToken(userId: number, token: string): Promise<void>;
    deleteRefreshToken(token: string): Promise<void>;
}