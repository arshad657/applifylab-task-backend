import { Router } from "express";
import { commentsController } from "./comments.controller";
import {
  createCommentSchema,
  listCommentsSchema,
} from "./comments.validation";
import { validate } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { writeRateLimiter } from "../../middleware/rateLimiter.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

// Mounted at:
//   /post/create-comment
const postCommentsRouter = Router();
postCommentsRouter.post(
  "/create-comment",
  requireAuth,
  writeRateLimiter,
  validate(createCommentSchema),
  asyncHandler(commentsController.create.bind(commentsController))
);

postCommentsRouter.get(
  "/:postId/comments",
  validate(listCommentsSchema),
  asyncHandler(commentsController.listTopLevel.bind(commentsController))
);

export { postCommentsRouter };
