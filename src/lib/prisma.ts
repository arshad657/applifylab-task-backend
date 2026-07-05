import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Single PrismaClient instance shared across the app (per Prisma's own
 * guidance) to avoid exhausting the MongoDB connection pool under load.
 */
class PrismaService {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaClient({
        log:
          env.NODE_ENV === "development"
            ? [
                { emit: "event", level: "query" },
                { emit: "event", level: "error" },
                { emit: "event", level: "warn" },
              ]
            : [{ emit: "event", level: "error" }],
      });

      // Prisma's event overloads are keyed by the `log` config passed to the
      // constructor, which TypeScript can't always narrow generically here —
      // cast to a loosely-typed emitter rather than fighting the overloads.
      const emitter = PrismaService.instance as unknown as {
        $on: (event: "error" | "query" | "warn", cb: (e: any) => void) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
      };

      emitter.$on("error", (e: unknown) => logger.error({ err: e }, "Prisma error"));

      if (env.NODE_ENV === "development") {
        emitter.$on("query", (e: { query: string; duration: number }) =>
          logger.debug({ query: e.query, durationMs: e.duration }, "prisma query")
        );
      }
    }
    return PrismaService.instance;
  }
}

export const prisma = PrismaService.getInstance();
