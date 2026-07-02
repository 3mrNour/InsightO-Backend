import { AIFactory } from "./aiProvider.factory.js";
import Form from "../modules/form/model/formSchema.js";
import Question from "../modules/question/models/Question_Schema.js";
import Submission from "../modules/submission/submission.model.js";
import { AppError } from "../utils/AppError.js";
import { invokeWithUsageTracking } from "../utils/aiUsageTracking.js";

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

let _llm: any = null;

function getLLM(): any {
  if (!_llm) {
    _llm = AIFactory.getLLM({ temperature: 0.2, format: "json" });
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
  public static detectArabic(text: string): boolean {
    return /[\u0600-\u06FF]/.test(text);
  }

  public static detectFormLanguage(questions: any[]): "ar" | "en" {
    if (!questions || questions.length === 0) return "en";
    let arabicCount = 0;
    for (const q of questions) {
      if (q.label && this.detectArabic(q.label)) {
        arabicCount++;
      }
    }
    return arabicCount > questions.length / 2 ? "ar" : "en";
  }
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
      } else {
        let fallbackTag = q.label?.trim() || `question_${q.order}`;
        if (fallbackTag.length > 40) {
          fallbackTag = fallbackTag.slice(0, 37) + "...";
        }
        questionTagMap.set(q._id.toString(), fallbackTag.toLowerCase());
      }
    }

    // Fetch all submissions
    const submissions = await Submission.find({ form_id: formId });

    // Group answers by tag
    const grouped: Record<string, string[]> = {};

    for (const sub of submissions) {
      for (const answer of sub.answers) {
        if (!answer.question_id) continue;

        const qIdStr = (answer.question_id as any)._id
          ? (answer.question_id as any)._id.toString()
          : answer.question_id.toString();

        const tag = questionTagMap.get(qIdStr);
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
    answers: string[],
    lang: "ar" | "en" = "en",
    userId: string = "anonymous"
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

      const prompt = `IMPORTANT:
- If lang = "ar" → Return ALL output in Arabic
- If lang = "en" → Return ALL output in English
- DO NOT mix languages

Active language mode for this response: ${lang === "ar" ? "Arabic (ar)" : "English (en)"}

You are an AI integrated into a Form Results Dashboard UI.

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
  "summary": "2-3 sentence concise summary in the target language",
  "strengths": ["clear actionable strength in the target language"],
  "weaknesses": ["clear actionable weakness in the target language"],
  "action_items": ["practical improvement action in the target language"],
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
- Keep the JSON keys ("tag", "summary", "strengths", "weaknesses", "action_items", "score") in English, but output all string values in the target language.
`;
      // ── Token guard ─────────────────────────────────────────────────────────
      enforceTokenLimit(prompt);

      const llm = getLLM();
      const response = await invokeWithUsageTracking(llm, userId, prompt, "analyze-form");
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
    formId: string,
    userId: string = "anonymous"
  ): Promise<any> {
    const submissions = await Submission.find({ form_id: formId });
    if (!submissions || submissions.length === 0) {
      return {
        error: "NO_DATA",
        message: "Cannot perform AI analysis on a form with zero submissions.",
        overall_score: 0,
        tags: {}
      };
    }

    // Detect form language
    const questions = await Question.find({ form_id: formId });
    const formLanguage = this.detectFormLanguage(questions);

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
        results[tag] = await this.analyzeSingleTag(tag, grouped[tag], formLanguage, userId);
      })
    );

    return { tags: results };
  }

  /**
   * Part 5 Endpoint 2: Deep Global Analysis
   * GET /api/ai/analyze-form/:formId/deep
   */
  public static async processFormDeepAnalysis(
    formId: string,
    userId: string = "anonymous"
  ): Promise<FormDeepAnalysisPayload> {
    const fallbackGlobal: GlobalAnalysisResult = {
      overall_summary: "Unable to run deep cross-category analysis at this time.",
      key_problems: [],
      recommendations: [],
    };

    // Detect form language
    const questions = await Question.find({ form_id: formId });
    const formLanguage = this.detectFormLanguage(questions);

    // 1. Run tag-level analysis first
    const basicAnalysis = await this.processFormSubmissionAnalysis(formId, userId);
    const tagsResults = basicAnalysis.tags;

    if (Object.keys(tagsResults).length === 0) {
      return { tags: {}, global: fallbackGlobal };
    }

    // 2. Build cross-category context
    const combinedData = JSON.stringify(tagsResults, null, 2);
    const globalPrompt = `IMPORTANT:
- If lang = "ar" → Return ALL output in Arabic
- If lang = "en" → Return ALL output in English
- DO NOT mix languages

Active language mode for this response: ${formLanguage === "ar" ? "Arabic (ar)" : "English (en)"}

You are analyzing full form feedback across multiple categories.

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
    "summary": "2-3 sentence overall evaluation in the target language"
  },
  "key_problems": [
    "clear major problem derived from multiple tags in the target language"
  ],
  "recommendations": [
    "practical, actionable improvement recommendation in the target language"
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
- Keep the JSON keys ("overall", "score", "summary", "key_problems", "recommendations") in English, but output all string values in the target language.
`;

    // ── Token guard ──────────────────────────────────────────────────────────
    enforceTokenLimit(globalPrompt);

    try {
      const llm = getLLM();
      const response = await invokeWithUsageTracking(llm, userId, globalPrompt, "analyze-form-deep");
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

  /**
   * Process Comparative Analysis for Departments, Courses, and Instructors
   */
  public static async processComparativeAnalysis(
    groupedData: Record<string, any>,
    entityType: "DEPARTMENT" | "COURSE" | "INSTRUCTOR" | "FACILITY",
    entityName: string,
    lang: "ar" | "en",
    userId: string
  ): Promise<any> {
    const context = JSON.stringify(groupedData);

    let rolePrompt = "";
    if (entityType === "DEPARTMENT") {
      rolePrompt = "act as a Quality Assurance Consultant analyzing strategic departmental performance, faculty efficiency, and general student satisfaction across years.";
    } else if (entityType === "COURSE") {
      rolePrompt = "act as a Curriculum Developer analyzing curriculum clarity, difficulty, and content updates across years.";
    } else if (entityType === "INSTRUCTOR") {
      rolePrompt = "act as an Academic HR Expert analyzing teaching style, communication, and fairness across years.";
    } else if (entityType === "FACILITY") {
      rolePrompt = "act as a Facility Management Consultant analyzing service availability, response times, safety standards, and overall visitor satisfaction.";
    }

    const prompt = `You are a strict, world-class ${rolePrompt.replace("act as a ", "")}.
Your absolute mandate is to perform a deep, data-driven semantic analysis of the historical feedback data for the academic entity named "${entityName}".

CRITICAL INSTRUCTIONS:
1. NEVER use the placeholder text "\${entityName}" or "\${rolePrompt}" or any code variables in your response. Always write the actual name: "${entityName}".
2. Do NOT give generic or vague feedback. Be specific, academic, and highly contextual based on the provided data.
3. If lang = "ar" -> Return ALL string values in Arabic.
4. If lang = "en" -> Return ALL string values in English.
5. Keep the JSON keys strictly in English. Do NOT use Markdown tags like \`\`\`json.

HISTORICAL DATA TO ANALYZE (Grouped by Evaluation Cycles):
${context}

TASK:
Analyze the trajectory of "${entityName}" across these cycles. Identify patterns of growth or decay. 
- "overall_score": Must be a realistic metric (0-100) reflecting the latest cycle's health.
- "trend_analysis": Provide 2-3 deep, structurally rich sentences explaining the dynamic shifts between cycles for "${entityName}".
- "core_strengths": List 2-4 granular, highly descriptive strengths extracted from the positive feedback.
- "persistent_issues": List 2-4 specific, recurring bottlenecks or complaints.
- "action_plan": Provide a clear, strategic roadmap with 3-4 concrete steps to address the persistent issues.

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "overall_score": 85,
  "trend_analysis": "Write your detailed multi-cycle analysis here...",
  "core_strengths": ["Detailed strength 1", "Detailed strength 2"],
  "persistent_issues": ["Detailed issue 1", "Detailed issue 2"],
  "action_plan": ["Actionable step 1", "Actionable step 2"]
}`;

    enforceTokenLimit(prompt);

    try {
      const llm = getLLM();
      const response = await invokeWithUsageTracking(llm, userId, prompt, "analyze-comparative");
      const raw = response.content.toString().trim();
      const parsed = parseJsonResponse<any>(raw);

      return {
        overall_score: typeof parsed.overall_score === "number" ? parsed.overall_score : 50,
        trend_analysis: parsed.trend_analysis || "",
        core_strengths: Array.isArray(parsed.core_strengths) ? parsed.core_strengths : [],
        persistent_issues: Array.isArray(parsed.persistent_issues) ? parsed.persistent_issues : [],
        action_plan: Array.isArray(parsed.action_plan) ? parsed.action_plan : []
      };
    } catch (err: any) {
      if (err instanceof AppError && err.statusCode === 429) throw err;
      console.error("[FormAIService] processComparativeAnalysis error:", err);
      throw err;
    }
  }
}
