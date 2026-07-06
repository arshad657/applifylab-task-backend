import { z } from "zod";

export const createCommentSchema = z.object({
  body: z.object({
    postId: z.string().min(1),
    text: z.string().min(1).max(1000),
    parentId: z.string().min(1).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const listCommentsSchema = z.object({
  params: z.object({ postId: z.string().min(1) }),
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
  }),
  body: z.object({}).optional(),
});

export const listRepliesSchema = z.object({
  params: z.object({ commentId: z.string().min(1) }),
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
  }),
  body: z.object({}).optional(),
});

export const commentIdParamSchema = z.object({
  params: z.object({ commentId: z.string().min(1) }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>["body"];
