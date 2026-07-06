import { prisma } from "../../lib/prisma";
import type { UpdateProfileInput } from "./users.validation";

export class UsersRepository {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  findByUsername(username: string) {
    // username is in format "firstName_lastName", parse it to find the user
    const parts = username.split('_');
    if (parts.length < 2) return null;
    const firstName = decodeURIComponent(parts[0]);
    const lastName = decodeURIComponent(parts.slice(1).join('_'));
    return prisma.user.findFirst({
      where: {
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: { equals: lastName, mode: 'insensitive' },
      },
    });
  }

  async updateProfile(id: string, data: UpdateProfileInput) {
    const user = await prisma.user.update({ where: { id }, data });
    return user;
  }
}

export const usersRepository = new UsersRepository();
