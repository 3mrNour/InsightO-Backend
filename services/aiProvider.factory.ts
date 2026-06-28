import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";

export class AIFactory {
  /**
   * Returns an instance of the configured LLM with Smart Fallback.
   */
  static getLLM(options?: { temperature?: number; format?: "json" }) {
    const temperature = options?.temperature ?? 0.7;

    // 1. تجهيز Ollama كخطة بديلة جاهزة
    const ollamaKwargs: any = {
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: "llama3.1:8b",
      temperature,
    };
    if (options?.format === "json") {
      ollamaKwargs.format = "json";
    }
    const ollamaModel = new ChatOllama(ollamaKwargs);

    // 2. فحص مفتاح OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    const hasOpenAIKey = apiKey && apiKey.trim().length > 0 && apiKey !== "your_openai_api_key_here";

    if (hasOpenAIKey) {
      // 3. تجهيز OpenAI
      const openaiKwargs: any = {
        modelName: "gpt-4o-mini",
        temperature,
        openAIApiKey: apiKey,
        maxRetries: 0, // 🔥 الأهم: امنع LangChain من المحاولات الغبية عشان يفشل فوراً لو مفيش رصيد
      };
      if (options?.format === "json") {
        openaiKwargs.modelKwargs = { response_format: { type: "json_object" } };
      }
      const openaiModel = new ChatOpenAI(openaiKwargs);

      // 🔥 4. السحر هنا: Ultimate Proxy بيراقب كل دوال التنفيذ مش invoke بس
      return new Proxy(openaiModel, {
        get(target, prop) {
          const origMethod = (target as any)[prop];

          // قايمة بكل الدوال اللي LangChain ممكن تستخدمها لبعت الريكويست
          const executionMethods = ["invoke", "generate", "call", "predict", "predictMessages"];

          if (typeof origMethod === "function" && executionMethods.includes(prop as string)) {
            return async (...args: any[]) => {
              try {
                // جرب OpenAI الأول
                return await origMethod.apply(target, args);
              } catch (error: any) {
                // لو الرصيد خلص أو حصل أي إيرور، هنصطاده هنا
                console.warn(`[AIFactory] OpenAI Error on method '${String(prop)}' (${error.status || error.message}). Switching to Ollama natively...`);

                // ابعت نفس الريكويست بنفس الدالة بالظبط للموديل المحلي
                const fallbackMethod = (ollamaModel as any)[prop];
                if (typeof fallbackMethod === "function") {
                  return await fallbackMethod.apply(ollamaModel, args);
                }
                throw error; // لو الدالة مش موجودة في Ollama، ارمي الإيرور
              }
            };
          }

          // مرر أي خصائص تانية (زي getNumTokens) زي ما هي عشان الكود ميضربش
          return Reflect.get(target, prop);
        }
      });
    }

    // لو مفيش مفتاح من الأساس، هنرجع Ollama مباشرة
    return ollamaModel;
  }

  /**
   * Returns embeddings model with Fallback support if needed.
   * (Note: Vector DB dimensions must match, so use this carefully based on your ingestion logic)
   */
  static getEmbeddings() {
    const apiKey = process.env.OPENAI_API_KEY;
    const hasOpenAIKey = apiKey && apiKey.trim().length > 0 && apiKey !== "your_openai_api_key_here";

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