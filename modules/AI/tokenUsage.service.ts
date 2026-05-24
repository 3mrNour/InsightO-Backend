import mongoose from "mongoose";
import TokenUsage from "./tokenUsage.model.js";
import User from "../auth/model/User_Schema.js";
import { AppError } from "../../utils/AppError.js";

// ─── Role-based Token Limits ──────────────────────────────────────────────────

const ROLE_LIMITS: Record<string, number> = {
  INSTRUCTOR: 50_000,
  HOD: 80_000,
  ADMIN: 80_000,
};

const DEFAULT_LIMIT = 50_000;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AddTokenUsageData {
  userId: string;
  role: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface UserLimitCheck {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

// ─── Helper: resolve limit for a user ─────────────────────────────────────────

function resolveLimit(user: any): number {
  // Prefer per-user override (ai_tokens_limit on User doc), fall back to role-based
  if (user.ai_tokens_limit != null && user.ai_tokens_limit > 0) {
    return user.ai_tokens_limit;
  }
  return ROLE_LIMITS[user.role] ?? DEFAULT_LIMIT;
}

// ─── getUserTokenUsage ────────────────────────────────────────────────────────

/**
 * Returns the total tokens consumed by a user across all TokenUsage records.
 */
export async function getUserTokenUsage(userId: string): Promise<number> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError("Invalid user ID", 400);
  }

  const result = await TokenUsage.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: "$totalTokens" } } },
  ]);

  return result.length > 0 ? result[0].total : 0;
}

// ─── checkUserLimit ───────────────────────────────────────────────────────────

/**
 * Validates whether a user can make an AI request.
 * Returns structured info; throws AppError 429 if quota exceeded.
 */
export async function checkUserLimit(user: any): Promise<UserLimitCheck> {
  if (!user || !user._id) {
    throw new AppError("Missing userId — authentication required", 401);
  }

  const userId = user._id.toString();
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError("Invalid user ID", 400);
  }

  const limit = resolveLimit(user);
  const used = await getUserTokenUsage(userId);
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    throw new AppError(
      JSON.stringify({
        message: "Token limit exceeded",
        limit,
        used,
        remaining: 0,
      }),
      429
    );
  }

  return { allowed: true, used, limit, remaining };
}

// ─── addTokenUsage ────────────────────────────────────────────────────────────

/**
 * Persists a single AI request's token usage to the TokenUsage collection.
 * Also updates the User doc's ai_tokens_used / ai_request_count atomically.
 */
export async function addTokenUsage(data: AddTokenUsageData): Promise<void> {
  const { userId, role, feature, inputTokens, outputTokens, totalTokens } = data;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    console.error("[tokenUsage.service] Invalid userId, skipping persist:", userId);
    return;
  }

  // 1. Insert into TokenUsage collection
  await TokenUsage.create({
    userId: new mongoose.Types.ObjectId(userId),
    role,
    feature,
    inputTokens,
    outputTokens,
    totalTokens,
  });

  // 2. Atomic increment on User doc (keeps backward-compat with existing fields)
  await User.findByIdAndUpdate(userId, {
    $inc: {
      ai_tokens_used: totalTokens,
      ai_request_count: 1,
    },
    $set: {
      ai_last_request_at: new Date(),
    },
  });
}

// ─── getMyTokenUsage (for API response) ───────────────────────────────────────

/**
 * Returns usage summary for a single authenticated user.
 */
export async function getMyTokenUsage(userId: string, userRole: string, userLimit?: number) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError("Invalid user ID", 400);
  }

  const used = await getUserTokenUsage(userId);
  const limit = userLimit && userLimit > 0 ? userLimit : (ROLE_LIMITS[userRole] ?? DEFAULT_LIMIT);
  const remaining = Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
    percentageUsed: Math.min(100, (used / limit) * 100),
  };
}

// ─── getAdminAggregatedUsage ──────────────────────────────────────────────────

/**
 * Returns aggregated token usage per user for admin dashboard.
 */
export async function getAdminAggregatedUsage() {
  const pipeline = [
    {
      $group: {
        _id: "$userId",
        role: { $first: "$role" },
        totalInputTokens: { $sum: "$inputTokens" },
        totalOutputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" },
        requestCount: { $sum: 1 },
        lastRequest: { $max: "$createdAt" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userInfo",
      },
    },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        name: {
          $concat: [
            { $ifNull: ["$userInfo.firstName", ""] },
            " ",
            { $ifNull: ["$userInfo.lastName", ""] },
          ],
        },
        email: { $ifNull: ["$userInfo.email", "unknown"] },
        role: 1,
        totalInputTokens: 1,
        totalOutputTokens: 1,
        totalTokens: 1,
        requestCount: 1,
        lastRequest: 1,
        limit: {
          $ifNull: [
            "$userInfo.ai_tokens_limit",
            DEFAULT_LIMIT,
          ],
        },
      },
    },
    { $sort: { totalTokens: -1 as const } },
  ];

  const results = await TokenUsage.aggregate(pipeline);

  return results.map((r: any) => ({
    ...r,
    remaining: Math.max(0, r.limit - r.totalTokens),
    percentageUsed: Math.min(100, (r.totalTokens / r.limit) * 100),
  }));
}
