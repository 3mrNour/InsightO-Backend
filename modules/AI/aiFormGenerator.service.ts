import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

const FORM_GENERATION_PROMPT = PromptTemplate.fromTemplate(`
You are an expert academic form designer. Your task is to generate a list of questions for an academic form based on the user's prompt.

USER PROMPT:
{prompt}

INSTRUCTIONS:
- You must return ONLY a JSON object with a single key "questions" containing an array of objects.
- Each object MUST represent a question and strictly adhere to the following schema.
- The "type" MUST be exactly one of: "short_text", "long_text", "linear_scale", "multiple_choice", "file".
- Do not include markdown formatting like \`\`\`json. Just raw valid JSON.

SCHEMA FOR EACH QUESTION:
{{
  "label": "The question text",
  "type": "short_text | long_text | linear_scale | multiple_choice | file",
  "required": true or false,
  "options": ["Option 1", "Option 2"] (ONLY required if type is "multiple_choice"),
  "scale": {{ "min": 1, "max": 5 }} (ONLY required if type is "linear_scale")
}}

Output your JSON now:
`);

let _llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!_llm) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set in environment variables.");
    }
    _llm = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      openAIApiKey: apiKey,
      modelKwargs: { response_format: { type: "json_object" } },
    });
  }
  return _llm;
}

export async function generateFormQuestions(prompt: string): Promise<any[]> {
  const llm = getLLM();
  const formattedPrompt = await FORM_GENERATION_PROMPT.format({ prompt });
  const response = await llm.invoke(formattedPrompt);

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

  return parsed.questions;
}
