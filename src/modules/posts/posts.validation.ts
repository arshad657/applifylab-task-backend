import { z } from "zod";

export const createPostSchema = z.object({
  body: z.object({
    text: z.string().max(2000).optional().default(""),
    imageUrl: z.string().url().optional(),
    imagePublicId: z.string().optional(),
    isPublic: z.boolean().optional().default(true),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const postIdParamSchema = z.object({
  params: z.object({ postId: z.string().min(1) }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const likeUnlikePostSchema = z.object({
  params: z.object({ postId: z.string().min(1) }),
  body: z.object({
    like: z.boolean(),
  }),
  query: z.object({}).optional(),
});

export const getAllPostsSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>["body"];
