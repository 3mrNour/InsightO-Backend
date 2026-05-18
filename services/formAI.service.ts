import { ChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import Form from "../modules/form/model/formSchema.js";
import Question from "../modules/question/models/Question_Schema.js";
import Submission from "../modules/submission/submission.model.js";
import { AppError } from "../utils/AppError.js";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TagAnalysisResult {
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  strengths: string[];
  weaknesses: string[];
  action_items: string[];
}

export interface GlobalAnalysisResult {
  overall_summary: string;
  key_problems: string[];
  recommendations: string[];
}

export interface FormAnalysisPayload {
  tags: Record<string, TagAnalysisResult>;
}

export interface FormDeepAnalysisPayload {
  tags: Record<string, TagAnalysisResult>;
  global: GlobalAnalysisResult;
}

// ─── LLM Singleton ───────────────────────────────────────────────────────────

let _llm: ChatOpenAI | null = null;

function getLLM(): ChatOpenAI {
  if (!_llm) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not defined in the environment variables.");
    }
    _llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.2, // deterministic and highly analytical
      openAIApiKey: apiKey,
    });
  }
  return _llm;
}

// ─── Form AI Service ─────────────────────────────────────────────────────────

export class FormAIService {
  /**
   * Part 1: Data Extraction
   * Fetches all submissions, maps answers to questions, resolves ai_tag,
   * groups by ai_tag, filters empty/nulls, and limits to 100 answers per tag.
   */
  public static async aggregateAnswersByTag(formId: string): Promise<Record<string, string[]>> {
    // 1. Fetch form to verify existence
    const form = await Form.findById(formId);
    if (!form) {
      throw new AppError("Form not found", 404);
    }

    // 2. Fetch all questions for this form and build a map of question_id -> ai_tag
    const questions = await Question.find({ form_id: formId });
    const questionTagMap = new Map<string, string>();
    for (const q of questions) {
      if (q.ai_tag && q.ai_tag.trim()) {
        questionTagMap.set(q._id.toString(), q.ai_tag.trim().toLowerCase());
      }
    }

    // 3. Fetch all submissions for this form
    const submissions = await Submission.find({ form_id: formId });

    // 4. Extract and group answers by tag
    const groupedAnswers: Record<string, string[]> = {};

    for (const sub of submissions) {
      for (const answer of sub.answers) {
        if (!answer.question_id) continue;
        const qId = answer.question_id.toString();
        const tag = questionTagMap.get(qId);
        if (!tag) continue; // Skip if question has no ai_tag

        const val = answer.value;
        if (val === undefined || val === null || val === "") continue;

        let parsedAnswer = "";
        if (typeof val === "string") {
          parsedAnswer = val.trim();
        } else if (typeof val === "number") {
          parsedAnswer = String(val);
        } else if (Array.isArray(val)) {
          // Flatten array selections
          const filtered = val.filter((v: any) => v !== undefined && v !== null && v !== "");
          if (filtered.length > 0) {
            parsedAnswer = filtered.join(", ");
          }
        } else if (typeof val === "object") {
          if (val.url) {
            parsedAnswer = `Uploaded file: ${val.fileName || "File"} (${val.url})`;
          } else {
            parsedAnswer = JSON.stringify(val);
          }
        }

        if (parsedAnswer) {
          if (!groupedAnswers[tag]) {
            groupedAnswers[tag] = [];
          }
          groupedAnswers[tag].push(parsedAnswer);
        }
      }
    }

    // 5. Apply limits: max 100 answers per tag (Performance optimization & safety)
    const limitedGroupedAnswers: Record<string, string[]> = {};
    for (const [tag, answers] of Object.entries(groupedAnswers)) {
      limitedGroupedAnswers[tag] = answers.slice(0, 100);
    }

    return limitedGroupedAnswers;
  }

  /**
   * Part 2 & 3: Chunking & Tag-level AI Analysis
   * Chunk the combined answers of a tag and analyze them using GPT-4o.
   */
  public static async analyzeSingleTag(tag: string, answers: string[]): Promise<TagAnalysisResult> {
    const fallback: TagAnalysisResult = {
      summary: `Failed to analyze ${tag} due to processing issues or lack of data.`,
      sentiment: "neutral",
      strengths: [],
      weaknesses: [],
      action_items: [],
    };

    if (!answers || answers.length === 0) {
      return fallback;
    }

    try {
      // 1. Merge answers into one text body
      const mergedText = answers.join("\n");

      // 2. Chunking using RecursiveCharacterTextSplitter (chunk size: 800, overlap: 100)
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800,
        chunkOverlap: 100,
      });

      const docs = await splitter.createDocuments([mergedText]);
      let chunks = docs.map((doc) => doc.pageContent);

      // 3. Limit to top 12 chunks to avoid token blowing and optimize API latency
      if (chunks.length > 12) {
        chunks = chunks.slice(0, 12);
      }

