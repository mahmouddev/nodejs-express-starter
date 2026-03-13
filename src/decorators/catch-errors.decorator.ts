import { Request, Response } from "express";
import { AppError } from "../errors/app-error";

export function catchErrors(
    target : any,
    propertyKey : string,
    descriptor : PropertyDescriptor
) {
   
    // A method decorator that wraps any controller method in try/catch
    // If the error is an AppError → use its statusCode and message
    // If unknown error → 500 Internal Server Error
    // This ELIMINATES try/catch from every controller method
    const originalMethod = descriptor.value;

    descriptor.value = async function (req: Request , res:Response) {
        

        try {
            
            return await originalMethod.apply(this, [req, res]);

        } catch (error) {
            // Handle AppError or unknown error
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({
                    success: false,
                    message: error.message,
                    error: error.name
                });
            }
            
            // Unknown error
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: 'InternalServerError'
            });
        }
    }

    
}