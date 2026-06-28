import { AIFactory } from "../../services/aiProvider.factory.js";
import { PromptTemplate } from "@langchain/core/prompts";
import { invokeWithUsageTracking } from "../../utils/aiUsageTracking.js";

const FORM_GENERATION_PROMPT = PromptTemplate.fromTemplate(`
You are an expert academic form designer. Your task is to generate an academic form based on the user's prompt.

USER PROMPT:
{prompt}

INSTRUCTIONS:
- You must return ONLY a JSON object representing the full form. It must contain exactly these keys: "title", "description", and "questions".
- STRICT INSTRUCTION: Act as a highly professional academic professor. Write a detailed, formal description for the form. NEVER mention that this is AI-generated, synthesized, or automated.
- The "questions" key must be an array of objects, where each object represents a question and strictly adheres to the schema below.
- The "type" MUST be exactly one of: "short_text", "long_text", "linear_scale", "multiple_choice", "checkbox", "file".
- Do not include markdown formatting like \`\`\`json. Just raw valid JSON.

REQUIRED JSON STRUCTURE:
{{
  "title": "...",
  "description": "...",
  "questions": [ ... ]
}}

SCHEMA FOR EACH QUESTION:
{{
  "label": "The question text",
  "type": "short_text | long_text | linear_scale | multiple_choice | checkbox | file",
  "required": true or false,
  "options": ["Option 1", "Option 2"] (ONLY required if type is "multiple_choice" or "checkbox"),
  "scale": {{ "min": 1, "max": 5 }} (ONLY required if type is "linear_scale")
}}

Output your JSON now:
`);

let _llm: any = null;

function getLLM(): any {
  if (!_llm) {
    _llm = AIFactory.getLLM({ temperature: 0.7, format: "json" });
  }
  return _llm;
}

export async function generateFormQuestions(prompt: string, userId: string = "anonymous"): Promise<{ title: string; description: string; questions: any[] }> {
  const llm = getLLM();
  const formattedPrompt = await FORM_GENERATION_PROMPT.format({ prompt });
  const response = await invokeWithUsageTracking(llm, userId, formattedPrompt, "generate-form");

  const raw = response.content.toString().trim();
  const jsonString = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    console.error("[aiFormGenerator] Failed to parse LLM response:", raw);
    throw new Error("AI returned an invalid JSON response.");
  }

  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error("Invalid output format: missing 'questions' array.");
  }

  return {
    title: parsed.title || "AI Generated Assessment",
    description: parsed.description || "",
    questions: parsed.questions
  };
}
