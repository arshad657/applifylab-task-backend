import { Router } from "express";
import { commentsController } from "./comments.controller";
import {
  commentIdParamSchema,
  createCommentSchema,
  listCommentsSchema,
  listRepliesSchema,
} from "./comments.validation";
import { validate } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { writeRateLimiter } from "../../middleware/rateLimiter.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

// Mounted twice, at two different paths, from the central router (see app.ts):
//   /posts/:postId/comments        -> create + list top-level comments
//   /comments/:commentId/replies   -> list replies / delete a comment
const postCommentsRouter = Router({ mergeParams: true });
postCommentsRouter.post(
  "/",
  requireAuth,
  writeRateLimiter,
  validate(createCommentSchema),
  asyncHandler(commentsController.create.bind(commentsController))
);
postCommentsRouter.get("/", validate(listCommentsSchema), asyncHandler(commentsController.listTopLevel.bind(commentsController)));

const commentRouter = Router();
commentRouter.get(
  "/:commentId/replies",
  validate(listRepliesSchema),
  asyncHandler(commentsController.listReplies.bind(commentsController))
);
commentRouter.delete(
  "/:commentId",
  requireAuth,
  validate(commentIdParamSchema),
  asyncHandler(commentsController.remove.bind(commentsController))
);

export { postCommentsRouter, commentRouter };
