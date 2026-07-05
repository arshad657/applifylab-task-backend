import { redis } from "../../lib/redis";
import { logger } from "../../lib/logger";

/**
 * Thin cache-aside wrapper around Redis. All cache reads fail open (a Redis
 * outage degrades to "always hit the database", never to a 500), and all
 * values are stored as JSON strings.
 *
 * If Redis is not configured, all operations are no-ops (get returns null, set/del/delPattern do nothing).
 */
export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.warn({ err, key }, "Cache GET failed; falling back to source of truth");
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!redis) return;
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      logger.warn({ err, key }, "Cache SET failed; continuing without cache");
    }
  }

  async del(key: string): Promise<void> {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (err) {
      logger.warn({ err, key }, "Cache DEL failed");
    }
  }

  /** Deletes every key matching a pattern, using SCAN (never KEYS) to avoid blocking Redis. */
  async delPattern(pattern: string): Promise<void> {
    if (!redis) return;
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (err) {
      logger.warn({ err, pattern }, "Cache pattern DEL failed");
    }
  }
}

export const cacheService = new CacheService();
