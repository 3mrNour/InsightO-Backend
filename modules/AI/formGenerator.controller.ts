import type { Request, Response } from "express";
import { generateFormQuestions } from "./aiFormGenerator.service.js";
import { AppError } from "../../utils/AppError.js";

export const generateAIForm = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        message: "Bad Request",
        error: "Prompt is required and must be a string",
      });
    }

    const userId = (req as any).user?._id?.toString();

if (!userId) {
  throw new Error("User ID is required for AI usage tracking");
}
    const questions = await generateFormQuestions(prompt, userId);

    return res.status(200).json({
      message: "Form generated successfully",
      data: questions,
    });
  } catch (error: any) {
    // Surface token limit errors with structured response
    if (error instanceof AppError && error.statusCode === 429) {
      // Try to parse structured limit info from the error message
      let limitInfo: any = null;
      try {
        // Check if the message contains JSON (from tokenUsage.service)
        const jsonMatch = error.message.match(/Used:\s*(\d+),\s*Limit:\s*(\d+)/);
        if (jsonMatch) {
          limitInfo = {
            used: parseInt(jsonMatch[1]),
            limit: parseInt(jsonMatch[2]),
            remaining: 0,
          };
        }
      } catch { /* ignore parse errors */ }

      return res.status(429).json({
        message: "Token limit exceeded",
        limit: limitInfo?.limit ?? 0,
        used: limitInfo?.used ?? 0,
        remaining: 0,
      });
    }

    console.error("Form Generator Controller Error:", error);
    return res.status(500).json({
      message: "Failed to generate form",
      error: error.message || "An unknown error occurred",
    });
  }
};

import fs from "fs/promises";
import { generateFormQuestionsFromFile } from "./aiFormGenerator.service.js";

export const generateAIFormFromFileController = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const file = req.file;
    const prompt = req.body.prompt || "";
    
    if (!file) {
      return res.status(400).json({
        message: "Bad Request",
        error: "File is required",
      });
    }

    const userId = (req as any).user?._id?.toString();
    if (!userId) {
      throw new Error("User ID is required for AI usage tracking");
    }

    const questions = await generateFormQuestionsFromFile(file.path, file.originalname, prompt, userId);

    // Clean up file
    await fs.unlink(file.path).catch(console.error);

    return res.status(200).json({
      message: "Form generated successfully from file",
      data: questions,
    });
  } catch (error: any) {
    // Clean up file in case of error
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }
    
    if (error instanceof AppError && error.statusCode === 429) {
      return res.status(429).json({
        message: "Token limit exceeded",
        error: error.message
      });
    }

    console.error("Form Generator From File Controller Error:", error);
    return res.status(500).json({
      message: "Failed to generate form from file",
      error: error.message || "An unknown error occurred",
    });
  }
};
