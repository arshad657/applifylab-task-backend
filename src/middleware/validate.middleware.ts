import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError } from "zod";
import { ApiError } from "../utils/apiError";

/**
 * Validates req.body / req.query / req.params against a Zod schema shaped
 * as { body?, query?, params? }. On success, replaces req.body/query/params
 * with the parsed (and therefore type-coerced/defaulted) values.
 */
export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new ApiError(422, "Validation failed", err.flatten()));
        return;
      }
      next(err);
    }
  };
}
