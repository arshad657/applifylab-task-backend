import { Router } from "express";
import { likesController } from "../likes/likes.controller";
import { commentIdParamSchema, likeUnlikeCommentSchema } from "./comments.validation";
import { validate } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { writeRateLimiter } from "../../middleware/rateLimiter.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const commentRouter = Router();

commentRouter.post(
  "/:commentId/like-unlike",
  requireAuth,
  writeRateLimiter,
  validate(likeUnlikeCommentSchema),
  asyncHandler(likesController.likeUnlikeComment.bind(likesController))
);

commentRouter.get(
  "/:commentId/get-likes",
  validate(commentIdParamSchema),
  asyncHandler(likesController.getCommentLikers.bind(likesController))
);

export { commentRouter };
