// modules/AI/aiGrader.service.ts
// ---------------------------------------------------------------------------
// Standalone AI grading service — no vector search, no chunk matching.
// All grading is reasoning-based via LLM.
// Supports: TEXT, FILE (extracted text), MCQ, MSQ answer types.
// ---------------------------------------------------------------------------

import { ChatOpenAI } from "@langchain/openai";
import { estimateTokens } from "../../services/formAI.service.js";
import { AppError } from "../../utils/AppError.js";
import { invokeWithUsageTracking } from "../../utils/aiUsageTracking.js";
import { raw } from "express";

// ── Constants ────────────────────────────────────────────────────────────────

const TOKEN_LIMIT = 80_000;
const MAX_CONTENT_CHARS = 12_000; // ~3k tokens per submission content

// ── Types ────────────────────────────────────────────────────────────────────

export type AnswerType = "text" | "file" | "mcq" | "msq";

export interface GradeInput {
  /** The student's submission content (resolved text for all types) */
  content: string;
  /** Grading rubric — optional. If absent, LLM infers evaluation criteria. */
  rubric?: string;
  /** Answer type: text | file | mcq | msq */
  type?: AnswerType;
  /** For MCQ: the single correct answer */
  correctAnswer?: string;
  /** For MSQ: all correct answers */
  correctAnswers?: string[];
  /** For MSQ: which answers the student selected */
  selectedAnswers?: string[];
  /** User ID for tracking token usage */
  userId?: string;

  // 👈 ضيف الحقلين دول هنا حالاً عشان الـ TS يهدأ:
  attachments?: {
    url: string;
    fileName?: string;
    size?: number;
  }[];
  form_answers?: {
    question_id: any;
    value: any;
  }[];
}

export interface GradeResult {
  proposed_grade: number;
  feedback: string;
  confidence: number;
  grade_method: string;
  weaknesses?: string[];
  recommendations?: string[];
  criteria_breakdown?: any[];
  concept_mastery?: any[];
  quality_metrics?: any;
}

// ── LLM Singleton ────────────────────────────────────────────────────────────

let _llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!_llm) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set in environment variables.");
    _llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
      openAIApiKey: apiKey,
      maxTokens: 2048,
    });
  }
  return _llm;
}

// ── Token Guard ───────────────────────────────────────────────────────────────

function guardTokens(prompt: string): void {
  const tokens = estimateTokens(prompt);
  if (tokens > TOKEN_LIMIT) {
    throw new AppError(
      `Token limit exceeded. Estimated tokens: ${tokens}, limit: ${TOKEN_LIMIT}`,
      429
    );
  }
}

// ── JSON Cleanup ──────────────────────────────────────────────────────────────

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

// ── MCQ Deterministic Grader ──────────────────────────────────────────────────

// function gradeMCQ(content: string, correctAnswer: string): GradeResult {
//   const isCorrect =
//     content.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
//   return {
//     proposed_grade: isCorrect ? 100 : 0,
//     ai_feedback: isCorrect
//       ? "Correct answer selected."
//       : `Incorrect. The correct answer is: "${correctAnswer}".`,
//     confidence: 1.0,
//     grade_method: "deterministic",
//   };
// }

// ── MSQ Partial Scorer ────────────────────────────────────────────────────────

// function gradeMSQ(
//   selectedAnswers: string[],
//   correctAnswers: string[]
// ): GradeResult {
//   if (!correctAnswers.length) {
//     return {
//       proposed_grade: 0,
//       ai_feedback: "No correct answers defined for this MSQ question.",
//       confidence: 1.0,
//       grade_method: "partial_scoring",
//     };
//   }

//   const normalizedCorrect = correctAnswers.map((a) => a.trim().toLowerCase());
//   const normalizedSelected = selectedAnswers.map((a) => a.trim().toLowerCase());

//   const correctlySelected = normalizedSelected.filter((s) =>
//     normalizedCorrect.includes(s)
//   ).length;

//   const grade = Math.round((correctlySelected / correctAnswers.length) * 100);

//   return {
//     proposed_grade: Math.min(100, Math.max(0, grade)),
//     ai_feedback: `Selected ${correctlySelected} of ${correctAnswers.length} correct answers. Score: ${grade}%.`,
//     confidence: 1.0,
//     grade_method: "partial_scoring",
//   };
// }

// ── LLM Reasoning Grader (TEXT / FILE) ───────────────────────────────────────

