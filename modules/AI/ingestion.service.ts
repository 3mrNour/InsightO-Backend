import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import mongoose from "mongoose";
import { Chunk } from "./chunk.model.js";

export class IngestionService {
  /**
   * Processes a PDF file or raw text, splits it into chunks, and stores embeddings in MongoDB.
   * @param file Express.Multer.File (optional)
   * @param text string (optional)
   * @param taskId string (optional)
   * @returns The number of chunks processed and stored.
   */
  public static async processAndStore(file?: Express.Multer.File, text?: string, taskId?: string): Promise<number> {
    let docs: Document[] = [];

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not defined.");
    }

    // 1. Extract from PDF or 2. Wrap text into Document
    if (file) {
      if (!file.path) {
        throw new Error("File path is undefined. Make sure multer is saving to disk.");
      }
      const loader = new PDFLoader(file.path);
      docs = await loader.load();
    } else if (text) {
      docs = [new Document({ pageContent: text })];
    } else {
      throw new Error("Either a PDF file or raw text must be provided.");
    }

    // 3. Split using RecursiveCharacterTextSplitter
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const splitDocs = await textSplitter.splitDocuments(docs);

    if (taskId) {
      for (const doc of splitDocs) {
        doc.metadata = { ...doc.metadata, taskId };
      }
    }

    // 4 & 5. Generate embeddings and store in MongoDB
    // and naturally maps to the 'chunks' collection.
    if (!mongoose.connection.db) {
      throw new Error("MongoDB is not connected properly.");
    }
    const collection = mongoose.connection.db.collection("chunks");

    await MongoDBAtlasVectorSearch.fromDocuments(
      splitDocs,
      new OpenAIEmbeddings({
        model: "text-embedding-3-small",
        apiKey: process.env.OPENAI_API_KEY,
      }),
      {
        collection,
        indexName: "vector_index", // Replace with your Atlas Vector Search Index name if different
        textKey: "text",
        embeddingKey: "embedding",
      }
    );

    return splitDocs.length;
  }
}
