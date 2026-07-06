import { z } from "zod";
import { Visibility } from "@prisma/client";

// Tied directly to Prisma's generated Visibility enum (single source of
// truth) rather than a hand-duplicated string union, so validated input and
// the database enum type can never drift apart.
const visibilitySchema = z.nativeEnum(Visibility);

export const createPostSchema = z.object({
  body: z.object({
    text: z.string().max(2000).optional().default(""),
    imageUrl: z.string().url().optional(),
    visibility: visibilitySchema.default(Visibility.PUBLIC),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});


export const updatePostSchema = z.object({
  body: z.object({
    text: z.string().max(2000).optional(),
    imageUrl: z.string().url().optional(),
    visibility: visibilitySchema.optional(),
  }),
  params: z.object({ postId: z.string().min(1) }),
  query: z.object({}).optional(),
});

export const postIdParamSchema = z.object({
  params: z.object({ postId: z.string().min(1) }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const listUserPostsSchema = z.object({
  params: z.object({ username: z.string().min(1) }),
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
  }),
  body: z.object({}).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>["body"];
export type UpdatePostInput = z.infer<typeof updatePostSchema>["body"];
