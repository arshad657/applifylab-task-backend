import { ApiError } from "../../utils/apiError";
import { usersRepository } from "./users.repository";
import type { UpdateProfileInput } from "./users.validation";

export interface PublicProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
}

function toPublicProfile(user: {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
}): PublicProfile {
  const { id, firstName, lastName, avatarUrl, bio, createdAt } = user;
  return { id, firstName, lastName, avatarUrl, bio, createdAt };
}

export class UsersService {
  async getByUsername(username: string): Promise<PublicProfile> {
    const user = await usersRepository.findByUsername(username);
    if (!user) throw ApiError.notFound("User not found");
    return toPublicProfile(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicProfile> {
    const user = await usersRepository.updateProfile(userId, input);
    return toPublicProfile(user);
  }
}

export const usersService = new UsersService();
