# Social Feed Backend

A production-grade social feed API: Node.js, Express, TypeScript (strict), MongoDB via Prisma, Redis caching, JWT auth. Built to stay fast with millions of posts by avoiding the two classic feed killers — offset pagination and un-cached hot reads.

---

## 1. Architecture

```
                                   ┌────────────────────────────┐
                                   │        Client (web/app)    │
                                   └──────────────┬─────────────┘
                                                  │ HTTPS
                                   ┌──────────────▼─────────────┐
                                   │   Express app (app.ts)     │
                                   │  helmet · cors · compress  │
                                   │  pino-http · rate-limit    │
                                   └──────────────┬─────────────┘
                     ┌───────────────┬────────────┼────────────┬───────────────┐
                     ▼               ▼            ▼            ▼               ▼
                ┌─────────┐   ┌───────────┐ ┌───────────┐ ┌───────────┐  ┌───────────┐
                │  auth   │   │   users   │ │   posts   │ │ comments  │  │  feed     │
                │ module  │   │  module   │ │  module   │ │  module   │  │  module   │
                └────┬────┘   └─────┬─────┘ └─────┬─────┘ └─────┬─────┘  └─────┬─────┘
                     │              │             │             │              │
                     │        ┌─────┴─────┐ ┌─────┴─────┐ ┌─────┴─────┐        │
                     │        │  likes    │ │  storage  │ │   cache   │        │
                     │        │  module   │ │  module   │ │  module   │◄───────┘
                     │        └───────────┘ └───────────┘ └─────┬─────┘
                     │                                          │
     each module = controller → service → repository            │
                     │                                          ▼
                     ▼                                   ┌─────────────┐
              ┌─────────────┐                             │    Redis    │
              │   MongoDB   │◄────────────────────────────┤ feed p.1 +  │
              │  (Prisma)   │        cache-aside          │ post detail│
              └─────────────┘                             └─────────────┘
```

**Layering, every module:** `routes → controller → service → repository → Prisma`.
- **routes** — wire up middleware (auth, validation, rate limit) and map HTTP verbs to controller methods.
- **controllers** — thin: pull data off `req`, call the service, shape the HTTP response. No business logic.
- **services** — all business rules: ownership checks, visibility checks, counter maintenance, cache invalidation.
- **repositories** — the only layer that imports Prisma. Every query used at feed scale lives here, one method per access pattern, each one intentionally matching an index (see §4).

### Why no Prisma relations?
MongoDB has no real foreign keys or joins. Modeling `Post.author` as a Prisma relation would compile to a `$lookup`-driven fetch per row — fine at 100 posts, a serious bottleneck at 100M. Instead:
- Reference fields are plain strings (`authorId`, `postId`, `parentId`, `targetId`).
- The few author fields a feed row actually renders (`username`, `avatarUrl`) are **denormalized onto Post/Comment at write time**. Reading a feed page never touches the `users` collection.
- Counters (`likesCount`, `commentsCount`, `repliesCount`) are denormalized integers updated with atomic `$inc`, so no `COUNT()`/aggregation is ever needed to render a card.

This is a deliberate CQRS-flavored trade: writes do slightly more work (an extra `$inc`, copying two string fields) so that reads — which outnumber writes by orders of magnitude in a social feed — stay a single-collection point query.

---

## 2. Folder structure

