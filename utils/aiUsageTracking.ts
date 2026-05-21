import { ChatOpenAI } from "@langchain/openai";
import { AppError } from "./AppError.js";
import User from "../modules/auth/model/User_Schema.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_TOKEN_LIMIT = 90_000;
const WARNING_THRESHOLD = 0.8; // 80%

// ─── Token Estimation ─────────────────────────────────────────────────────────
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Core: invoke LLM + persist usage to MongoDB ─────────────────────────────
export async function invokeWithUsageTracking(
  llm: ChatOpenAI,
  userId: string,
  prompt: any
) {
  const uid = userId || "anonymous";

  // 1. Load user from DB to check current quota
  const user = await User.findById(uid);
  if (user) {
    const limit = user.ai_tokens_limit ?? DEFAULT_TOKEN_LIMIT;
    const used  = user.ai_tokens_used  ?? 0;

    if (used >= limit) {
      throw new AppError(
        `AI Token quota exceeded. Used: ${used}, Limit: ${limit}`,
        429
      );
    }
  }

  // 2. Invoke LLM
  const response = await llm.invoke(prompt);

  // 3. Calculate tokens used
  let usedTokens = 0;
  const metadata = response.response_metadata;
  if (metadata?.tokenUsage?.totalTokens) {
    usedTokens = metadata.tokenUsage.totalTokens;
  } else {
    const promptStr = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
    const responseStr = response.content.toString();
    usedTokens = estimateTokens(promptStr) + estimateTokens(responseStr);
  }

  // 4. Persist to MongoDB (atomic increment)
  if (user) {
    await User.findByIdAndUpdate(uid, {
      $inc: {
        ai_tokens_used: usedTokens,
        ai_request_count: 1,
      },
      $set: {
        ai_last_request_at: new Date(),
      },
    });
  }

  return response;
}

// ─── Read usage for a single user ────────────────────────────────────────────
export async function getUserUsage(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    return {
      totalTokensUsed: 0,
      remainingTokens: DEFAULT_TOKEN_LIMIT,
      maxTokens: DEFAULT_TOKEN_LIMIT,
      percentageUsed: 0,
      requestCount: 0,
    };
  }

  const limit = user.ai_tokens_limit ?? DEFAULT_TOKEN_LIMIT;
  const used  = user.ai_tokens_used  ?? 0;
  const pct   = (used / limit) * 100;

  return {
    totalTokensUsed: used,
    remainingTokens: Math.max(0, limit - used),
    maxTokens: limit,
    percentageUsed: Math.min(100, pct),
    requestCount: user.ai_request_count ?? 0,
  };
}

// ─── Read usage for ALL users (Admin) ─────────────────────────────────────────
export async function getAllUsersUsage() {
  // Fetch instructors, HODs, admins — anyone who can use AI
  const users = await User.find(
    { role: { $in: ["INSTRUCTOR", "HOD", "ADMIN"] } },
    "firstName lastName email ai_tokens_used ai_tokens_limit ai_request_count"
  );

  return users.map((u: any) => {
    const limit = u.ai_tokens_limit ?? DEFAULT_TOKEN_LIMIT;
    const used  = u.ai_tokens_used  ?? 0;
    const pct   = (used / limit) * 100;

    return {
      userId: u._id.toString(),
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      totalTokensUsed: used,
      maxTokens: limit,
      percentageUsed: Math.min(100, pct),
      requestCount: u.ai_request_count ?? 0,
    };
  });
}
