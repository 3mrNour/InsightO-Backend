import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";

export class AIFactory {
  /**
   * Returns an instance of the configured LLM. Tries Ollama first, falls back to Groq/OpenAI if Ollama fails.
   */
  static getLLM(options?: { temperature?: number; format?: "json" }) {
    const temperature = options?.temperature ?? 0.7;

    // 1. Prepare Ollama as the Primary Model
    const ollamaKwargs: any = {
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: "llama3.1:8b",
      temperature,
    };
    if (options?.format === "json") {
      ollamaKwargs.format = "json";
    }
    const ollamaModel = new ChatOllama(ollamaKwargs);

    // 2. Prepare Groq / OpenAI as the Fallback Model
    const apiKey = process.env.OPENAI_API_KEY;
    const hasOpenAIKey = apiKey && apiKey.trim().length > 0 && apiKey !== "your_openai_api_key_here";
    
    let fallbackModel: ChatOpenAI | null = null;

    if (hasOpenAIKey) {
      let modelName = "gpt-4o-mini";
      let baseURL: string | undefined = undefined;

      if (apiKey.startsWith("gsk_")) {
        // Groq Key
        modelName = "llama-3.1-8b-instant";
        baseURL = "https://api.groq.com/openai/v1";
      } else if (apiKey.startsWith("sbg_")) {
        // SambaNova Key
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
      fallbackModel = new ChatOpenAI(openaiKwargs);
    }

    // 3. Proxy to intercept calls to Ollama and fallback to Groq if Ollama fails
    return new Proxy(ollamaModel, {
      get(target, prop) {
        const origMethod = (target as any)[prop];
        const executionMethods = ["invoke", "generate", "call", "predict", "predictMessages"];

        if (typeof origMethod === "function" && executionMethods.includes(prop as string)) {
          return async (...args: any[]) => {
            try {
              // Try Ollama first
              return await origMethod.apply(target, args);
            } catch (error: any) {
              console.warn(`[AIFactory] Ollama Error on method '${String(prop)}' (${error.status || error.message || error.code || 'Unknown'}).`);
              
              if (fallbackModel) {
                console.warn(`[AIFactory] Switching to Groq/OpenAI Fallback...`);
                const fallbackMethod = (fallbackModel as any)[prop];
                if (typeof fallbackMethod === "function") {
                  return await fallbackMethod.apply(fallbackModel, args);
                }
              }
              
              throw error; // If no fallback or fallback method doesn't exist, throw original error
            }
          };
        }

        return Reflect.get(target, prop);
      }
    });
  }

  /**
   * Returns embeddings model.
   */
  static getEmbeddings() {
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
    } else {
      return {
        provider: "ollama",
        embeddings: new OllamaEmbeddings({
          baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
          model: "nomic-embed-text",
        }),
      };
    }
  }
}