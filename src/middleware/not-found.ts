import { Request, Response, NextFunction } from 'express';

// Return 404 with { error: "Route not found" }
// This goes AFTER all routes in app.ts

export function notFound( req: Request, res: Response) {

    res.status(404).json({ error: "Route not found" });

}