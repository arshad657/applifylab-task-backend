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

  async remove(req: Request, res: Response): Promise<void> {
    await commentsService.deleteComment(req.params.commentId, req.user!.id);
    res.status(204).send();
  }

  async listTopLevel(req: Request, res: Response): Promise<void> {
    const comments = await commentsService.getCommentsByPostId(req.params.postId);
    ApiResponse.success(res, {
      message: "Comments retrieved successfully.",
      data: comments,
    });
  }

  async listReplies(req: Request, res: Response): Promise<void> {
    const { cursor, limit } = req.query as { cursor?: string; limit?: number };
    const result = await commentsService.listReplies(req.params.commentId, cursor, limit);
    ApiResponse.success(res, {
      message: "Replies retrieved successfully.",
      data: result.items,
      meta: {
        pagination: { nextCursor: result.nextCursor, hasMore: result.hasMore },
      },
    });
  }
}

export const commentsController = new CommentsController();
