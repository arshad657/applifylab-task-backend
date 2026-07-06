import { Visibility } from "@prisma/client";
import { ApiError } from "../../utils/apiError";
import { buildPaginatedResult, decodeCursor, PaginatedResult, resolvePageSize } from "../../utils/pagination";
import { postsRepository } from "./posts.repository";
import { usersRepository } from "../users/users.repository";
import { cacheService } from "../cache/cache.service";
import { CacheKeys } from "../cache/cache.keys";
import { env } from "../../config/env";
import type { CreatePostInput } from "./posts.validation";
import { cloudinary } from "../../config/cloudinary";
import fs from "fs";
import { prisma } from "../../lib/prisma";

export interface PostDTO {
  id: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  text: string;
  imageUrl: string | null;
  visibility: Visibility;
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
  isLIkedByUser?: boolean;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
}

function toDTO(post: PostDTO): PostDTO {
  return post;
}

export class PostsService {
  async addPost(userId: string, input: CreatePostInput): Promise<PostDTO> {
    console.log("userId: ", userId)
    const author = await usersRepository.findById(userId);
    if (!author) throw ApiError.notFound("Author not found");

    const post = await postsRepository.add({
      authorId: userId,
      authorUsername: `${author.firstName} ${author.lastName}`,
      authorAvatarUrl: author.avatarUrl,
      text: input.text,
      imageUrl: input.imageUrl,
      visibility: input.visibility,
    });

    // A new public post changes what page 1 of the feed looks like.
    if (post.visibility === Visibility.PUBLIC) {
      await cacheService.del(CacheKeys.publicFeedFirstPage(env.DEFAULT_PAGE_SIZE));
    }

    return toDTO(post);
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      await fs.promises.unlink(file.path).catch(() => {});
      throw ApiError.internal("Cloudinary is not configured on the server");
    }

    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "uploads",
      });
      return result.secure_url;
    } catch (error: any) {
      throw ApiError.internal(`Failed to upload image to Cloudinary: ${error.message}`);
    } finally {
      await fs.promises.unlink(file.path).catch(() => {});
    }
  }

  async getAllPosts(
    rawCursor: string | undefined,
    rawLimit: number | undefined,
    userId?: string
  ): Promise<PaginatedResult<PostDTO & { isLIkedByUser: boolean }>> {
    const limit = resolvePageSize(rawLimit);
    const isFirstPage = !rawCursor && limit === env.DEFAULT_PAGE_SIZE;

    let result: PaginatedResult<PostDTO>;

    if (isFirstPage) {
      const cacheKey = CacheKeys.publicFeedFirstPage(limit);
      const cached = await cacheService.get<PaginatedResult<PostDTO>>(cacheKey);
      if (cached) {
        result = cached;
      } else {
        const rows = await postsRepository.findPublicFeedPage(limit, null);
        result = buildPaginatedResult(rows, limit);
        await cacheService.set(cacheKey, result, env.REDIS_CACHE_TTL_FEED_SECONDS);
      }
    } else {
      const cursor = rawCursor ? decodeCursor(rawCursor) : null;
      const rows = await postsRepository.findPublicFeedPage(limit, cursor);
      result = buildPaginatedResult(rows, limit);
    }

    let likedPostIds = new Set<string>();
    if (userId && result.items.length > 0) {
      const postIds = result.items.map((p) => p.id);
      const userLikes = await prisma.like.findMany({
        where: {
          userId,
          targetType: "POST",
          targetId: { in: postIds },
        },
        select: { targetId: true },
      });
      likedPostIds = new Set(userLikes.map((l) => l.targetId));
    }

    const itemsWithLikeStatus = result.items.map((post) => ({
      ...post,
      isLIkedByUser: likedPostIds.has(post.id),
    }));

    return {
      ...result,
      items: itemsWithLikeStatus,
    };
  }
}

export const postsService = new PostsService();
