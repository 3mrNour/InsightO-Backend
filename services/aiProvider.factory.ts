import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export class AIFactory {
  /**
   * Returns an instance of the configured LLM. 
   * Prioritizes Google GenAI -> OpenAI/Groq -> Ollama.
   */
  static getLLM(options?: { temperature?: number; format?: "json" }) {
    const temperature = options?.temperature ?? 0.7;

    // 1. Check for Google GenAI Key
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (googleApiKey && googleApiKey.trim().length > 0) {
      const googleKwargs: any = {
        modelName: "gemini-1.5-flash",
        apiKey: googleApiKey,
        temperature,
      };
      if (options?.format === "json") {
         // Gemini supports JSON output format natively in latest langchain
         // But usually it's handled via prompting. We'll pass it if needed.
      }
      return new ChatGoogleGenerativeAI(googleKwargs);
    }

    // 2. Check for OpenAI / Groq / SambaNova Key
    const apiKey = process.env.OPENAI_API_KEY;
    const hasOpenAIKey = apiKey && apiKey.trim().length > 0 && apiKey !== "your_openai_api_key_here";
    
    if (hasOpenAIKey) {
      let modelName = "gpt-4o-mini";
      let baseURL: string | undefined = undefined;

      if (apiKey.startsWith("gsk_")) {
        modelName = "llama-3.1-8b-instant";
        baseURL = "https://api.groq.com/openai/v1";
      } else if (apiKey.startsWith("sbg_")) {
        modelName = "Meta-Llama-3.1-8B-Instruct";
        baseURL = "https://api.sambanova.ai/v1";
      }

      const openaiKwargs: any = {
        modelName,
        temperature,
        openAIApiKey: apiKey,
        maxRetries: 0,
      };

      if (baseURL) {
        openaiKwargs.configuration = { baseURL };
      }

      if (options?.format === "json") {
        openaiKwargs.modelKwargs = { response_format: { type: "json_object" } };
      }
      return new ChatOpenAI(openaiKwargs);
    }

    // 3. Fallback to Local Ollama
    const ollamaKwargs: any = {
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: "llama3.1:8b",
      temperature,
    };
    if (options?.format === "json") {
      ollamaKwargs.format = "json";
    }
    return new ChatOllama(ollamaKwargs);
  }

  /**
   * Returns embeddings model.
   */
  static getEmbeddings() {
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (googleApiKey && googleApiKey.trim().length > 0) {
      return {
        provider: "google",
        embeddings: new GoogleGenerativeAIEmbeddings({
          model: "text-embedding-004",
          apiKey: googleApiKey,
        }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const hasOpenAIKey = apiKey && apiKey.trim().length > 0 && apiKey.startsWith("sk-");

    if (hasOpenAIKey) {
      return {
        provider: "openai",
        embeddings: new OpenAIEmbeddings({
          model: "text-embedding-3-small",
          apiKey: apiKey,
        }),
      };
    } 
    
    return {
      provider: "ollama",
      embeddings: new OllamaEmbeddings({
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        model: "nomic-embed-text",
      }),
    };
  }
}