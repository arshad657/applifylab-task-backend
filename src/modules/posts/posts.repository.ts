import { Visibility } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { Cursor, cursorWhereBefore } from "../../utils/pagination";

export interface CreatePostData {
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  text: string;
  imageUrl?: string;
  visibility: Visibility;
}

export class PostsRepository {
  add(data: CreatePostData) {
    return prisma.post.create({ data });
  }

  findById(id: string) {
    return prisma.post.findUnique({ where: { id } });
  }

  incrementLikesCount(id: string, delta: 1 | -1) {
    return prisma.post.update({ where: { id }, data: { likesCount: { increment: delta } } });
  }

  incrementCommentsCount(id: string, delta: 1 | -1) {
    return prisma.post.update({ where: { id }, data: { commentsCount: { increment: delta } } });
  }

  /**
   * Public feed page — the hottest read path in the system.
   * Uses the (visibility, createdAt) index; sort is DESC, DESC to match
   * the cursor logic.
   */
  async findPublicFeedPage(limit: number, cursor: Cursor | null) {
    const posts = await prisma.post.findMany({
      where: {
        visibility: Visibility.PUBLIC,
        ...(cursor ? cursorWhereBefore(cursor) : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const authorIds = Array.from(new Set(posts.map((p) => p.authorId)));
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    const authorMap = new Map(authors.map((a) => [a.id, a]));

    return posts.map((post) => ({
      ...post,
      author: authorMap.get(post.authorId) || null,
    }));
  }
}

export const postsRepository = new PostsRepository();
