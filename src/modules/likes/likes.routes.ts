import { Router } from "express";
import { likesController } from "./likes.controller";
import { likeTargetSchema } from "./likes.validation";
import { validate } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { writeRateLimiter } from "../../middleware/rateLimiter.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

// POST /likes/:targetType/:targetId   e.g. POST /likes/POST/665f.../  or /likes/COMMENT/665f...
router.post(
  "/:targetType/:targetId",
  requireAuth,
  writeRateLimiter,
  validate(likeTargetSchema),
  asyncHandler(likesController.like.bind(likesController))
);
router.delete(
  "/:targetType/:targetId",
  requireAuth,
  writeRateLimiter,
  validate(likeTargetSchema),
  asyncHandler(likesController.unlike.bind(likesController))
);

export default router;
