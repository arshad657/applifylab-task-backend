import { LikeTargetType } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export class LikesRepository {
  findExisting(userId: string, targetType: LikeTargetType, targetId: string) {
    return prisma.like.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
    });
  }

  create(userId: string, targetType: LikeTargetType, targetId: string) {
    return prisma.like.create({ data: { userId, targetType, targetId } });
  }

  delete(id: string) {
    return prisma.like.delete({ where: { id } });
  }

  async findLikers(targetType: LikeTargetType, targetId: string) {
    const likes = await prisma.like.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: "desc" },
    });

    const userIds = likes.map((l) => l.userId);
    if (userIds.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    return likes
      .map((l) => userMap.get(l.userId))
      .filter((u): u is typeof users[0] => !!u);
  }
}

export const likesRepository = new LikesRepository();
