import { Router } from "express";
import { container } from "../container";
import { UserController  } from "../controllers/user.controller";

const router = Router();

// Container resolves TaskController with all its dependencies injected
const usersController = container.resolve(UserController);

router.post("/register", usersController.register.bind(usersController));
router.post("/login", usersController.login.bind(usersController));
router.post("/refresh-token", usersController.refreshToken.bind(usersController));
router.post("/logout", usersController.logout.bind(usersController));

export default router;
