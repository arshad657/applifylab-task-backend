import { env } from "../config/env";

/**
 * Cursor pagination utilities.
 *
 * We NEVER use Prisma's `skip` for feed-scale collections: `skip(n)` forces
 * MongoDB to walk and discard `n` documents on every page, which is O(n) per
 * request and gets catastrophically slow past a few thousand documents.
 *
 * Instead we paginate on a stable, indexed sort key: (createdAt DESC, id DESC).
 * The cursor is an opaque, base64-encoded token carrying the last row's
 * (createdAt, id) so the next page can be fetched with a pure index range
 * scan: `WHERE (createdAt, id) < (cursor.createdAt, cursor.id)`.
 *
 * Mongo/Prisma has no native tuple comparison, so the equivalent is expressed
 * as an OR of two conditions:
 *   createdAt < cursor.createdAt
 *   OR (createdAt == cursor.createdAt AND id < cursor.id)
 */

export interface Cursor {
  createdAt: string; // ISO date string
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(raw: string): Cursor {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf-8");
    const parsed = JSON.parse(json) as Partial<Cursor>;
    if (!parsed.createdAt || !parsed.id) {
      throw new Error("malformed cursor payload");
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new Error("Invalid pagination cursor");
  }
}

/**
 * Builds the Prisma `where` fragment for "strictly before this cursor" when
 * sorting by createdAt DESC, id DESC (the standard feed order).
 */
export function cursorWhereBefore(cursor: Cursor) {
  return {
    OR: [
      { createdAt: { lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
    ],
  };
}

export function resolvePageSize(requested?: number): number {
  if (!requested || Number.isNaN(requested) || requested <= 0) return env.DEFAULT_PAGE_SIZE;
  return Math.min(requested, env.MAX_PAGE_SIZE);
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Given `limit + 1` fetched rows (the "over-fetch by one" trick), slices off
 * the extra row and builds the next cursor, so no separate COUNT query is
 * ever needed to know whether more pages exist.
 */
export function buildPaginatedResult<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number
): PaginatedResult<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;
  return { items, nextCursor, hasMore };
}
