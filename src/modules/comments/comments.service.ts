import { ApiError } from "../../utils/apiError";

import { commentsRepository } from "./comments.repository";
import { postsRepository } from "../posts/posts.repository";
import { usersRepository } from "../users/users.repository";
import { cacheService } from "../cache/cache.service";
import { CacheKeys } from "../cache/cache.keys";
import type { CreateCommentInput } from "./comments.validation";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";

export interface CommentDTO {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  depth: number;
  text: string;
  likesCount: number;
  createdAt: Date;
  updatedAt: Date;
  likedByUser?: boolean;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
}

// Nested replies are supported 5 levels depth by default (comment -> reply),
const MAX_REPLY_DEPTH = 5;

export class CommentsService {
  async addComment(postId: string, userId: string, input: CreateCommentInput): Promise<CommentDTO> {
    const post = await postsRepository.findById(postId);
    if (!post) throw ApiError.notFound("Post not found");

    const author = await usersRepository.findById(userId);
    if (!author) throw ApiError.notFound("Author not found");

    let parent: Awaited<ReturnType<typeof commentsRepository.findById>> = null;
    let depth = 0;

    if (input.parentId) {
      parent = await commentsRepository.findById(input.parentId);
      if (!parent || parent.postId !== postId) {
        throw ApiError.notFound("Parent comment not found on this post");
      }
      if (parent.depth >= MAX_REPLY_DEPTH) {
        throw ApiError.badRequest(`Replies are only supported ${MAX_REPLY_DEPTH} level deep`);
      }
      depth = parent.depth + 1;
    }

    const comment = await commentsRepository.add({
      postId,
      authorId: userId,
      parentId: input.parentId ?? null,
      depth,
      text: input.text,
    });

    await postsRepository.incrementCommentsCount(postId, 1);

    // Comment counts are embedded in the cached post detail payload and public feed
    // so they must be invalidated whenever commentsCount changes.
    await cacheService.del(CacheKeys.postDetail(postId));
    await cacheService.del(CacheKeys.publicFeedFirstPage(env.DEFAULT_PAGE_SIZE));

    return comment;
  }

  async getCommentsByPostId(postId: string, userId?: string): Promise<(CommentDTO & { likedByUser: boolean })[]> {
    const post = await postsRepository.findById(postId);
    if (!post) throw ApiError.notFound("Post not found");
    const comments = await commentsRepository.findByPostId(postId);

    let likedCommentIds = new Set<string>();

    if (userId && comments.length > 0) {
      const commentIds = comments.map((c) => c.id);
      const userLikes = await prisma.like.findMany({
        where: {
          userId,
          targetType: "COMMENT",
          targetId: { in: commentIds },
        },
        select: { targetId: true },
      });
      likedCommentIds = new Set(userLikes.map((l) => l.targetId));
    }

    // Batch query comment author profiles
    let authorMap = new Map<string, { id: string; firstName: string; lastName: string; avatarUrl: string | null }>();
    if (comments.length > 0) {
      const authorIds = Array.from(new Set(comments.map((c) => c.authorId)));
      const authors = await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      });
      authorMap = new Map(authors.map((a) => [a.id, a]));
    }

    return comments.map((c) => ({
      ...c,
      likedByUser: likedCommentIds.has(c.id),
      author: authorMap.get(c.authorId) || null,
    }));
  }
}

export const commentsService = new CommentsService();
