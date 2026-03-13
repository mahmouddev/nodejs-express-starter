import { AppError } from "./app-error";

export class Unauthorized extends AppError{

    constructor(message: string = 'Unauthorized'){
        super(message, 401);
    }
}
