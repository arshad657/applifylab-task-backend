import { Request, Response } from "express";
import { feedService } from "./feed.service";
import { ApiResponse } from "../../utils/apiResponse";

export class FeedController {
  async getPublicFeed(req: Request, res: Response): Promise<void> {
    const { cursor, limit } = req.query as { cursor?: string; limit?: number };
    const result = await feedService.getPublicFeed(cursor, limit);
    ApiResponse.success(res, {
      message: "Public feed retrieved successfully.",
      data: result.items,
      meta: {
        pagination: { nextCursor: result.nextCursor, hasMore: result.hasMore },
      },
    });
  }
}

export const feedController = new FeedController();