async function gradeLLM(
  content: string,
  rubric?: string,
  userId: string = "anonymous"
): Promise<GradeResult> {
  const safeContent = content.slice(0, MAX_CONTENT_CHARS);
  const hasRubric = rubric && rubric.trim().length > 0;

  const rubricSection = hasRubric
    ? `GRADING RUBRIC (Evaluate strictly against these criteria):\n${rubric}`
    : `GRADING RUBRIC: None provided. Assess logic, correctness, quality, and coherence.`;

  const prompt = `You are a Principal Academic Evaluator and Senior Software Architect. Your task is to perform a deep cognitive analysis of the student's submission.

${rubricSection}

STUDENT SUBMISSION / ANSWERS:
${safeContent}

INSTRUCTIONS:
1. Provide a suggested grade (0-100) and confidence score (0.0-1.0).
2. Provide constructive general feedback.
3. Identify 1-3 specific weaknesses.
4. Provide actionable recommendations.
5. Generate a 'criteria_breakdown' identifying dimensions of the submission (e.g., Logic, Optimization). For each, give a score out of a max value, and a brief comment.
6. Map 'concept_mastery' extracting key academic concepts discussed. Assign a mastery_level (0.0-1.0) and status ("EXCELLENT", "GOOD", or "CRITICAL").
7. Generate 'quality_metrics' estimating readability (0-100), complexity (0-100), and security guardrails (0-100).
8. YOU MUST RESPOND ONLY WITH VALID JSON. Do not include markdown tags (\`\`\`json).

REQUIRED JSON OUTPUT FORMAT:
{
  "suggested_grade": <number>,
  "confidence_score": <number>,
  "feedback": "<string>",
  "weaknesses": ["<string>"],
  "recommendations": ["<string>"],
  "criteria_breakdown": [
    { "criterion": "<string>", "score": <number>, "max": <number>, "comments": "<string>" }
  ],
  "concept_mastery": [
    { "concept": "<string>", "mastery_level": <number>, "status": "EXCELLENT" | "GOOD" | "CRITICAL" }
  ],
  "quality_metrics": {
    "readability": <number>,
    "complexity_score": <number>,
    "security_guardrails": <number>
  }
}`;

  guardTokens(prompt);

  const llm = getLLM();
  const response = await invokeWithUsageTracking(llm, userId, prompt, "grade-submission");
  const raw = response.content.toString().trim();
  console.log("[aiGrader] LLM response:", raw);

  let parsed: any;
  try {
    parsed = parseJsonResponse(raw);
  } catch {
    console.error("[aiGrader] Failed to parse LLM response:", raw);
    throw new Error("AI returned an invalid JSON response.");
  }

  return {
    proposed_grade: Math.min(100, Math.max(0, Number(parsed.suggested_grade || parsed.proposed_grade) || 0)),
    feedback: parsed.feedback || parsed.ai_feedback || "No feedback provided.",
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence_score || parsed.confidence) || 0)),
    weaknesses: parsed.weaknesses || [],
    recommendations: parsed.recommendations || [],
    criteria_breakdown: parsed.criteria_breakdown || [],
    concept_mastery: parsed.concept_mastery || [],
    quality_metrics: parsed.quality_metrics || { readability: 0, complexity_score: 0, security_guardrails: 0 },
    grade_method: "llm_reasoning",
  };
}

// ── Core Export: gradeSubmission ──────────────────────────────────────────────

/**
 * gradeSubmission
 *
 * Routes to the correct grading strategy based on `type`:
 * - mcq  → deterministic (0 or 100)
 * - msq  → partial scoring (correct_selected / total_correct * 100)
 * - text → LLM reasoning (with or without rubric)
 * - file → LLM reasoning on extracted text (caller must extract first)
 *
 * No vector search. No side effects. Returns clean JSON.
 * Throws on failure — callers should wrap in try/catch.
 */
// export async function gradeSubmission(input: GradeInput): Promise<GradeResult> {
//   const { content, rubric, type = "text", correctAnswer, correctAnswers, selectedAnswers, userId = "anonymous" } = input;

//   switch (type) {
//     case "mcq": {
//       if (!correctAnswer) {
//         throw new AppError("MCQ grading requires 'correctAnswer'.", 400);
//       }
//       return gradeMCQ(content, correctAnswer);
//     }

//     case "msq": {
//       if (!correctAnswers || !correctAnswers.length) {
//         throw new AppError("MSQ grading requires 'correctAnswers'.", 400);
//       }
//       return gradeMSQ(selectedAnswers ?? [], correctAnswers);
//     }

//     case "file":
//     case "text":
//     default: {
//       // For FILE type, caller must have already extracted text into `content`
//       return gradeLLM(content, rubric, userId);
//     }
//   }
// }
