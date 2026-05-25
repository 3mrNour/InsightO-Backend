import { ChatOpenAI } from "@langchain/openai";
import { AppError } from "./AppError.js";
import User from "../modules/auth/model/User_Schema.js";
import {
  checkUserLimit,
  addTokenUsage,
  getMyTokenUsage,
  getAdminAggregatedUsage,
} from "../modules/AI/tokenUsage.service.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_TOKEN_LIMIT = 50_000;
const WARNING_THRESHOLD = 0.8; // 80%

// ─── Token Estimation ─────────────────────────────────────────────────────────
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Core: invoke LLM + persist usage to MongoDB ─────────────────────────────
export async function invokeWithUsageTracking(
  llm: ChatOpenAI,
  userId: string,
  prompt: any,
  feature: string = "general"
) {
  const uid = userId || "anonymous";

  // 1. Load user from DB to check current quota
  const user = await User.findById(uid);

  if (user) {
    // ── Quota check via TokenUsage service ──────────────────────────────────
    try {
      await checkUserLimit(user);
    } catch (err: any) {
      // Re-throw structured 429 from tokenUsage.service
      if (err instanceof AppError && err.statusCode === 429) {
        // Parse the JSON message to return structured error
        let parsed: any;
        try {
          parsed = JSON.parse(err.message);
        } catch {
          parsed = null;
        }

        if (parsed) {
          throw new AppError(
            `Token limit exceeded. Used: ${parsed.used}, Limit: ${parsed.limit}`,
            429
          );
        }
        throw err;
      }
      throw err;
    }
  }

  // 2. Estimate input tokens BEFORE calling LLM
  const promptStr = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
  const estimatedInputTokens = estimateTokens(promptStr);

  // 3. Invoke LLM
  const response = await llm.invoke(prompt);

  // 4. Calculate tokens used (prefer real metadata, fallback to estimation)
  let inputTokens = estimatedInputTokens;
  let outputTokens = 0;
  let totalTokens = 0;

  const metadata = response.response_metadata;
  const tokenUsage = (metadata as any)?.tokenUsage;
  if (tokenUsage) {
    inputTokens = tokenUsage.promptTokens ?? estimatedInputTokens;
    outputTokens = tokenUsage.completionTokens ?? 0;
    totalTokens = tokenUsage.totalTokens ?? (inputTokens + outputTokens);
  } else {
    const responseStr = response.content.toString();
    outputTokens = estimateTokens(responseStr);
    totalTokens = inputTokens + outputTokens;
  }

  // 5. Persist to TokenUsage collection + update User doc
  if (user) {
    await addTokenUsage({
      userId: uid,
      role: user.role || "UNKNOWN",
      feature,
      inputTokens,
      outputTokens,
      totalTokens,
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

  // Use the new service for accurate aggregation from TokenUsage collection
  const usageInfo = await getMyTokenUsage(
    userId,
    user.role || "INSTRUCTOR",
    user.ai_tokens_limit
  );

  return {
    totalTokensUsed: usageInfo.used,
    remainingTokens: usageInfo.remaining,
    maxTokens: usageInfo.limit,
    percentageUsed: usageInfo.percentageUsed,
    requestCount: user.ai_request_count ?? 0,
  };
}

// ─── Read usage for ALL users (Admin) ─────────────────────────────────────────
export async function getAllUsersUsage() {
  // Use the new aggregation pipeline from tokenUsage.service
  return getAdminAggregatedUsage();
}
