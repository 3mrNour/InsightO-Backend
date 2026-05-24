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

    const userId = (req as any).user?._id?.toString() || "anonymous";
    const result = await FormAIService.processFormSubmissionAnalysis(formId, userId);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error: any) {
    // Surface token limit errors with structured response
    if (error instanceof AppError && error.statusCode === 429) {
      let limitInfo: any = null;
      try {
        const jsonMatch = error.message.match(/Used:\s*(\d+),\s*Limit:\s*(\d+)/);
        if (jsonMatch) {
          limitInfo = { used: parseInt(jsonMatch[1]), limit: parseInt(jsonMatch[2]) };
        }
      } catch { /* ignore */ }

      res.status(429).json({
        status: "error",
        message: "Token limit exceeded",
        limit: limitInfo?.limit ?? 80000,
        used: limitInfo?.used ?? 0,
        remaining: 0,
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

    const userId = (req as any).user?._id?.toString() || "anonymous";
    const result = await FormAIService.processFormDeepAnalysis(formId, userId);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error: any) {
    // Surface token limit errors with structured response
    if (error instanceof AppError && error.statusCode === 429) {
      let limitInfo: any = null;
      try {
        const jsonMatch = error.message.match(/Used:\s*(\d+),\s*Limit:\s*(\d+)/);
        if (jsonMatch) {
          limitInfo = { used: parseInt(jsonMatch[1]), limit: parseInt(jsonMatch[2]) };
        }
      } catch { /* ignore */ }

      res.status(429).json({
        status: "error",
        message: "Token limit exceeded",
        limit: limitInfo?.limit ?? 80000,
        used: limitInfo?.used ?? 0,
        remaining: 0,
      });
      return;
    }
    console.error("[FormAIController] getFormDeepAnalysis error:", error);
    next(error);
  }
};
