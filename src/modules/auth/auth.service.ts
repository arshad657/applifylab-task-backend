import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../utils/apiError";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import type { LoginInput, RegisterInput } from "./auth.validation";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

function toPublicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
  };
}

/** Hashes a refresh token before storing it, so a leaked DB never yields usable tokens. */
function hashToken(token: string): string {
  return bcrypt.hashSync(token, 10);
}

export class AuthService {
  async register(input: RegisterInput): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const existing = await prisma.user.findFirst({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.conflict("Email already in use");
    }
    console.log("hitting: ", input);
    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash,
        },
      });

      const tokens = await this.issueTokens(user.id, user.email, tx);
      return { user: toPublicUser(user), tokens };
    });
  }

  async login(input: LoginInput): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw ApiError.unauthorized("Invalid email or password");
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized("Invalid email or password");
    }
    const tokens = await this.issueTokens(user.id, user.email);
    return { user: toPublicUser(user), tokens };
  }

  /** Issues a fresh access + refresh token pair and persists the refresh token (hashed). */
  private async issueTokens(
    userId: string,
    usermail: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<AuthTokens> {
    const jti = uuid();
    const refreshToken = signRefreshToken({ sub: userId, jti });
    const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN));

    await tx.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt,
      },
    });

    const accessToken = signAccessToken({ sub: userId, email: usermail });
    return { accessToken, refreshToken };
  }

  /** Rotates a refresh token: verifies it, revokes the old one, issues a new pair. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }

    const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw ApiError.unauthorized("Refresh token has been revoked or expired");
    }

    const matches = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!matches) {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      throw ApiError.unauthorized("User no longer exists");
    }

    // Rotate: revoke the used token so it can't be replayed, then issue a new pair.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    const username = `${user.firstName.toLowerCase()}_${user.lastName.toLowerCase()}`;
    return this.issueTokens(user.id, username);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await prisma.refreshToken.updateMany({ where: { id: payload.jti }, data: { revoked: true } });
    } catch {
      // Already invalid/expired — logging out is idempotent either way.
    }
  }
}

function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // fallback: 7 days
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (unitMs[unit] ?? 86_400_000);
}

export const authService = new AuthService();
