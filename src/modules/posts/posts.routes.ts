import { Router } from "express";
import { postsController } from "./posts.controller";
import { createPostSchema, listUserPostsSchema, postIdParamSchema, updatePostSchema } from "./posts.validation";
import { validate } from "../../middleware/validate.middleware";
import { optionalAuth, requireAuth } from "../../middleware/auth.middleware";
import { writeRateLimiter } from "../../middleware/rateLimiter.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { multerFileFilter } from "../../utils/multerFilter";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const uploadDir = path.join(__dirname, "../../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: multerFileFilter,
});

const router = Router();

router.post(
  "/upload",
  requireAuth,
  upload.single("image"),
  asyncHandler(postsController.uploadImage.bind(postsController))
);

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
