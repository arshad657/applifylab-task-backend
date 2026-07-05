/**
 * Central registry of Redis key builders. Keeping them in one place avoids
 * key-format drift between the code that writes a cache entry and the code
 * that invalidates it.
 */
export const CacheKeys = {
  /** Page 1 of the public feed — the single hottest read in the system. */
  publicFeedFirstPage: (pageSize: number): string => `feed:public:first:${pageSize}`,

  /** A single post's detail payload. */
  postDetail: (postId: string): string => `post:detail:${postId}`,

  /** Pattern used to invalidate every cached post-detail variant, if needed. */
  postDetailPattern: (postId: string): string => `post:detail:${postId}*`,
};
