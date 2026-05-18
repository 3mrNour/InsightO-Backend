import type { Request, Response, NextFunction } from "express";
import { FormAIService } from "../../services/formAI.service.js";
import { AppError } from "../../utils/AppError.js";

/**
 * Basic Tag-level Form Feedback Analysis
 * GET /api/ai/analyze-form/:formId
 * Aggregates answers by tag, chunks them, and runs tag-level AI feedback collectively.
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

    const analysisResult = await FormAIService.processFormSubmissionAnalysis(formId);

    res.status(200).json({
      status: "success",
      data: analysisResult,
    });
  } catch (error: any) {
    console.error("[FormAIController] getFormSubmissionAnalysis error:", error);
    next(error);
  }
};

/**
 * Deep Strategic Cross-Category Form Feedback Analysis
 * GET /api/ai/analyze-form/:formId/deep
 * Performs tag-level analyses and aggregates them to perform global/cross-category strategic analysis.
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

    const deepAnalysisResult = await FormAIService.processFormDeepAnalysis(formId);

    res.status(200).json({
      status: "success",
      data: deepAnalysisResult,
    });
  } catch (error: any) {
    console.error("[FormAIController] getFormDeepAnalysis error:", error);
    next(error);
  }
};
