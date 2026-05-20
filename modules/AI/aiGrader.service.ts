// modules/AI/aiGrader.service.ts
// ---------------------------------------------------------------------------
// Standalone AI grading service — no vector search, no chunk matching.
// All grading is reasoning-based via LLM.
// Supports: TEXT, FILE (extracted text), MCQ, MSQ answer types.
// ---------------------------------------------------------------------------

import { ChatOpenAI } from "@langchain/openai";
import { estimateTokens } from "../../services/formAI.service.js";
import { AppError } from "../../utils/AppError.js";

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
}

export interface GradeResult {
  proposed_grade: number; // 0 – 100
  ai_feedback: string;
  confidence: number;     // 0 – 1
  grade_method: string;   // "deterministic" | "partial_scoring" | "llm_reasoning"
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
      maxTokens: 512,
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

function gradeMCQ(content: string, correctAnswer: string): GradeResult {
  const isCorrect =
    content.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  return {
    proposed_grade: isCorrect ? 100 : 0,
    ai_feedback: isCorrect
      ? "Correct answer selected."
      : `Incorrect. The correct answer is: "${correctAnswer}".`,
    confidence: 1.0,
    grade_method: "deterministic",
  };
}

// ── MSQ Partial Scorer ────────────────────────────────────────────────────────

function gradeMSQ(
  selectedAnswers: string[],
  correctAnswers: string[]
): GradeResult {
  if (!correctAnswers.length) {
    return {
      proposed_grade: 0,
      ai_feedback: "No correct answers defined for this MSQ question.",
      confidence: 1.0,
      grade_method: "partial_scoring",
    };
  }

  const normalizedCorrect = correctAnswers.map((a) => a.trim().toLowerCase());
  const normalizedSelected = selectedAnswers.map((a) => a.trim().toLowerCase());

  const correctlySelected = normalizedSelected.filter((s) =>
    normalizedCorrect.includes(s)
  ).length;

  const grade = Math.round((correctlySelected / correctAnswers.length) * 100);

  return {
    proposed_grade: Math.min(100, Math.max(0, grade)),
    ai_feedback: `Selected ${correctlySelected} of ${correctAnswers.length} correct answers. Score: ${grade}%.`,
    confidence: 1.0,
    grade_method: "partial_scoring",
  };
}

// ── LLM Reasoning Grader (TEXT / FILE) ───────────────────────────────────────

async function gradeLLM(
  content: string,
  rubric?: string
): Promise<GradeResult> {
  // Truncate content to prevent token overflow
  const safeContent = content.slice(0, MAX_CONTENT_CHARS);

  const hasRubric = rubric && rubric.trim().length > 0;

  const rubricSection = hasRubric
    ? `GRADING RUBRIC (strict grading — evaluate ONLY against these criteria):
${rubric}`
    : `GRADING RUBRIC: None provided.
INSTRUCTION: You MUST evaluate even if a rubric is missing. Infer evaluation criteria from the submission content. Assess quality, clarity, depth, correctness, and coherence.`;

  const prompt = `You are an expert academic grader. Your task is to evaluate a student's submission.

${rubricSection}

STUDENT SUBMISSION:
${safeContent}

INSTRUCTIONS:
- Be objective, consistent, and professional.
- Assign a grade between 0 and 100.
- Set confidence between 0.0 (very uncertain) and 1.0 (highly certain).
- Provide constructive, specific feedback referencing the submission.
- Respond ONLY with valid JSON — no markdown, no explanation outside JSON.

REQUIRED OUTPUT FORMAT:
{
  "proposed_grade": <number 0-100>,
  "ai_feedback": "<constructive feedback string>",
  "confidence": <number 0.0-1.0>
}`;

  guardTokens(prompt);

  const llm = getLLM();
  const response = await llm.invoke(prompt);
  const raw = response.content.toString().trim();

  let parsed: { proposed_grade: number; ai_feedback: string; confidence: number };
  try {
    parsed = parseJsonResponse(raw);
  } catch {
    console.error("[aiGrader] Failed to parse LLM response:", raw);
    throw new Error("AI returned an invalid JSON response.");
  }

  return {
    proposed_grade: Math.min(100, Math.max(0, Number(parsed.proposed_grade) || 0)),
    ai_feedback: parsed.ai_feedback || "No feedback provided.",
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
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
export async function gradeSubmission(input: GradeInput): Promise<GradeResult> {
  const { content, rubric, type = "text", correctAnswer, correctAnswers, selectedAnswers } = input;

  switch (type) {
    case "mcq": {
      if (!correctAnswer) {
        throw new AppError("MCQ grading requires 'correctAnswer'.", 400);
      }
      return gradeMCQ(content, correctAnswer);
    }

    case "msq": {
      if (!correctAnswers || !correctAnswers.length) {
        throw new AppError("MSQ grading requires 'correctAnswers'.", 400);
      }
      return gradeMSQ(selectedAnswers ?? [], correctAnswers);
    }

    case "file":
    case "text":
    default: {
      // For FILE type, caller must have already extracted text into `content`
      return gradeLLM(content, rubric);
    }
  }
}
