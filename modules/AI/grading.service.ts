import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

export class GradingService {
  private static client: MongoClient;

  private static async getClient() {
    if (!this.client) {
      const uri = process.env.MONGO_URI;
      if (!uri) throw new Error("MONGO_URI is not defined");
      this.client = new MongoClient(uri);
      await this.client.connect();
    }
    return this.client;
  }

  public static async gradeSubmission(submission: string) {
    const client = await this.getClient();
    const collection = client.db().collection("rubric_embeddings");

    // 1. Initialize Vector Search
    const vectorStore = new MongoDBAtlasVectorSearch(
      new OpenAIEmbeddings({
        modelName: "text-embedding-3-small",
        openAIApiKey: process.env.OPENAI_API_KEY,
      }),
      {
        collection,
        indexName: "default",
        textKey: "text",
        embeddingKey: "embedding",
      }
    );

    // 2. Retrieve rubric context (similaritySearch 6 chunks)
    const results = await vectorStore.similaritySearch(submission, 6);
    const context = results.map((doc) => doc.pageContent).join("\n\n");

    // 3. Initialize LLM
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // 4. Build Prompt
    const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert academic grader. Use the provided rubric context to evaluate the student's submission.

RUBRIC CONTEXT:
{context}

STUDENT SUBMISSION:
{submission}

EVALUATION RULES:
- Use ONLY the provided rubric context for grading criteria.
- Be objective and strict.
- Return ONLY a JSON object in the following format:
{{
  "proposed_grade": number (0-100),
  "ai_feedback": "string",
  "confidence": number (0-1)
}}
    `);

    const formattedPrompt = await promptTemplate.format({
      context,
      submission,
    });

    // 5. Call LLM
    const response = await llm.invoke(formattedPrompt);
    
    // 6. Parse Response
    try {
      const content = response.content.toString();
      // Basic cleanup in case LLM returns markdown blocks
      const jsonString = content.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(jsonString);
    } catch (error) {
      console.error("Failed to parse AI response:", response.content);
      throw new Error("Invalid AI response format");
    }
  }
}
