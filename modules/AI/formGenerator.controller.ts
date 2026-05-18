import type { Request, Response } from "express";
import { generateFormQuestions } from "./aiFormGenerator.service.js";

export const generateAIForm = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        message: "Bad Request",
        error: "Prompt is required and must be a string",
      });
    }

    const questions = await generateFormQuestions(prompt);

    return res.status(200).json({
      message: "Form generated successfully",
      data: questions,
    });
  } catch (error: any) {
    console.error("Form Generator Controller Error:", error);
    return res.status(500).json({
      message: "Failed to generate form",
      error: error.message || "An unknown error occurred",
    });
  }
};
