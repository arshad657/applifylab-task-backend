import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { env } from "./config/env";
import { globalRateLimiter } from "./middleware/rateLimiter.middleware";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware";
import { ApiResponse } from "./utils/apiResponse";

import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import postsRoutes, { postRouter } from "./modules/posts/posts.routes";
import { commentRouter } from "./modules/comments/comments.routes";

export function createApp(): Express {
  const app = express();

  // Security headers.
  app.use(helmet());

  // CORS: single configured origin in production; wide open only if explicitly set to "*".
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(compression());

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.use(globalRateLimiter);

  app.get("/health", (_req, res) => {
    ApiResponse.success(res, {
      message: "Health check passed.",
      data: { status: "ok" },
    });
  });

  const prefix = env.API_PREFIX;
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/users`, usersRoutes);
  app.use(`${prefix}/posts`, postsRoutes);
  app.use(`${prefix}/post`, postRouter);
  app.use(`${prefix}/comments`, commentRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
