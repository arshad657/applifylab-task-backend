import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../lib/redis";
import { env } from "../config/env";
import { ApiResponse } from "../utils/apiResponse";

/**
 * Rate limiter: uses Redis store if available (correct across horizontally-scaled instances),
 * otherwise falls back to in-memory store (sufficient for single-instance or assessment use).
 */
function buildLimiter(windowMs: number, max: number, keyPrefix: string) {
  const store = redis
    ? new RedisStore({
        // @ts-expect-error - rate-limit-redis expects ioredis's call signature; sendCommand adapts it.
        sendCommand: (...args: string[]) => redis.call(...args),
        prefix: keyPrefix,
      })
    : undefined; // undefined = use express-rate-limit's default MemoryStore

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    handler: (_req, res) => {
      ApiResponse.error(res, {
        code: 429,
        message: "Too many requests, please try again later.",
      });
    },
  });
}

// General API traffic.
export const globalRateLimiter = buildLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX, "rl:global:");

// Tighter limit for auth endpoints (login/register/refresh) to slow down
// credential stuffing / brute force attempts.
export const authRateLimiter = buildLimiter(env.RATE_LIMIT_WINDOW_MS, 20, "rl:auth:");

// Write-heavy endpoints (create post/comment, like/unlike) get their own
// bucket so a burst of likes can't starve read traffic's quota or vice versa.
export const writeRateLimiter = buildLimiter(env.RATE_LIMIT_WINDOW_MS, 60, "rl:write:");
