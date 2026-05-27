import { ChatOpenAI } from "@langchain/openai";
import { invokeWithUsageTracking } from "../../utils/aiUsageTracking.js";

// Helper to reliably extract strictly formatted JSON from LLM outputs
function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw.trim();
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const jsonStr = cleaned.substring(startIdx, endIdx + 1);
    return JSON.parse(jsonStr) as T;
  }

  const standardCleaned = cleaned
    .replace(/^```(?:json)?/im, "")
    .replace(/```$/m, "")
    .trim();
  return JSON.parse(standardCleaned) as T;
}

export interface ProfileSynthesisInput {
  avgSuggestedGrade: number;
  avgConfidenceScore: number;
  aggregatedConcepts: { concept: string; average_mastery: number }[];
  uniqueWeaknesses: string[];
  uniqueRecommendations: string[];
}

export interface ProfileSynthesisResult {
  overall_summary: string;
  core_strengths: string[];
  persistent_weaknesses: string[];
  action_plan: string[];
}

export class ProfileAIService {
  static async synthesizeProfile(
    input: ProfileSynthesisInput,
    userId: string
  ): Promise<ProfileSynthesisResult> {
    const {
      avgSuggestedGrade,
      avgConfidenceScore,
      aggregatedConcepts,
      uniqueWeaknesses,
      uniqueRecommendations,
    } = input;

    const prompt = `You are a Senior Academic Advisor. Your task is to analyze the student's historical performance data and synthesize a holistic profile.

STUDENT AGGREGATED DATA:
- Average Suggested Grade: ${avgSuggestedGrade.toFixed(2)}
- Average Confidence Score: ${avgConfidenceScore.toFixed(2)}

- Concept Mastery (Average Levels):
${JSON.stringify(aggregatedConcepts, null, 2)}

- Persistent Weaknesses (aggregated):
${JSON.stringify(uniqueWeaknesses, null, 2)}

- Actionable Recommendations (aggregated):
${JSON.stringify(uniqueRecommendations, null, 2)}

INSTRUCTIONS:
Synthesize this raw data into an overall profile.
OUTPUT STRICT JSON in the following exact format. Do not use markdown tags like \`\`\`json.
{
  "overall_summary": "A 3-sentence evaluation of the student's general performance and learning curve.",
  "core_strengths": ["string"],
  "persistent_weaknesses": ["string"],
  "action_plan": ["actionable advice tailored to their weaknesses"]
}`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.2,
      openAIApiKey: apiKey,
    });

    try {
      const response = await invokeWithUsageTracking(llm, userId, prompt, "profile-analytics");
      return parseJsonResponse<ProfileSynthesisResult>(response.content.toString());
    } catch (error) {
      console.error("[ProfileAnalytics] AI Synthesis failed:", error);
      // Fallback
      return {
        overall_summary: "AI synthesis is currently unavailable due to an error.",
        core_strengths: [],
        persistent_weaknesses: uniqueWeaknesses.slice(0, 5),
        action_plan: uniqueRecommendations.slice(0, 5),
      };
    }
  }
}
