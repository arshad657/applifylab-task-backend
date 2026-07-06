import { ApiError } from "../../utils/apiError";
import { buildPaginatedResult, decodeCursor, PaginatedResult, resolvePageSize } from "../../utils/pagination";
import { commentsRepository } from "./comments.repository";
import { postsRepository } from "../posts/posts.repository";
import { usersRepository } from "../users/users.repository";
import { cacheService } from "../cache/cache.service";
import { CacheKeys } from "../cache/cache.keys";
import type { CreateCommentInput } from "./comments.validation";
import { env } from "../../config/env";

export interface CommentDTO {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  parentId: string | null;
  depth: number;
  text: string;
  likesCount: number;
  repliesCount: number;
  createdAt: Date;
  updatedAt: Date;
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
      authorUsername: `${author.firstName} ${author.lastName}`,
      authorAvatarUrl: author.avatarUrl,
      parentId: input.parentId ?? null,
      depth,
      text: input.text,
    });

    if (parent) {
      await commentsRepository.incrementRepliesCount(parent.id, 1);
    }
    await postsRepository.incrementCommentsCount(postId, 1);

    // Comment counts are embedded in the cached post detail payload and public feed
    // so they must be invalidated whenever commentsCount changes.
    await cacheService.del(CacheKeys.postDetail(postId));
    await cacheService.del(CacheKeys.publicFeedFirstPage(env.DEFAULT_PAGE_SIZE));

    return comment;
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await commentsRepository.findById(commentId);
    if (!comment) throw ApiError.notFound("Comment not found");
    if (comment.authorId !== userId) throw ApiError.forbidden("You can only delete your own comments");

    await commentsRepository.delete(commentId);

    if (comment.parentId) {
      await commentsRepository.incrementRepliesCount(comment.parentId, -1);
    }
    await postsRepository.incrementCommentsCount(comment.postId, -1);

    await cacheService.del(CacheKeys.postDetail(comment.postId));
    await cacheService.del(CacheKeys.publicFeedFirstPage(env.DEFAULT_PAGE_SIZE));
  }

  async listTopLevel(postId: string, rawCursor?: string, rawLimit?: number): Promise<PaginatedResult<CommentDTO>> {
    const limit = resolvePageSize(rawLimit);
    const cursor = rawCursor ? decodeCursor(rawCursor) : null;
    const rows = await commentsRepository.findTopLevelPage(postId, limit, cursor);
    return buildPaginatedResult(rows, limit);
  }

  async listReplies(commentId: string, rawCursor?: string, rawLimit?: number): Promise<PaginatedResult<CommentDTO>> {
    const limit = resolvePageSize(rawLimit);
    const cursor = rawCursor ? decodeCursor(rawCursor) : null;
    const rows = await commentsRepository.findRepliesPage(commentId, limit, cursor);
    return buildPaginatedResult(rows, limit);
  }

  async getCommentsByPostId(postId: string): Promise<CommentDTO[]> {
    const post = await postsRepository.findById(postId);
    if (!post) throw ApiError.notFound("Post not found");
    return commentsRepository.findByPostId(postId);
  }
}

export const commentsService = new CommentsService();
