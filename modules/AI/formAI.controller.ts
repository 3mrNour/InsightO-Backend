import type { Request, Response, NextFunction } from "express";
import { FormAIService } from "../../services/formAI.service.js";
import { AppError } from "../../utils/AppError.js";

/**
 * Basic Tag-level Form Feedback Analysis
 * GET /api/ai/analyze-form/:formId
 */
export const getFormSubmissionAnalysis = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { formId } = req.params;
    if (!formId || typeof formId !== "string") {
      return next(new AppError("Form ID must be a string", 400));
    }

    const result = await FormAIService.processFormSubmissionAnalysis(formId);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error: any) {
    // Surface token limit errors with structured response
    if (error instanceof AppError && error.statusCode === 429) {
      res.status(429).json({
        status: "error",
        error: "Token limit exceeded",
        limit: 80000,
        message: error.message,
      });
      return;
    }
    console.error("[FormAIController] getFormSubmissionAnalysis error:", error);
    next(error);
  }
};

/**
 * Deep Strategic Cross-Category Form Feedback Analysis
 * GET /api/ai/analyze-form/:formId/deep
 */
export const getFormDeepAnalysis = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { formId } = req.params;
    if (!formId || typeof formId !== "string") {
      return next(new AppError("Form ID must be a string", 400));
    }

    const result = await FormAIService.processFormDeepAnalysis(formId);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error: any) {
    // Surface token limit errors with structured response
    if (error instanceof AppError && error.statusCode === 429) {
      res.status(429).json({
        status: "error",
        error: "Token limit exceeded",
        limit: 80000,
        message: error.message,
      });
      return;
    }
    console.error("[FormAIController] getFormDeepAnalysis error:", error);
    next(error);
  }
};
