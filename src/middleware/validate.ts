import { Request, Response, NextFunction } from 'express';

export function validate(fields: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        for (const field of fields) {
            if (!req.body[field]) {
                return res.status(400).json({ error: `Missing required field: ${field}` });
            }
        }
        next();
    };
}