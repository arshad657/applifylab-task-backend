import { prisma } from "../../lib/prisma";

export interface CreateCommentData {
  postId: string;
  authorId: string;
  parentId: string | null;
  depth: number;
  text: string;
}

export class CommentsRepository {
  add(data: CreateCommentData) {
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

  incrementLikesCount(id: string, delta: 1 | -1) {
    return prisma.comment.update({ where: { id }, data: { likesCount: { increment: delta } } });
  }
}

export const commentsRepository = new CommentsRepository();
