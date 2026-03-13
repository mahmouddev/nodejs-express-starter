import { injectable } from "tsyringe";
import { UserService } from "../services/user.service";
import { Request, Response } from "express";
import { authenticate, AuthenticatedRequest } from "../decorators/auth.decorator";

@injectable()
export class UserController {
    constructor(private userService: UserService) {}

    async register(req: Request, res: Response) {
        const user = await this.userService.register(req.body);
        res.status(201).json(user);
    }

    async login(req: Request, res: Response) {
        const { accessToken, refreshToken } = await this.userService.login(req.body);
        res.json({ accessToken, refreshToken });
    }

    async logout(req: Request, res: Response) {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: "Refresh token is required" });
        }
        await this.userService.logout(refreshToken);
        res.json({ message: "Logged out" });
    }


    @authenticate
    async me(req: AuthenticatedRequest, res: Response) {
        res.json(req.user);
    }

    async refreshToken(req: Request, res: Response){
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: "Refresh token is required" });
        }

        // 1. Verify JWT signature + expiry (uses REFRESH secret)
        const decoded = await this.userService.verifyRefreshToken(refreshToken) as {
            id: number;
            email: string;
            role: string;
        };

        // 2. Delete the OLD refresh token from DB
        await this.userService.deleteRefreshToken(refreshToken);

        // 3. Generate NEW pair (rotation)
        const newAccessToken = await this.userService.generateToken(decoded);
        const newRefreshToken = await this.userService.generateRefreshToken(decoded);

        // 4. Save the NEW refresh token to DB
        await this.userService.saveRefreshToken(decoded.id, newRefreshToken);

        // 5. Return both
        res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    }
    
}
