import { Router } from "express";
import { postsController } from "./posts.controller";
import { createPostSchema, listUserPostsSchema, postIdParamSchema, updatePostSchema } from "./posts.validation";
import { validate } from "../../middleware/validate.middleware";
import { optionalAuth, requireAuth } from "../../middleware/auth.middleware";
import { writeRateLimiter } from "../../middleware/rateLimiter.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

router.post("/create", requireAuth, writeRateLimiter, validate(createPostSchema), asyncHandler(postsController.create.bind(postsController)));
router.get("/:postId", optionalAuth, validate(postIdParamSchema), asyncHandler(postsController.getById.bind(postsController)));
router.patch("/:postId", requireAuth, validate(updatePostSchema), asyncHandler(postsController.update.bind(postsController)));
router.delete("/:postId", requireAuth, validate(postIdParamSchema), asyncHandler(postsController.remove.bind(postsController)));
router.get(
  "/by-user/:username",
  optionalAuth,
  validate(listUserPostsSchema),
  asyncHandler(postsController.listByUser.bind(postsController))
);

export default router;
