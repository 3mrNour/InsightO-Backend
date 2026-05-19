import { ChatOpenAI } from "@langchain/openai";
import Form from "../modules/form/model/formSchema.js";
import Question from "../modules/question/models/Question_Schema.js";
import Submission from "../modules/submission/submission.model.js";
import { AppError } from "../utils/AppError.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_LIMIT = 80_000;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TagAnalysisResult {
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  strengths: string[];
  weaknesses: string[];
  action_items: string[];
  score?: number;
}

export interface GlobalAnalysisResult {
  overall_summary: string;
  key_problems: string[];
  recommendations: string[];
  overall?: {
    score: number;
    summary: string;
  };
}

export interface FormAnalysisPayload {
  tags: Record<string, TagAnalysisResult>;
}

export interface FormDeepAnalysisPayload {
  tags: Record<string, TagAnalysisResult>;
  global: GlobalAnalysisResult;
}

// ─── Token Estimation Middleware ──────────────────────────────────────────────

/**
 * Estimates token count from a string using chars/4 heuristic.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Enforces the 80k token limit BEFORE any LLM call.
 * Throws AppError 429 if exceeded.
 */
export function enforceTokenLimit(text: string): void {
  const tokens = estimateTokens(text);
  if (tokens > TOKEN_LIMIT) {
    throw new AppError(
      `Token limit exceeded. Please reduce dataset. Estimated tokens: ${tokens}, limit: ${TOKEN_LIMIT}`,
      429
    );
  }
}

// ─── LLM Singleton ────────────────────────────────────────────────────────────

let _llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!_llm) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not defined in the environment variables.");
    }
    _llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.2,
      openAIApiKey: apiKey,
    });
  }
  return _llm;
}

// ─── JSON Cleanup Helper ──────────────────────────────────────────────────────

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

// ─── Form AI Service ──────────────────────────────────────────────────────────

export class FormAIService {
  /**
   * Step 1: Data Extraction
   * Fetches all submissions, maps answers to questions by ai_tag,
   * groups, filters empty/nulls, limits to 100 answers per tag.
   */
  public static async aggregateAnswersByTag(
    formId: string
  ): Promise<Record<string, string[]>> {
    // Verify form exists
    const form = await Form.findById(formId);
    if (!form) throw new AppError("Form not found", 404);

    // Build question → ai_tag map
    const questions = await Question.find({ form_id: formId });
    const questionTagMap = new Map<string, string>();
    for (const q of questions) {
      if (q.ai_tag?.trim()) {
        questionTagMap.set(q._id.toString(), q.ai_tag.trim().toLowerCase());
      }
    }

    // Fetch all submissions
    const submissions = await Submission.find({ form_id: formId });

    // Group answers by tag
    const grouped: Record<string, string[]> = {};

    for (const sub of submissions) {
      for (const answer of sub.answers) {
        if (!answer.question_id) continue;
        const tag = questionTagMap.get(answer.question_id.toString());
        if (!tag) continue;

        const val = answer.value;
        if (val === undefined || val === null || val === "") continue;

        let parsedAnswer = "";
        if (typeof val === "string") {
          parsedAnswer = val.trim();
        } else if (typeof val === "number") {
          parsedAnswer = String(val);
        } else if (Array.isArray(val)) {
          const filtered = val.filter((v: any) => v !== undefined && v !== null && v !== "");
          if (filtered.length > 0) parsedAnswer = filtered.join(", ");
        } else if (typeof val === "object") {
          parsedAnswer = (val as any).url
            ? `Uploaded file: ${(val as any).fileName || "File"} (${(val as any).url})`
            : JSON.stringify(val);
        }

        if (parsedAnswer) {
          if (!grouped[tag]) grouped[tag] = [];
          grouped[tag].push(parsedAnswer);
        }
      }
    }

    // Limit to 100 answers per tag
    const limited: Record<string, string[]> = {};
    for (const [tag, answers] of Object.entries(grouped)) {
      limited[tag] = answers.slice(0, 100);
    }
    return limited;
  }

