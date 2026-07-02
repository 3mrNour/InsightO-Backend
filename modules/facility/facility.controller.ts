import type { Request, Response, NextFunction } from "express";
import Facility from "./facility.model.js";
import { AppError } from "../../utils/AppError.js";
import { asyncWrap } from "../../middlewares/asyncWrap.js";
import { EvaluationAggregationService } from "../../services/evaluationAggregation.service.js";
import { FormAIService } from "../../services/formAI.service.js";

export const createFacility = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { name, description, category, managed_by } = req.body;
  const user = (req as any).user;
  const created_by = user?.id || user?._id;

  const newFacility = await Facility.create({
    name,
    description,
    category,
    managed_by,
    created_by,
  });

  res.status(201).json({
    status: "success",
    data: { facility: newFacility },
  });
});

export const getFacilities = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  const userRole = user?.role;
  const userId = user?.id || user?._id;

  let query: any = {};

  if (userRole === "ADMIN") {
    query = {};
  } else {
    // Other authorized roles (e.g. HOD) can only see facilities they manage
    query = { managed_by: userId };
  }

  const facilities = await Facility.find(query)
    .populate("managed_by", "firstName lastName email")
    .populate("created_by", "firstName lastName email")
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    status: "success",
    count: facilities.length,
    data: { facilities },
  });
});

export const getFacilityById = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  const userRole = user?.role;
  const userId = user?.id || user?._id;

  const facility = await Facility.findById(req.params.id)
    .populate("managed_by", "firstName lastName email")
    .populate("created_by", "firstName lastName email")
    .lean();

  if (!facility) {
    return next(new AppError("Facility not found", 404));
  }

  // Ensure authorization (Admin or assigned manager)
  if (userRole !== "ADMIN" && facility.managed_by?.toString() !== userId.toString()) {
    return next(new AppError("Not authorized to view this facility", 403));
  }

  res.status(200).json({ status: "success", data: { facility } });
});

export const updateFacility = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const updateData = { ...req.body };

  const facility = await Facility.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!facility) {
    return next(new AppError("Facility not found", 404));
  }

  res.status(200).json({ status: "success", data: { facility } });
});

export const deleteFacility = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const facility = await Facility.findByIdAndDelete(req.params.id);

  if (!facility) {
    return next(new AppError("Facility not found", 404));
  }

  res.status(200).json({ status: "success", message: "Facility deleted successfully" });
});

export const getFacilityInsights = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const facility = await Facility.findById(req.params.id);
  if (!facility) {
    return next(new AppError("Facility not found", 404));
  }

  let chartData: any[] = [];
  let groupedData: Record<string, any> = {};
  let totalSubmissions = 0;

  try {
    const agg = await EvaluationAggregationService.aggregateSubjectHistory(facility._id);
    chartData = agg.chartData;
    groupedData = agg.groupedData;
    totalSubmissions = agg.totalSubmissions;
  } catch (error: any) {
    if (error.message === "EMPTY_DATASET") {
      return res.status(200).json({
        status: "success",
        data: {
          chartData: [],
          aiInsights: {
            overall_score: 0,
            trend_analysis: "No data available for analysis.",
            core_strengths: [],
            persistent_issues: [],
            action_plan: []
          },
          ai_status: "no_data"
        }
      });
    }
    return next(error);
  }

  // Clear bad cache
  if (facility.ai_evaluation_synthesis && facility.ai_evaluation_synthesis.trend_analysis === "Analysis failed.") {
    facility.ai_evaluation_synthesis = null;
    facility.ai_evaluation_count = 0;
  }

  const forceAI = req.query.forceAI === 'true';

  if (forceAI || totalSubmissions > (facility.ai_evaluation_count || 0)) {
    try {
      const user = (req as any).user;
      const aiResult = await FormAIService.processComparativeAnalysis(
        groupedData,
        "FACILITY",
        facility.name,
        "en",
        user?.id || user?._id || "anonymous"
      );

      facility.ai_evaluation_synthesis = aiResult;
      facility.ai_evaluation_count = totalSubmissions;
      facility.ai_evaluation_updated_at = new Date();
      await facility.save();
    } catch (aiError: any) {
      console.warn("AI Generation failed, falling back to cached data.", aiError);
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      chartData,
      aiInsights: facility.ai_evaluation_synthesis || null,
      ai_status: facility.ai_evaluation_synthesis ? "active" : "quota_exceeded_or_unavailable"
    }
  });
});
