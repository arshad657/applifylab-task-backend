import { Request, Response } from "express";
import { LikeTargetType } from "@prisma/client";
import { likesService } from "./likes.service";
import { ApiResponse } from "../../utils/apiResponse";

export class LikesController {
  async likeUnlikePost(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const { like } = req.body as { like: boolean };

    let result;
    if (like) {
      result = await likesService.like(req.user!.id, LikeTargetType.POST, postId);
    } else {
      result = await likesService.unlike(req.user!.id, LikeTargetType.POST, postId);
    }

    ApiResponse.success(res, {
      message: like ? "Liked successfully." : "Unliked successfully.",
      data: result,
    });
  }

  async getPostLikers(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const users = await likesService.getLikers(LikeTargetType.POST, postId);
    ApiResponse.success(res, {
      message: "Likers retrieved successfully.",
      data: users,
    });
  }

  async likeUnlikeComment(req: Request, res: Response): Promise<void> {
    const { commentId } = req.params;
    const { like } = req.body as { like: boolean };

    let result;
    if (like) {
      result = await likesService.like(req.user!.id, LikeTargetType.COMMENT, commentId);
    } else {
      result = await likesService.unlike(req.user!.id, LikeTargetType.COMMENT, commentId);
    }

    ApiResponse.success(res, {
      message: like ? "Liked successfully." : "Unliked successfully.",
      data: result,
    });
  }

  async getCommentLikers(req: Request, res: Response): Promise<void> {
    const { commentId } = req.params;
    const users = await likesService.getLikers(LikeTargetType.COMMENT, commentId);
    ApiResponse.success(res, {
      message: "Likers retrieved successfully.",
      data: users,
    });
  }
}

export const likesController = new LikesController();
