import { postsRepository } from "../posts/posts.repository";
import { PostDTO } from "../posts/posts.service";
import { buildPaginatedResult, decodeCursor, PaginatedResult, resolvePageSize } from "../../utils/pagination";
import { cacheService } from "../cache/cache.service";
import { CacheKeys } from "../cache/cache.keys";
import { env } from "../../config/env";

/**
 * The public feed is read far more often than it's written to (classic
 * social-feed access pattern), which is exactly the shape Redis caching is
 * built for. Only page 1 — no cursor, default page size — is cached:
 *   - it's the page nearly every client requests on load/refresh
 *   - it's small and cheap to invalidate (a handful of writes touch it)
 *   - deeper pages are long-tail traffic where a cache miss cost is fine and
 *     caching them would mostly waste memory on rarely-repeated cursors.
 */
export class FeedService {
  async getPublicFeed(rawCursor: string | undefined, rawLimit: number | undefined): Promise<PaginatedResult<PostDTO>> {
    const limit = resolvePageSize(rawLimit);
    const isFirstPage = !rawCursor && limit === env.DEFAULT_PAGE_SIZE;
    console.log("Logging; ", rawCursor, rawLimit)
    if (isFirstPage) {
      const cacheKey = CacheKeys.publicFeedFirstPage(limit);
      const cached = await cacheService.get<PaginatedResult<PostDTO>>(cacheKey);
      if (cached) return cached;

      const rows = await postsRepository.findPublicFeedPage(limit, null);
      const result = buildPaginatedResult(rows, limit);
      await cacheService.set(cacheKey, result, env.REDIS_CACHE_TTL_FEED_SECONDS);
      return result;
    }

    const cursor = rawCursor ? decodeCursor(rawCursor) : null;
    const rows = await postsRepository.findPublicFeedPage(limit, cursor);
    return buildPaginatedResult(rows, limit);
  }
}

export const feedService = new FeedService();
