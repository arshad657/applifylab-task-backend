import { Request, Response } from "express";
import { usersService } from "./users.service";
import type { UpdateProfileInput } from "./users.validation";
import { ApiResponse } from "../../utils/apiResponse";

export class UsersController {
  async getByUsername(req: Request, res: Response): Promise<void> {
    const profile = await usersService.getByUsername(req.params.username);
    ApiResponse.success(res, {
      message: "Profile retrieved successfully.",
      data: profile,
    });
  }

  async updateMe(req: Request, res: Response): Promise<void> {
    const profile = await usersService.updateProfile(req.user!.id, req.body as UpdateProfileInput);
    ApiResponse.success(res, {
      message: "Profile updated successfully.",
      data: profile,
    });
  }
}

export const usersController = new UsersController();
