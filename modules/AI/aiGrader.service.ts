// modules/AI/aiGrader.service.ts
// ---------------------------------------------------------------------------
// Standalone AI grading service.
// Receives the student's submission content + the task's rubric string,
// calls GPT-4o via LangChain, and returns a structured grading result.
// Intentionally has NO side effects — callers decide what to do with the result.
// ---------------------------------------------------------------------------

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GradeInput {
  content: string;        // student's submission text
  rubric: string;         // task.ai_grading_rubric
}

export interface GradeResult {
  proposed_grade: number; // 0 – 100
  ai_feedback: string;
  confidence: number;     // 0 – 1
}

// ── Prompt Template ──────────────────────────────────────────────────────────

const GRADING_PROMPT = PromptTemplate.fromTemplate(`
You are an expert academic grader. Your task is to evaluate a student's submission
based strictly on the provided grading rubric.

GRADING RUBRIC:
{rubric}

STUDENT SUBMISSION:
{content}

INSTRUCTIONS:
- Evaluate the submission ONLY against the criteria in the rubric above.
- Be objective, consistent, and professional.
- Assign a grade between 0 and 100.
- Set confidence between 0.0 (very uncertain) and 1.0 (highly certain).
- Respond ONLY with a valid JSON object — no markdown, no explanation outside JSON.

REQUIRED OUTPUT FORMAT:
{{
  "proposed_grade": <number 0-100>,
  "ai_feedback": "<constructive feedback string>",
  "confidence": <number 0.0-1.0>
}}
`);

// ── LLM singleton (lazy-initialised) ─────────────────────────────────────────

let _llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!_llm) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set in environment variables.");
    }
    _llm = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0,            // deterministic grading
      openAIApiKey: apiKey,
      maxTokens: 512,            // result is short JSON
    });
  }
  return _llm;
}

// ── Core grading function ────────────────────────────────────────────────────

/**
 * gradeSubmission
 *
 * Calls GPT-4o with the student's content and the task rubric,
 * and returns a structured grading result.
 *
 * Throws on LLM or parse failure — callers should wrap in try/catch.
 */
export async function gradeSubmission({ content, rubric }: GradeInput): Promise<GradeResult> {
  const llm = getLLM();

  // Build the formatted prompt
  const formattedPrompt = await GRADING_PROMPT.format({ content, rubric });

  // Invoke the model
  const response = await llm.invoke(formattedPrompt);

  // Parse the response — strip accidental markdown fences if present
  const raw = response.content.toString().trim();
  const jsonString = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/,           "")
    .trim();

  let parsed: GradeResult;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    console.error("[aiGrader] Failed to parse LLM response:", raw);
    throw new Error("AI returned an invalid JSON response.");
  }

  // Validate numeric bounds
  parsed.proposed_grade = Math.min(100, Math.max(0, Number(parsed.proposed_grade) || 0));
  parsed.confidence      = Math.min(1,   Math.max(0, Number(parsed.confidence)      || 0));

  return parsed;
}
