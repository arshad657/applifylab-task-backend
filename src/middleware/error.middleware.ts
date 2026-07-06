import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";

/**
 * Centralized error handler. Every error in the app — thrown, rejected, or
 * forwarded via next(err) — ends up here exactly once, producing a single
 * consistent JSON error shape and a single log line.
 */
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    apiError = mapPrismaError(err);
  } else if (err instanceof Error) {
    apiError = ApiError.internal(err.message);
  } else {
    apiError = ApiError.internal("Unknown error");
  }

  const logPayload = {
    method: req.method,
    path: req.originalUrl,
    statusCode: apiError.statusCode,
    userId: req.user?.id,
    err: apiError.isOperational ? undefined : err,
  };

  if (apiError.statusCode >= 500) {
    console.error("Error occurred:", apiError.message, logPayload);
  } else {
    console.warn("Warn occurred:", apiError.message, logPayload);
  }

  let formattedErrors: Record<string, any> | undefined = undefined;

  if (apiError.statusCode === 422 && apiError.message === "Validation failed" && apiError.details) {
    const details = apiError.details as { fieldErrors?: Record<string, string[]> };
    if (details.fieldErrors) {
      formattedErrors = {};
      for (const [key, messages] of Object.entries(details.fieldErrors)) {
        if (messages && messages.length > 0) {
          formattedErrors[key] = messages[0];
        }
      }
    }
  } else if (apiError.details) {
    formattedErrors = apiError.details as Record<string, any>;
  }

  ApiResponse.error(res, {
    code: apiError.statusCode,
    message: apiError.message,
    errors: formattedErrors,
  });
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): ApiError {
  switch (err.code) {
    case "P2002": // unique constraint violation
      return ApiError.conflict("A resource with this value already exists");
    case "P2025": // record not found
      return ApiError.notFound("Resource not found");
    default:
      return ApiError.internal("Database error", { code: err.code });
  }
}

/** 404 handler for unmatched routes — registered after all route mounts. */
export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}
