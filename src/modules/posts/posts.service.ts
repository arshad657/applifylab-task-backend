import { Visibility } from "@prisma/client";
import { ApiError } from "../../utils/apiError";
import { buildPaginatedResult, decodeCursor, PaginatedResult, resolvePageSize } from "../../utils/pagination";
import { postsRepository } from "./posts.repository";
import { usersRepository } from "../users/users.repository";
import { cacheService } from "../cache/cache.service";
import { CacheKeys } from "../cache/cache.keys";
import { env } from "../../config/env";
import type { CreatePostInput, UpdatePostInput } from "./posts.validation";

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
  async createPost(userId: string, input: CreatePostInput): Promise<PostDTO> {
    console.log("userId: ", userId)
    const author = await usersRepository.findById(userId);
    if (!author) throw ApiError.notFound("Author not found");

    const post = await postsRepository.create({
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

  async getPostById(postId: string, requesterId?: string): Promise<PostDTO> {
    const cacheKey = CacheKeys.postDetail(postId);
    const cached = await cacheService.get<PostDTO>(cacheKey);
    const post = cached ?? (await postsRepository.findById(postId));

    if (!post) throw ApiError.notFound("Post not found");

    if (post.visibility === Visibility.PRIVATE && post.authorId !== requesterId) {
      throw ApiError.forbidden("This post is private");
    }

    if (!cached) {
      await cacheService.set(cacheKey, post, env.REDIS_CACHE_TTL_POST_SECONDS);
    }

    return toDTO(post);
  }

  async updatePost(postId: string, userId: string, input: UpdatePostInput): Promise<PostDTO> {
    const existing = await postsRepository.findById(postId);
    if (!existing) throw ApiError.notFound("Post not found");
    if (existing.authorId !== userId) throw ApiError.forbidden("You can only edit your own posts");

    const updated = await postsRepository.update(postId, input);

    await cacheService.del(CacheKeys.postDetail(postId));
    if (existing.visibility === Visibility.PUBLIC || updated.visibility === Visibility.PUBLIC) {
      await cacheService.del(CacheKeys.publicFeedFirstPage(env.DEFAULT_PAGE_SIZE));
    }

    return toDTO(updated);
  }

  async deletePost(postId: string, userId: string): Promise<void> {
    const existing = await postsRepository.findById(postId);
    if (!existing) throw ApiError.notFound("Post not found");
    if (existing.authorId !== userId) throw ApiError.forbidden("You can only delete your own posts");

    await postsRepository.delete(postId);
    await cacheService.del(CacheKeys.postDetail(postId));
    if (existing.visibility === Visibility.PUBLIC) {
      await cacheService.del(CacheKeys.publicFeedFirstPage(env.DEFAULT_PAGE_SIZE));
    }
  }

  async listUserPosts(
    username: string,
    requesterId: string | undefined,
    rawCursor: string | undefined,
    rawLimit: number | undefined
  ): Promise<PaginatedResult<PostDTO>> {
    const author = await usersRepository.findByUsername(username);
    if (!author) throw ApiError.notFound("User not found");

    const includePrivate = requesterId === author.id;
    const limit = resolvePageSize(rawLimit);
    const cursor = rawCursor ? decodeCursor(rawCursor) : null;

    const rows = await postsRepository.findUserPostsPage(author.id, includePrivate, limit, cursor);
    return buildPaginatedResult(rows, limit);
  }
}

export const postsService = new PostsService();
