import { Router } from "express";
import { z } from "zod";
import { feedController } from "./feed.controller";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const feedQuerySchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

const router = Router();

// GET /feed/public — cursor-paginated, page 1 served from Redis cache.
router.get("/public", validate(feedQuerySchema), asyncHandler(feedController.getPublicFeed.bind(feedController)));

export default router;