  /**
   * Step 2: Tag-level AI Analysis (no vector search — pure LLM reasoning).
   * Enforces token limit before sending to LLM.
   */
  public static async analyzeSingleTag(
    tag: string,
    answers: string[]
  ): Promise<TagAnalysisResult> {
    const fallback: TagAnalysisResult = {
      summary: `Failed to analyze "${tag}" due to processing issues or insufficient data.`,
      sentiment: "neutral",
      strengths: [],
      weaknesses: [],
      action_items: [],
    };

    if (!answers || answers.length === 0) return fallback;

    try {
      // Truncate each answer to 500 chars max to prevent bloating
      const truncatedAnswers = answers.map((a) => a.slice(0, 500));
      const context = truncatedAnswers.join("\n---\n");

      const prompt = `You are an AI integrated into a Form Results Dashboard UI.

You MUST read and understand the grouped form results carefully.

Category: "${tag}"

Responses (${truncatedAnswers.length} total):
${context}

---------------------------------------
TASK
---------------------------------------
Analyze these responses collectively:
- detect patterns
- evaluate quality and consistency
- identify strengths and weaknesses

---------------------------------------
OUTPUT FORMAT (STRICT JSON ONLY)
---------------------------------------
{
  "tag": "${tag}",
  "summary": "2-3 sentence concise summary",
  "strengths": ["clear actionable strength"],
  "weaknesses": ["clear actionable weakness"],
  "action_items": ["practical improvement action"],
  "score": number (0-100)
}

---------------------------------------
RULES
---------------------------------------
- DO NOT return anything except JSON
- DO NOT use markdown
- Keep output concise (optimize tokens)
- Score must reflect actual quality (not random)
- If responses are weak → lower score
- If mixed → medium score
- If strong → high score
- Infer evaluation even if unclear
`;
      // ── Token guard ─────────────────────────────────────────────────────────
      enforceTokenLimit(prompt);

      const llm = getLLM();
      const response = await llm.invoke(prompt);
      const raw = response.content.toString().trim();

      const parsed = parseJsonResponse<any>(raw);
      const score = typeof parsed.score === "number" ? parsed.score : 50;
      
      let sentiment: "positive" | "neutral" | "negative" = "neutral";
      if (score >= 70) {
        sentiment = "positive";
      } else if (score < 45) {
        sentiment = "negative";
      }

      return {
        summary: parsed.summary || `Analysis completed for "${tag}".`,
        sentiment,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
        score,
      };
    } catch (err: any) {
      // Re-throw token limit errors — controller must surface them
      if (err instanceof AppError && err.statusCode === 429) throw err;
      console.error(`[FormAIService] analyzeSingleTag error for tag "${tag}":`, err);
      return fallback;
    }
  }

  /**
   * Part 5 Endpoint 1: Basic Analysis
   * GET /api/ai/analyze-form/:formId
   */
  public static async processFormSubmissionAnalysis(
    formId: string
  ): Promise<FormAnalysisPayload> {
    // Aggregate all answers by tag
    const grouped = await this.aggregateAnswersByTag(formId);
    const tags = Object.keys(grouped);
    if (tags.length === 0) return { tags: {} };

    // Pre-flight global token check across ALL tag contexts
    const totalContext = Object.entries(grouped)
      .map(([tag, answers]) => `${tag}:\n${answers.join("\n")}`)
      .join("\n\n");
    enforceTokenLimit(totalContext);

    // Parallel tag-level analysis
    const results: Record<string, TagAnalysisResult> = {};
    await Promise.all(
      tags.map(async (tag) => {
        results[tag] = await this.analyzeSingleTag(tag, grouped[tag]);
      })
    );

    return { tags: results };
  }

  /**
   * Part 5 Endpoint 2: Deep Global Analysis
   * GET /api/ai/analyze-form/:formId/deep
   */
  public static async processFormDeepAnalysis(
    formId: string
  ): Promise<FormDeepAnalysisPayload> {
    const fallbackGlobal: GlobalAnalysisResult = {
      overall_summary: "Unable to run deep cross-category analysis at this time.",
      key_problems: [],
      recommendations: [],
    };

    // 1. Run tag-level analysis first
    const basicAnalysis = await this.processFormSubmissionAnalysis(formId);
    const tagsResults = basicAnalysis.tags;

    if (Object.keys(tagsResults).length === 0) {
      return { tags: {}, global: fallbackGlobal };
    }

    // 2. Build cross-category context
    const combinedData = JSON.stringify(tagsResults, null, 2);
const globalPrompt = `You are analyzing full form feedback across multiple categories.

Data:
${combinedData}

---------------------------------------
TASK
---------------------------------------
- Identify cross-patterns across all categories
- Detect the most critical issues affecting performance
- Highlight repeated weaknesses across tags
- Provide practical, high-impact recommendations

---------------------------------------
OUTPUT (STRICT JSON ONLY)
---------------------------------------
{
  "overall": {
    "score": number (0-100),
    "summary": "2-3 sentence overall evaluation"
  },
  "key_problems": [
    "clear major problem derived from multiple tags"
  ],
  "recommendations": [
    "practical, actionable improvement recommendation"
  ]
}

---------------------------------------
RULES
---------------------------------------
- Return ONLY JSON (no text, no markdown)
- Be concise and direct
- Do NOT hallucinate data not present in tags
- Problems must be cross-category (not single tag)
- Recommendations must directly solve the problems
- Score must reflect overall real performance
`;

    // ── Token guard ──────────────────────────────────────────────────────────
    enforceTokenLimit(globalPrompt);

    try {
      const llm = getLLM();
      const response = await llm.invoke(globalPrompt);
      const raw = response.content.toString().trim();
      const parsed = parseJsonResponse<any>(raw);
      const overall = parsed.overall || {};

      const global: GlobalAnalysisResult = {
        overall_summary: overall.summary || parsed.overall_summary || "Strategic deep analysis completed successfully.",
        key_problems: Array.isArray(parsed.key_problems) ? parsed.key_problems : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        overall: {
          score: typeof overall.score === "number" ? overall.score : 70,
          summary: overall.summary || "Analysis complete."
        }
      };

      return { tags: tagsResults, global };
    } catch (err: any) {
      if (err instanceof AppError && err.statusCode === 429) throw err;
      console.error("[FormAIService] processFormDeepAnalysis error:", err);
      return { tags: tagsResults, global: fallbackGlobal };
    }
  }
}
