import { Router } from "express";
import { postsController } from "./posts.controller";
import { commentsController } from "../comments/comments.controller";
import { likesController } from "../likes/likes.controller";
import {
  createPostSchema,
  postIdParamSchema,
  getAllPostsSchema,
  likeUnlikePostSchema,
} from "./posts.validation";
import { createCommentSchema, listCommentsSchema } from "../comments/comments.validation";
import { validate } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { writeRateLimiter } from "../../middleware/rateLimiter.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { multerFileFilter } from "../../utils/multerFilter";
import multer from "multer";
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: multerFileFilter,
});

// Router for /posts
const router = Router();

router.get("/get-all", requireAuth, validate(getAllPostsSchema), asyncHandler(postsController.getAllPosts.bind(postsController)));
router.post("/add", requireAuth, writeRateLimiter, validate(createPostSchema), asyncHandler(postsController.add.bind(postsController)));
router.post(
  "/upload",
  requireAuth,
  upload.single("image"),
  asyncHandler(postsController.uploadImage.bind(postsController))
);


// Router for /post
const postRouter = Router();

postRouter.post(
  "/add-comment",
  requireAuth,
  writeRateLimiter,
  validate(createCommentSchema),
  asyncHandler(commentsController.add.bind(commentsController))
);

postRouter.get(
  "/:postId/get-comments",
  requireAuth,
  validate(listCommentsSchema),
  asyncHandler(commentsController.listComments.bind(commentsController))
);

postRouter.get(
  "/:postId/get-likes",
  validate(postIdParamSchema),
  asyncHandler(likesController.getPostLikers.bind(likesController))
);

postRouter.post(
  "/:postId/like-unlike",
  requireAuth,
  writeRateLimiter,
  validate(likeUnlikePostSchema),
  asyncHandler(likesController.likeUnlikePost.bind(likesController))
);

export { postRouter };
export default router;
