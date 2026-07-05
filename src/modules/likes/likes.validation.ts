import { z } from "zod";

export const targetTypeSchema = z.enum(["POST", "COMMENT"]);

export const likeTargetSchema = z.object({
  params: z.object({
    targetType: targetTypeSchema,
    targetId: z.string().min(1),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});
