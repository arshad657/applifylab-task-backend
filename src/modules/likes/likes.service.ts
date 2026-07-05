import { LikeTargetType } from "@prisma/client";
import { ApiError } from "../../utils/apiError";
import { likesRepository } from "./likes.repository";
import { postsRepository } from "../posts/posts.repository";
import { commentsRepository } from "../comments/comments.repository";
import { cacheService } from "../cache/cache.service";
import { CacheKeys } from "../cache/cache.keys";

/**
 * Likes are idempotent by design: liking an already-liked target or
 * unliking an already-unliked target is a no-op success, not an error.
 * This matches client UX (double-tap / rapid toggling) and avoids racy
 * error handling on the frontend.
 *
 * likesCount is a denormalized counter on the target document, updated with
 * an atomic `$inc`, so counting likes for the feed/detail view never
 * requires a COUNT() aggregation over the likes collection.
 */
export class LikesService {
  async like(userId: string, targetType: LikeTargetType, targetId: string): Promise<{ liked: true }> {
    await this.assertTargetExists(targetType, targetId);

    const existing = await likesRepository.findExisting(userId, targetType, targetId);
    if (existing) return { liked: true };

    try {
      await likesRepository.create(userId, targetType, targetId);
    } catch (err) {
      // Unique index race: two concurrent "like" requests from the same user.
      // The loser of the race hits P2002; treat it as success (idempotent).
      if (!isUniqueConstraintError(err)) throw err;
      return { liked: true };
    }

    await this.applyCountDelta(targetType, targetId, 1);
    return { liked: true };
  }

  async unlike(userId: string, targetType: LikeTargetType, targetId: string): Promise<{ liked: false }> {
    const existing = await likesRepository.findExisting(userId, targetType, targetId);
    if (!existing) return { liked: false };

    await likesRepository.delete(existing.id);
    await this.applyCountDelta(targetType, targetId, -1);
    return { liked: false };
  }

  private async assertTargetExists(targetType: LikeTargetType, targetId: string): Promise<void> {
    if (targetType === LikeTargetType.POST) {
      const post = await postsRepository.findById(targetId);
      if (!post) throw ApiError.notFound("Post not found");
    } else {
      const comment = await commentsRepository.findById(targetId);
      if (!comment) throw ApiError.notFound("Comment not found");
    }
  }

  private async applyCountDelta(targetType: LikeTargetType, targetId: string, delta: 1 | -1): Promise<void> {
    if (targetType === LikeTargetType.POST) {
      await postsRepository.incrementLikesCount(targetId, delta);
      await cacheService.del(CacheKeys.postDetail(targetId));
    } else {
      await commentsRepository.incrementLikesCount(targetId, delta);
    }
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";
}

export const likesService = new LikesService();
