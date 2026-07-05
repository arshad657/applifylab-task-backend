import { Request, Response } from "express";
import { LikeTargetType } from "@prisma/client";
import { likesService } from "./likes.service";
import { ApiResponse } from "../../utils/apiResponse";

export class LikesController {
  async like(req: Request, res: Response): Promise<void> {
    const { targetType, targetId } = req.params as { targetType: LikeTargetType; targetId: string };
    const result = await likesService.like(req.user!.id, targetType, targetId);
    ApiResponse.success(res, {
      message: "Liked successfully.",
      data: result,
    });
  }

  async unlike(req: Request, res: Response): Promise<void> {
    const { targetType, targetId } = req.params as { targetType: LikeTargetType; targetId: string };
    const result = await likesService.unlike(req.user!.id, targetType, targetId);
    ApiResponse.success(res, {
      message: "Unliked successfully.",
      data: result,
    });
  }
}

export const likesController = new LikesController();
