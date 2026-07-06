import Redis from "ioredis";
import { env } from "../config/env";

/**
 * Single ioredis connection reused for caching, the rate-limiting store,
 * and any future pub/sub needs.
 *
 * Redis is OPTIONAL — if REDIS_URL is not set, redis will be null and the app
 * will run with in-memory rate limiting and no caching. This allows the app to
 * function for assessment/development purposes without requiring Redis infrastructure.
 */
export const redis: Redis | null = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    })
  : null;

if (redis) {
  redis.on("error", (err) => console.warn("Redis connection error; caching and distributed rate limiting disabled", err));
  redis.on("connect", () => console.log("Redis connected"));
  redis.connect().catch((err) => {
    console.warn("Failed to connect to Redis on startup; app will run without caching", err);
  });
}
