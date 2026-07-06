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
  "scale": {{ "min": 1, "max": 5 }} (ONLY required if type is "linear_scale"),
  "text_validation": {{ "type": "text | email | phone | number | url" }} (ONLY allowed if type is "short_text")
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
  
  let jsonString = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  
  if (jsonMatch) {
    jsonString = jsonMatch[1].trim();
  } else {
    // Fallback: Try to extract text between the first '{' and the last '}'
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      jsonString = raw.substring(firstBrace, lastBrace + 1);
    } else {
      // Last resort cleanup
      jsonString = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    }
  }

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

// Helper to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export async function generateFormQuestionsFromFile(
  filePath: string,
  fileName: string,
  prompt: string,
  userId: string = "anonymous"
): Promise<{ title: string; description: string; questions: any[] }> {
  let fullText = "";
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const { PDFLoader } = await import("@langchain/community/document_loaders/fs/pdf");
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    fullText = docs.map((d) => d.pageContent).join("\n");
  } else if (ext === "pptx" || ext === "ppt") {
    const officeParser = (await import("officeparser"));
    const parsed = await officeParser.parseOffice(filePath);
    fullText = typeof parsed === "string" ? parsed : (parsed?.text || JSON.stringify(parsed) || "");
  } else {
    // Attempt fallback raw read for txt, etc.
    const fs = await import("fs/promises");
    fullText = await fs.readFile(filePath, "utf8");
  }

  // Chunk the text to handle huge files
  const { RecursiveCharacterTextSplitter } = await import("@langchain/textsplitters");
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });
  
  if (typeof fullText !== "string") {
    fullText = String(fullText || "");
  }
  
  const chunks = await splitter.createDocuments([fullText]);
  
  // Diverse sampling: randomly pick up to 15 chunks to stay well within token limits
  // but get a broad coverage of the document.
  let selectedChunks = chunks;
  if (chunks.length > 15) {
    selectedChunks = shuffleArray([...chunks]).slice(0, 15);
  }
  
  const excerptText = selectedChunks.map((c) => c.pageContent).join("\n\n---\n\n");

  const combinedPrompt = `
You are generating a quiz/form based on an uploaded document.
${prompt ? `USER SPECIAL INSTRUCTIONS:\n${prompt}\n` : ""}
DOCUMENT EXCERPTS (Randomly sampled from the uploaded file):
${excerptText}

Generate a comprehensive quiz covering the information provided in the excerpts above. 
DO NOT hallucinate or include information outside of these excerpts.
`;

  return generateFormQuestions(combinedPrompt, userId);
}

