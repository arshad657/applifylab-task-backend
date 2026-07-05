/**
 * A single, typed error class used everywhere in the app so the centralized
 * error middleware can map it to a consistent HTTP response shape.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Unauthorized"): ApiError {
    return new ApiError(401, message);
  }
  static forbidden(message = "Forbidden"): ApiError {
    return new ApiError(403, message);
  }
  static notFound(message = "Not found"): ApiError {
    return new ApiError(404, message);
  }
  static conflict(message = "Conflict"): ApiError {
    return new ApiError(409, message);
  }
  static tooMany(message = "Too many requests"): ApiError {
    return new ApiError(429, message);
  }
  static internal(message = "Internal server error", details?: unknown): ApiError {
    return new ApiError(500, message, details, false);
  }
}
