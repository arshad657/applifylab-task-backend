import { Router } from "express";
import { authController } from "./auth.controller";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "./auth.validation";
import { validate } from "../../middleware/validate.middleware";
import { authRateLimiter } from "../../middleware/rateLimiter.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

router.post("/register", authRateLimiter, validate(registerSchema), asyncHandler(authController.register.bind(authController)));
router.post("/login", authRateLimiter, validate(loginSchema), asyncHandler(authController.login.bind(authController)));
router.post("/refresh", authRateLimiter, validate(refreshSchema), asyncHandler(authController.refresh.bind(authController)));
router.post("/logout", authRateLimiter, validate(logoutSchema), asyncHandler(authController.logout.bind(authController)));

export default router;
