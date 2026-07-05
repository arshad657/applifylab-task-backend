import { Response } from "express";

export interface SuccessResponseOptions<T> {
  code?: number;
  message?: string;
  data?: T;
  meta?: Record<string, any>;
}

export interface ErrorResponseOptions {
  code?: number;
  message?: string;
  errors?: Record<string, any>;
  meta?: Record<string, any>;
}

export interface SuccessResponse<T> {
  status: "success";
  code: number;
  message: string;
  data?: T;
  meta: {
    timestamp: string;
    version: string;
    [key: string]: any;
  };
}

export interface ErrorResponse {
  status: "error";
  code: number;
  message: string;
  errors?: Record<string, any>;
  meta: {
    request_id: string;
    [key: string]: any;
  };
}

export class ApiResponse {
  /**
   * Send a standardized success API response
   */
  static success<T>(
    res: Response,
    options: SuccessResponseOptions<T> = {}
  ): void {
    const code = options.code ?? 200;
    const body: SuccessResponse<T> = {
      status: "success",
      code,
      message: options.message ?? "Data retrieved successfully.",
      data: options.data,
      meta: {
        timestamp: new Date().toISOString(),
        version: "v1.0",
        ...options.meta,
      },
    };
    res.status(code).json(body);
  }

  /**
   * Send a standardized error API response
   */
  static error(
    res: Response,
    options: ErrorResponseOptions = {}
  ): void {
    const code = options.code ?? 500;
    const req = res.req;
    const requestId =
      (req as any)?.id ||
      req?.headers["x-request-id"] ||
      `req_${Math.random().toString(36).substring(2, 11)}`;

    const body: ErrorResponse = {
      status: "error",
      code,
      message: options.message ?? "An error occurred.",
      errors: options.errors,
      meta: {
        request_id: requestId,
        ...options.meta,
      },
    };
    res.status(code).json(body);
  }
}
