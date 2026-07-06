import { prisma } from "../../lib/prisma";
import { Cursor, cursorWhereBefore } from "../../utils/pagination";

export interface CreateCommentData {
  postId: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  parentId: string | null;
  depth: number;
  text: string;
}

export class CommentsRepository {
  create(data: CreateCommentData) {
    return prisma.comment.create({ data });
  }

  findById(id: string) {
    return prisma.comment.findUnique({ where: { id } });
  }

  findByPostId(postId: string) {
    return prisma.comment.findMany({
      where: { postId },
      orderBy: [{ createdAt: "asc" }],
    });
  }

  delete(id: string) {
    return prisma.comment.delete({ where: { id } });
  }

  incrementLikesCount(id: string, delta: 1 | -1) {
    return prisma.comment.update({ where: { id }, data: { likesCount: { increment: delta } } });
  }

  incrementRepliesCount(id: string, delta: 1 | -1) {
    return prisma.comment.update({ where: { id }, data: { repliesCount: { increment: delta } } });
  }

  /** Top-level comments on a post. Uses the (postId, parentId, createdAt) index. */
  findTopLevelPage(postId: string, limit: number, cursor: Cursor | null) {
    return prisma.comment.findMany({
      where: {
        postId,
        parentId: null,
        ...(cursor ? cursorWhereBefore(cursor) : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
  }

  /** Replies to a specific comment. Uses the (parentId, createdAt) index. */
  findRepliesPage(parentId: string, limit: number, cursor: Cursor | null) {
    return prisma.comment.findMany({
      where: {
        parentId,
        ...(cursor ? cursorWhereBefore(cursor) : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
  }
}

export const commentsRepository = new CommentsRepository();