```
social-feed-backend/
├── prisma/
│   ├── schema.prisma         # MongoDB models + indexes (see §4)
│   └── seed.ts               # 120k posts / 2k users / comments / likes
├── scripts/
│   ├── benchmark.ts          # autocannon load test (feed + post detail)
│   └── autocannon.d.ts       # minimal ambient types (no official @types)
├── src/
│   ├── config/env.ts         # Zod-validated environment config (fail-fast boot)
│   ├── lib/                  # prisma client, redis client, logger — singletons
│   ├── middleware/           # auth, validation, rate limiting, error handling
│   ├── utils/                # ApiError, asyncHandler, JWT helpers, cursor pagination
│   ├── modules/
│   │   ├── auth/             # register, login, refresh (rotation), logout
│   │   ├── users/            # public profile, update own profile
│   │   ├── posts/            # CRUD, per-user timeline, visibility rules
│   │   ├── comments/         # top-level comments + one level of replies
│   │   ├── likes/             # polymorphic like/unlike (post or comment)
│   │   ├── feed/             # public feed, cursor-paginated, cached page 1
│   │   ├── storage/           # pre-signed upload URL issuance + URL validation
│   │   └── cache/             # Redis cache-aside service + key registry
│   ├── app.ts                 # middleware & route wiring
│   └── server.ts               # boot + graceful shutdown
├── .env.example
├── package.json
└── tsconfig.json               # strict: true, plus every related strict flag
```

---

## 3. Setup

### Prerequisites
- Node.js 20+
- MongoDB **replica set** (Prisma requires this for MongoDB — a single `mongod --replSet rs0` works locally; MongoDB Atlas gives you one automatically)
- Redis 6+ (optional; app runs with in-memory rate limiting and no caching if Redis is not configured)

### Install & configure
```bash
cp .env.example .env
# edit .env: DATABASE_URL and JWT secrets are required
# Optionally set REDIS_URL to enable caching and distributed rate limiting

npm install
npx prisma generate
npx prisma db push        # syncs the schema + indexes to MongoDB (no migration files on Mongo)
```

### Run
```bash
npm run dev          # ts-node-dev, hot reload
# or
npm run build && npm start
```

### Seed 100k+ posts
```bash
npm run seed
```
Seeds 2,000 users, 120,000 posts (90% public / 10% private), comments + one level of replies on 20,000 posts, and ~300,000 likes across posts and comments — batched with `createMany` (never one insert per row).

### Benchmark
```bash
npm run dev            # in one terminal
npm run benchmark      # in another, after `npm run seed`
```
Runs `autocannon` against the public feed (page 1, cached), a deep feed page (uncached, index scan), and post detail (cached). See §6 for how to read the numbers and why this repo can't run them for you.

---

## 4. MongoDB indexes (via Prisma `@@index`)

| Collection | Index | Backs |
|---|---|---|
| `posts` | `(visibility, createdAt)` | Public feed page fetch: `WHERE visibility = PUBLIC ORDER BY createdAt DESC` |
| `posts` | `(authorId, createdAt)` | A user's own timeline / profile page |
| `comments` | `(postId, parentId, createdAt)` | Top-level comments on a post: `WHERE postId = ? AND parentId = null ORDER BY createdAt` |
| `comments` | `(parentId, createdAt)` | Replies to a specific comment |
| `likes` | unique `(userId, targetType, targetId)` | Idempotent like/unlike + "did I like this" lookup |
| `likes` | `(targetType, targetId, createdAt)` | "who liked this post/comment" |
| `users` | unique `email`, unique `username` | Login lookup, profile lookup |
| `refresh_tokens` | `(userId)`, `(expiresAt)` | Session revocation, TTL cleanup job |

Every index's leading fields mirror the repository method's `WHERE` clause exactly, and the trailing field is always the cursor sort key — this is what lets pagination be a pure index range scan.

---

## 5. Cursor pagination (never `skip`/`limit`)

`skip(n)` makes MongoDB walk and discard `n` documents before every page — O(n) per request, and it gets slow fast once a feed has more than a few thousand items. Instead:

1. Sort key is always `(createdAt DESC, id DESC)` — `id` is the tiebreaker for documents created in the same millisecond.
2. The cursor is an opaque base64 token encoding the last row's `(createdAt, id)`.
3. The next page's query is `WHERE createdAt < cursor.createdAt OR (createdAt = cursor.createdAt AND id < cursor.id)` — a direct index range scan, same cost on page 2 as on page 50,000.
4. To know if another page exists without a separate `COUNT()`, every query over-fetches `limit + 1` rows; if the extra row is present, `hasMore: true` and its `(createdAt, id)` becomes the next cursor.

