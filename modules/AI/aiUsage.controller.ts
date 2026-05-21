import type { Request, Response, NextFunction } from "express";
import { getUserUsage, getAllUsersUsage } from "../../utils/aiUsageTracking.js";

export const getMyUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?._id?.toString() || "anonymous";
    const usage = await getUserUsage(userId);
    res.status(200).json({
      status: "success",
      data: usage
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsersUsageAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usage = await getAllUsersUsage();
    res.status(200).json({
      status: "success",
      data: usage
    });
  } catch (error) {
    next(error);
  }
};
