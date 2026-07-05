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
}

export const likesRepository = new LikesRepository();