See `src/utils/pagination.ts`.

---

## 6. Redis caching strategy (optional)

Redis is **optional** — if `REDIS_URL` is not set in `.env`, the app runs with in-memory rate limiting and no caching. This is suitable for development and assessment. To enable caching and distributed rate limiting, configure `REDIS_URL`.

| Cached | Key | TTL | Invalidated on |
|---|---|---|---|
| Public feed, **page 1 only** | `feed:public:first:{pageSize}` | 30s (`REDIS_CACHE_TTL_FEED_SECONDS`) | New public post created/updated/deleted |
| Post detail | `post:detail:{postId}` | 60s (`REDIS_CACHE_TTL_POST_SECONDS`) | Post edited/deleted, comment added/removed, like/unlike on that post |

Design choices:
- **Only page 1 of the feed is cached.** It's the page nearly every client requests on load, it's cheap to invalidate (one key), and deeper pages are long-tail cursor combinations where caching would mostly waste memory.
- **Cache reads fail open.** If Redis is down or a `GET` errors, `CacheService` logs a warning and falls through to MongoDB — a cache outage degrades latency, it never produces a 500.
- **Likes don't invalidate the feed cache**, only the post-detail cache for that one post — a like storm on a popular post would otherwise thrash the shared feed key.
- Pattern deletes use `SCAN`, never `KEYS`, so cache invalidation can't block Redis under load.

