import { Router } from "express";
import { usersController } from "./users.controller";
import { getUserByUsernameSchema, updateProfileSchema } from "./users.validation";
import { validate } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

router.get("/:username", validate(getUserByUsernameSchema), asyncHandler(usersController.getByUsername.bind(usersController)));
router.patch("/me", requireAuth, validate(updateProfileSchema), asyncHandler(usersController.updateMe.bind(usersController)));

export default router;
