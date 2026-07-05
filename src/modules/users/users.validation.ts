import { z } from "zod";

export const getUserByUsernameSchema = z.object({
  params: z.object({ username: z.string().min(1) }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const updateProfileSchema = z.object({
  body: z.object({
    bio: z.string().max(280).optional(),
    avatarUrl: z.string().url().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
