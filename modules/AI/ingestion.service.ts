import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import mongoose from "mongoose";
// import { Chunk } from "./chunk.model.js";
import fs from "fs/promises";
import path from "path";
export class IngestionService {
  /**
   * Processes a PDF file, raw text, or URL, splits it into chunks, and stores embeddings in MongoDB.
   * @param payload Object containing file, text, url, and metadata
   * @returns The number of chunks processed and stored.
   */
  public static async processAndStore(payload: {
    file?: Express.Multer.File;
    text?: string;
    url?: string;
    metadata?: Record<string, any>;
  }): Promise<number> {
    const { file, text, url, metadata } = payload;
    let docs: Document[] = [];

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not defined.");
    }

    // 1. Extract from PDF, fetch URL, or Wrap text into Document
    if (file) {
      if (!file.path) {
        throw new Error("File path is undefined. Make sure multer is saving to disk.");
      }
      const loader = new PDFLoader(file.path);
      docs = await loader.load();
    } else if (url) {
      let fetchedText = "";
      if (url.startsWith("/uploads") || url.startsWith("uploads/")) {
        const normalizedPath = url.startsWith("/") ? url.slice(1) : url;
        const localPath = path.join(process.cwd(), normalizedPath);
        fetchedText = await fs.readFile(localPath, "utf8");
      } else {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${url}. Status: ${response.status}`);
        }
        fetchedText = await response.text();
      }
      docs = [new Document({ pageContent: fetchedText })];
    } else if (text) {
      docs = [new Document({ pageContent: text })];
    } else {
      throw new Error("A PDF file, raw text, or a URL must be provided.");
    }

    // 3. Split using RecursiveCharacterTextSplitter
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const splitDocs = await textSplitter.splitDocuments(docs);

    if (metadata) {
      for (const doc of splitDocs) {
        doc.metadata = { ...doc.metadata, ...metadata };
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
        collection: collection as any,
        indexName: "vector_index", // Replace with your Atlas Vector Search Index name if different
        textKey: "text",
        embeddingKey: "embedding",
      }
    );

    return splitDocs.length;
  }
}
