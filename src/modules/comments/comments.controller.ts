import { Request, Response } from "express";
import { commentsService } from "./comments.service";
import type { CreateCommentInput } from "./comments.validation";
import { ApiResponse } from "../../utils/apiResponse";

export class CommentsController {
  async add(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateCommentInput;
    const comment = await commentsService.addComment(input.postId, req.user!.id, input);
    ApiResponse.success(res, {
      code: 201,
      message: "Comment created successfully.",
      data: comment,
    });
  }

  async listComments(req: Request, res: Response): Promise<void> {
    const comments = await commentsService.getCommentsByPostId(req.params.postId, req.user?.id);
    ApiResponse.success(res, {
      message: "Comments retrieved successfully.",
      data: comments,
    });
  }
}

export const commentsController = new CommentsController();
