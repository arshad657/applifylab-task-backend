import { Request, Response } from "express";
import { postsService } from "./posts.service";
import type { CreatePostInput } from "./posts.validation";
import { ApiResponse } from "../../utils/apiResponse";
import { ApiError } from "../../utils/apiError";

export class PostsController {
  async add(req: Request, res: Response): Promise<void> {
    const post = await postsService.addPost(req.user!.id, req.body as CreatePostInput);
    ApiResponse.success(res, {
      code: 201,
      message: "Post created successfully.",
      data: post,
    });
  }

  async uploadImage(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw ApiError.badRequest("No file uploaded");
    }
    const result = await postsService.uploadImage(req.file);
    ApiResponse.success(res, {
      message: "File uploaded successfully",
      data: { url: result.url, publicId: result.publicId },
    });
  }

  async getAllPosts(req: Request, res: Response): Promise<void> {
    const { cursor, limit } = req.query as { cursor?: string; limit?: number };
    const result = await postsService.getAllPosts(cursor, limit, req.user?.id);
    ApiResponse.success(res, {
      message: "Posts retrieved successfully.",
      data: result.items,
      meta: {
        pagination: { nextCursor: result.nextCursor, hasMore: result.hasMore },
      },
    });
  }
}

export const postsController = new PostsController();
