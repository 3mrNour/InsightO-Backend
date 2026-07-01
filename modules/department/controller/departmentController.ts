import type { NextFunction, Request, Response } from 'express';
import Department from '../model/Department.js';
import HODProfile from '../../profile/model/HODProfile.js';
import { AppError } from '../../../utils/AppError.js';
import { EvaluationAggregationService } from '../../../services/evaluationAggregation.service.js';
import { FormAIService } from '../../../services/formAI.service.js';

export const createDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, code, description, hodId } = req.body;
    const department = await Department.create({ name, code, description });
    
    if (hodId) {
      await HODProfile.findOneAndUpdate(
        { userId: hodId },
        { departmentId: department._id },
        { upsert: true }
      );
    }

    res.status(201).json({ status: 'success', data: department });
  } catch (error: any) {
    if (error?.code === 11000) {
      return next(new AppError('Department code already exists', 409));
    }
    next(error);
  }
};

export const getAllDepartments = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departments = await Department.find().sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: departments.length, data: departments });
  } catch (error) {
    next(error);
  }
};

export const getDepartmentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return next(new AppError('Department not found', 404));
    }
    res.status(200).json({ status: 'success', data: department });
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { hodId, ...updateData } = req.body;
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    );
    if (!department) {
      return next(new AppError('Department not found', 404));
    }

    if (hodId) {
      await HODProfile.findOneAndUpdate(
        { userId: hodId },
        { departmentId: department._id },
        { upsert: true }
      );
    }

    res.status(200).json({ status: 'success', data: department });
  } catch (error: any) {
    if (error?.code === 11000) {
      return next(new AppError('Department code already exists', 409));
    }
    next(error);
  }
};

export const deleteDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) {
      return next(new AppError('Department not found', 404));
    }
    res.status(200).json({ status: 'success', message: 'Department deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getDepartmentInsights = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return next(new AppError('Department not found', 404));
    }

    let chartData: any[] = [];
    let groupedData: Record<string, any> = {};
    let totalSubmissions = 0;

    try {
      const agg = await EvaluationAggregationService.aggregateSubjectHistory(department._id);
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
              trend_analysis: "No data available",
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

    const forceAI = req.query.forceAI === 'true';

    // Smart Caching & Fallback Logic
    if (forceAI || totalSubmissions > ((department as any).ai_evaluation_count || 0)) {
      try {
        const user = (req as any).user;
        const aiResult = await FormAIService.processComparativeAnalysis(
          groupedData,
          "DEPARTMENT",
          department.name,
          "en",
          user?.id || user?._id || "anonymous"
        );

        // Update cache
        (department as any).ai_evaluation_synthesis = aiResult;
        (department as any).ai_evaluation_count = totalSubmissions;
        (department as any).ai_evaluation_updated_at = new Date();
        await department.save();
      } catch (aiError: any) {
        console.warn("AI Generation failed (Quota or API Error), falling back to cached data.", aiError);
      }
    }

    res.status(200).json({
      status: "success",
      data: {
        chartData,
        aiInsights: (department as any).ai_evaluation_synthesis || null,
        ai_status: (department as any).ai_evaluation_synthesis ? "active" : "quota_exceeded_or_unavailable"
      }
    });
  } catch (error) {
    next(error);
  }
};
