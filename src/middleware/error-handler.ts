import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';

interface HttpError extends Error {
    status?: number;
}

export function errorHandler(err: HttpError, req: Request, res: Response, next: NextFunction) {
    console.error(err);
   if(err instanceof AppError) {
    res.status(err.statusCode || 500).json({ message: err.message });
   }else{

    res.status(err.status || 500).json({ message: err.message });
   }

   
}