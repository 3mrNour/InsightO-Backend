import type { Request, Response } from "express";
import { GradingService } from "./grading.service.js";

export const gradeSubmission = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { submission } = req.body;

    if (!submission || typeof submission !== "string") {
      return res.status(400).json({
        message: "Bad Request",
        error: "Submission text is required and must be a string",
      });
    }

    const gradingResult = await GradingService.gradeSubmission(submission);

    return res.status(200).json({
      message: "Graded successfully",
      data: gradingResult,
    });
  } catch (error: any) {
    console.error("Grading Controller Error:", error);
    return res.status(500).json({
      message: "Failed to grade submission",
      error: error.message || "An unknown error occurred",
    });
  }
};
