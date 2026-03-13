export interface ITaskRepository {
    all(): Promise<any[]>;
    find(id: number): Promise<any | null>;
    create(data: any): Promise<any>;
    update(id: number, data: any): Promise<any>;
    delete(id: number): Promise<void>;
}