**Rate limiting without Redis:** If Redis is not available, rate limiting uses an in-memory store (`express-rate-limit`'s default). This is correct for single-instance deployments but not suitable for horizontally-scaled APIs where limits should be global across all instances.

---

## 7. Auth

- **Access token**: JWT, 15 minutes, `HS256`, carries `{ sub, username }`.
- **Refresh token**: JWT, 7 days, carries `{ sub, jti }`; `jti` maps to a `RefreshToken` document so any single token can be revoked without invalidating other sessions.
- Refresh tokens are **hashed before storage** (bcrypt) — a leaked database dump doesn't yield usable tokens.
- **Rotation**: every `/auth/refresh` call revokes the presented token and issues a brand new pair, so a stolen-and-replayed refresh token becomes detectable (the legitimate owner's next refresh will fail because their token was already revoked).
- Passwords are hashed with bcrypt, 12 salt rounds (`BCRYPT_SALT_ROUNDS`). **Implementation note:** this sandbox couldn't compile the native `bcrypt` package (no network access to Node's header archive), so the project ships with `bcryptjs` — a pure-JS implementation of the identical algorithm. If deploying somewhere with normal npm/build access, swapping back to native `bcrypt` is a drop-in one-line import change and gives faster hashing under heavy signup load.

---

## 8. Security & reliability middleware

- **helmet** — standard security headers.
- **cors** — locked to `CORS_ORIGIN` (comma-separate multiple origins if needed).
- **express-rate-limit + rate-limit-redis** — Redis-backed so limits hold correctly across multiple horizontally-scaled instances. Three tiers: global (`100/min` default), auth endpoints (`20/min`, brute-force resistant), write endpoints (`60/min`).
- **Zod validation** on every route (`body`/`query`/`params` in one schema).
- **Centralized error middleware** — every thrown `ApiError` or Prisma error becomes one consistent `{ error: { message, details } }` JSON response and exactly one structured log line.
- **pino** structured logging, pretty-printed in development, JSON in production (ships clean to any log aggregator).
- **Graceful shutdown** — `SIGTERM`/`SIGINT` drain in-flight requests, close the Prisma connection and Redis connection, then exit.

---

## 9. API surface

All routes are mounted under `API_PREFIX` (default `/api/v1`).

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /users/:username
PATCH  /users/me                          (auth)

POST   /posts                             (auth)
GET    /posts/:postId
PATCH  /posts/:postId                     (auth, owner only)
DELETE /posts/:postId                     (auth, owner only)
GET    /posts/by-user/:username           cursor-paginated

POST   /posts/:postId/comments            (auth)
GET    /posts/:postId/comments            cursor-paginated, top-level only
GET    /comments/:commentId/replies       cursor-paginated
DELETE /comments/:commentId               (auth, owner only)

POST   /likes/:targetType/:targetId       (auth) targetType = POST | COMMENT
DELETE /likes/:targetType/:targetId       (auth)

GET    /feed/public                       cursor-paginated, page 1 cached

POST   /storage/presign                   (auth) issue a pre-signed upload URL

GET    /health
```

Every paginated list responds with:
```json
{
  "data": [ /* items */ ],
  "pagination": { "nextCursor": "eyJjcmVh...", "hasMore": true }
}
```

---

## 10. Benchmark results

**Honesty note:** this response was generated in a sandboxed environment with an egress allowlist limited to package registries (npm/pip/crates/github) — it has no route to `binaries.prisma.sh` (Prisma's engine binary host) or to a real MongoDB/Redis server, so a live load test could not actually be executed here. What *was* verified:

- Full `npm install` and a clean `tsc --noEmit --strict` pass across the entire codebase (confirmed twice: once with a temporary type stub standing in for the Prisma-generated client to catch real bugs, once in the shipped state where the only remaining errors are the expected "client not generated" errors from the blocked engine download).
- `prisma/schema.prisma` was validated for structural correctness (indexes, field types, enum usage) against the code that queries it.

To get real numbers, run `npm run seed` then `npm run benchmark` against your own MongoDB + Redis; `scripts/benchmark.ts` uses `autocannon` (50 concurrent connections, 20s) against three paths: public feed page 1 (cache hit), a deep feed page (index scan), and post detail (cache hit). Representative shape to expect on modest hardware (a few vCPUs, MongoDB + Redis co-located, dataset from `npm run seed`) based on the design's complexity characteristics:

| Path | Expected p50 latency | Expected p99 | Notes |
|---|---|---|---|
| `GET /feed/public` (page 1, Redis hit) | ~1–3 ms | ~5–10 ms | Single Redis GET, no DB round trip |
| `GET /feed/public?cursor=...` (deep page) | ~5–15 ms | ~20–40 ms | Pure index range scan, cost independent of page depth |
| `GET /posts/:id` (Redis hit) | ~1–3 ms | ~5–10 ms | Single Redis GET |
| `GET /posts/:id` (cache miss) | ~5–10 ms | ~15–30 ms | Single indexed point query by `_id` |

These are **directional estimates based on the query plans**, not measured numbers — treat the table as "what to expect if the design is working correctly," and replace it with your own `npm run benchmark` output before using this in any capacity-planning decision.

---

## 11. Scaling notes for millions of posts / reads

- **Read replicas**: MongoDB replica set secondaries can serve feed reads (`readPreference: secondaryPreferred`) once write load grows; not wired up by default to keep local dev simple, but `prisma.ts` is the single place to add it.
- **Horizontal API scaling**: the app is fully stateless (JWTs, no server-side sessions, rate limiting in Redis) — safe to run N instances behind a load balancer.
- **Sharding**: if a single replica set outgrows itself, `posts` shards cleanly on `authorId` (co-locates a user's own timeline) while the public feed's `(visibility, createdAt)` index still works per-shard with a scatter-gather merge at the query router.
- **Counter writes under extreme like volume**: `$inc` is atomic and lock-free per document, but a single ultra-viral post can still become a write hotspot. If that becomes a real bottleneck, the next step is batching like deltas in Redis and flushing to Mongo on an interval — not implemented here to keep the like path simple and immediately consistent, which is the right default until profiling says otherwise.
