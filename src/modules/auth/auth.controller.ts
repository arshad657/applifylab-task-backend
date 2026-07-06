import { Request, Response } from "express";
import { authService } from "./auth.service";
import type { LoginInput, RefreshInput, RegisterInput } from "./auth.validation";
import { ApiResponse } from "../../utils/apiResponse";

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body as RegisterInput);
    ApiResponse.success(res, {
      code: 201,
      message: "User registered successfully.",
      data: result,
    });
  }

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body as LoginInput);
    ApiResponse.success(res, {
      message: "Logged in successfully.",
      data: result,
    });
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body as RefreshInput;
    const tokens = await authService.refresh(refreshToken);
    ApiResponse.success(res, {
      message: "Tokens refreshed successfully.",
      data: tokens,
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const getCookieValue = (cookieHeader: string | undefined, name: string): string | null => {
      if (!cookieHeader) return null;
      const pairs = cookieHeader.split(";");
      for (const pair of pairs) {
        const [key, value] = pair.split("=");
        if (key.trim() === name) {
          return decodeURIComponent(value?.trim() || "");
        }
      }
      return null;
    };

    const refreshToken =
      (req as any).cookies?.refreshToken ||
      getCookieValue(req.headers.cookie, "refreshToken") ||
      (req.body as any)?.refreshToken;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.setHeader("Set-Cookie", "refreshToken=; HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=0");
    res.status(204).send();
  }
}

export const authController = new AuthController();