      // 4. Initialize LLM & call GPT-4o
      const llm = getLLM();
      const prompt = `You are analyzing grouped student feedback.

Category: ${tag}

Chunks:
${chunks.join("\n\n")}

Analyze collectively and return STRICT JSON:
{
  "summary": "A concise, detailed summary of findings and overall patterns.",
  "sentiment": "positive" or "neutral" or "negative",
  "strengths": ["list of key strengths identified"],
  "weaknesses": ["list of key weaknesses or issues highlighted"],
  "action_items": ["concrete action recommendations to address weaknesses"]
}

Rules:
- Respond strictly with valid JSON.
- DO NOT wrap the output in markdown code blocks like \`\`\`json.
- Keep the response objective, professional, and directly derived from the chunks.`;

      const response = await llm.invoke(prompt);
      const rawText = response.content.toString().trim();

      // Clean markdown block wrapper if any
      const cleanJson = rawText
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();

      const parsedResult = JSON.parse(cleanJson);

      return {
        summary: parsedResult.summary || `Analysis completed for ${tag}.`,
        sentiment: ["positive", "neutral", "negative"].includes(parsedResult.sentiment)
          ? parsedResult.sentiment
          : "neutral",
        strengths: Array.isArray(parsedResult.strengths) ? parsedResult.strengths : [],
        weaknesses: Array.isArray(parsedResult.weaknesses) ? parsedResult.weaknesses : [],
        action_items: Array.isArray(parsedResult.action_items) ? parsedResult.action_items : [],
      };
    } catch (err) {
      console.error(`[FormAIService] Error in analyzeSingleTag for tag "${tag}":`, err);
      return fallback;
    }
  }

  /**
   * Part 5 Endpoint 1: Basic Analysis
   * GET /api/ai/analyze-form/:formId
   * Groups answers, chunks them, and runs tag-level AI feedback collectively.
   */
  public static async processFormSubmissionAnalysis(formId: string): Promise<FormAnalysisPayload> {
    try {
      // 1. Get answers grouped by tag
      const groupedAnswers = await this.aggregateAnswersByTag(formId);
      const tags = Object.keys(groupedAnswers);

      if (tags.length === 0) {
        return { tags: {} };
      }

      // 2. Parallel processing using Promise.all
      const results: Record<string, TagAnalysisResult> = {};
      await Promise.all(
        tags.map(async (tag) => {
          results[tag] = await this.analyzeSingleTag(tag, groupedAnswers[tag]);
        })
      );

      return { tags: results };
    } catch (error: any) {
      console.error("[FormAIService] processFormSubmissionAnalysis error:", error);
      // Return empty/safe structure on failure (fail silently/gracefully)
      return { tags: {} };
    }
  }

  /**
   * Part 4 & Part 5 Endpoint 2: Global/Deep Analysis
   * GET /api/ai/analyze-form/:formId/deep
   * Performs tag-level analyses, then aggregates them to perform global/cross-category strategic analysis.
   */
  public static async processFormDeepAnalysis(formId: string): Promise<FormDeepAnalysisPayload> {
    const fallbackGlobal: GlobalAnalysisResult = {
      overall_summary: "Unable to run deep cross-category analysis at this time.",
      key_problems: [],
      recommendations: [],
    };

    try {
      // 1. Perform tag-level analysis first
      const basicAnalysis = await this.processFormSubmissionAnalysis(formId);
      const tagsResults = basicAnalysis.tags;

      if (Object.keys(tagsResults).length === 0) {
        return { tags: {}, global: fallbackGlobal };
      }

      // 2. Build cross-category context (Part 4)
      const combinedData = JSON.stringify(tagsResults, null, 2);

      // 3. Initialize LLM & Call GPT-4o
      const llm = getLLM();
      const prompt = `You are analyzing full student feedback across categories.

Data:
${combinedData}

Find:
- Cross-patterns (correlations and patterns spanning multiple categories)
- System-wide issues (deep underlying, structural, or systemic problems)
- Hidden problems (implicit student concerns not stated directly)

Return STRICT JSON:
{
  "overall_summary": "A comprehensive strategic synthesis of the cross-category findings.",
  "key_problems": ["list of top systemic issues across categories"],
  "recommendations": ["strategic high-impact recommendations for the organization or instructor"]
}

Rules:
- Respond strictly with valid JSON.
- DO NOT wrap the output in markdown code blocks like \`\`\`json.
- Analyze how issues in one area could be causing or related to issues in another.`;

      const response = await llm.invoke(prompt);
      const rawText = response.content.toString().trim();

      const cleanJson = rawText
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();

      const parsedGlobal = JSON.parse(cleanJson);

      const global: GlobalAnalysisResult = {
        overall_summary: parsedGlobal.overall_summary || "Strategic deep analysis completed successfully.",
        key_problems: Array.isArray(parsedGlobal.key_problems) ? parsedGlobal.key_problems : [],
        recommendations: Array.isArray(parsedGlobal.recommendations) ? parsedGlobal.recommendations : [],
      };

      return {
        tags: tagsResults,
        global,
      };
    } catch (error: any) {
      console.error("[FormAIService] processFormDeepAnalysis error:", error);
      return {
        tags: {},
        global: fallbackGlobal,
      };
    }
  }
}
