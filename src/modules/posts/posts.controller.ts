import { Request, Response } from "express";
import { postsService } from "./posts.service";
import type { CreatePostInput, UpdatePostInput } from "./posts.validation";
import { ApiResponse } from "../../utils/apiResponse";

export class PostsController {
  async create(req: Request, res: Response): Promise<void> {
    const post = await postsService.createPost(req.user!.id, req.body as CreatePostInput);
    ApiResponse.success(res, {
      code: 201,
      message: "Post created successfully.",
      data: post,
    });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const post = await postsService.getPostById(req.params.postId, req.user?.id);
    ApiResponse.success(res, {
      message: "Post retrieved successfully.",
      data: post,
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const post = await postsService.updatePost(req.params.postId, req.user!.id, req.body as UpdatePostInput);
    ApiResponse.success(res, {
      message: "Post updated successfully.",
      data: post,
    });
  }

  async remove(req: Request, res: Response): Promise<void> {
    await postsService.deletePost(req.params.postId, req.user!.id);
    res.status(204).send();
  }

  async listByUser(req: Request, res: Response): Promise<void> {
    const { username } = req.params;
    const { cursor, limit } = req.query as { cursor?: string; limit?: number };
    const result = await postsService.listUserPosts(username, req.user?.id, cursor, limit);
    ApiResponse.success(res, {
      message: "User posts retrieved successfully.",
      data: result.items,
      meta: {
        pagination: { nextCursor: result.nextCursor, hasMore: result.hasMore },
      },
    });
  }
}

export const postsController = new PostsController();
