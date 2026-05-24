import type { Request, Response, NextFunction } from "express";
import { getUserUsage, getAllUsersUsage } from "../../utils/aiUsageTracking.js";
import { getMyTokenUsage, getAdminAggregatedUsage } from "./tokenUsage.service.js";
import { AppError } from "../../utils/AppError.js";

// ─── GET /api/ai-usage/me ─────────────────────────────────────────────────────
// Returns current user's token usage including remaining tokens
export const getMyUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user || !user._id) {
      return next(new AppError("Authentication required", 401));
    }

    const userId = user._id.toString();
    const usage = await getMyTokenUsage(userId, user.role, user.ai_tokens_limit);

    res.status(200).json({
      status: "success",
      data: {
        used: usage.used,
        limit: usage.limit,
        remaining: usage.remaining,
        percentageUsed: usage.percentageUsed,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/ai-usage/users ──────────────────────────────────────────────────
// Admin-only: Returns aggregated usage per user
export const getAllUsersUsageAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usage = await getAdminAggregatedUsage();
    res.status(200).json({
      status: "success",
      data: usage,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/ai/token-usage ──────────────────────────────────────────────────
// Lightweight endpoint for frontend: returns { used, limit, remaining }
export const getTokenUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user || !user._id) {
      return next(new AppError("Authentication required", 401));
    }

    const userId = user._id.toString();
    const usage = await getMyTokenUsage(userId, user.role, user.ai_tokens_limit);

    res.status(200).json({
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/admin/token-usage ───────────────────────────────────────────────
// Admin endpoint: Returns aggregated usage per user
export const getAdminTokenUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usage = await getAdminAggregatedUsage();
    res.status(200).json({
      status: "success",
      data: usage,
    });
  } catch (error) {
    next(error);
  }
};
