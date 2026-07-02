import type { Request, Response, NextFunction } from "express";
import { asyncWrap } from "../../middlewares/asyncWrap.js";
import { AppError } from "../../utils/AppError.js";
import User from "../auth/model/User_Schema.js";
import StudentProfile from "./model/StudentProfile.js";
import InstructorProfile from "./model/InstructorProfile.js";
import HODProfile from "./model/HODProfile.js";
import TaskSubmission from "../taskSubmittion/taskSubmittion.model.js";
import { ProfileAIService } from "../AI/profileAI.service.js";
import { EvaluationAggregationService } from "../../services/evaluationAggregation.service.js";
import { FormAIService } from "../../services/formAI.service.js";

export const getProfileAnalytics = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  const reqUser = (req as any).user;
  const reqUserId = reqUser._id.toString();

  // 1. Fetch Target User Details
  const targetUser = await User.findById(userId).select('-password');
  if (!targetUser) {
    return next(new AppError("User not found", 404));
  }

  // 2. Fetch the target user's profile based on their role
  let profileDoc: any = null;
  if (targetUser.role === 'STUDENT') {
    profileDoc = await StudentProfile.findOne({ userId }).populate('departmentId').populate('enrolledCourses');
  } else if (targetUser.role === 'INSTRUCTOR') {
    profileDoc = await InstructorProfile.findOne({ userId }).populate('departmentId').populate('teachingCourses');
  } else if (targetUser.role === 'HOD') {
    profileDoc = await HODProfile.findOne({ userId }).populate('departmentId');
  }

  if (!profileDoc && targetUser.role !== 'ADMIN') {
    return next(new AppError("Profile not found for this user", 404));
  }

  // 3. RBAC Security Checks
  const isSelf = reqUserId === userId;
  const isAdmin = reqUser.role === 'ADMIN';

  if (!isSelf && !isAdmin) {
    if (reqUser.role === 'STUDENT') {
      return next(new AppError("Access denied. You can only view your own profile.", 403));
    }

    if (reqUser.role === 'INSTRUCTOR') {
      if (targetUser.role !== 'STUDENT') {
        return next(new AppError("Access denied. Instructors can only view student profiles.", 403));
      }
      // Instructor can only view students enrolled in their courses
      const instructorProfile = await InstructorProfile.findOne({ userId: reqUserId });
      if (!instructorProfile) return next(new AppError("Instructor profile not found.", 403));

      const studentCourses = profileDoc ? profileDoc.enrolledCourses.map((c: any) => c._id?.toString() || c.toString()) : [];
      const instructorCourses = instructorProfile.teachingCourses.map(c => c.toString());

      const hasSharedCourse = studentCourses.some((c: string) => instructorCourses.includes(c));
      if (!hasSharedCourse) {
        return next(new AppError("Access denied. Student is not enrolled in your courses.", 403));
      }
    }

    if (reqUser.role === 'HOD') {
      if (targetUser.role === 'ADMIN' || targetUser.role === 'HOD') {
        return next(new AppError("Access denied.", 403));
      }
      // HOD can view anyone in their departments
      const hodProfile = await HODProfile.findOne({ userId: reqUserId });
      if (!hodProfile || !hodProfile.departmentIds || hodProfile.departmentIds.length === 0) {
        return next(new AppError("HOD profile not found or no departments assigned.", 403));
      }

      const targetDepartment = profileDoc ? (profileDoc.departmentId?._id?.toString() || profileDoc.departmentId?.toString()) : null;
      const isAuthorized = targetDepartment && hodProfile.departmentIds.some(id => id.toString() === targetDepartment);
      
      if (!isAuthorized) {
        return next(new AppError("Access denied. User is not in your department.", 403));
      }
    }
  }

  // 4. Instructor & HOD Flow
  if (targetUser.role === 'INSTRUCTOR' || targetUser.role === 'HOD' || targetUser.role === 'ADMIN') {
    return res.status(200).json({
      status: "success",
      data: {
        user: {
          _id: targetUser._id,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          email: targetUser.email,
          role: targetUser.role
        },
        profile: profileDoc,
        aggregated_metrics: {
          total_submissions: 0,
          average_suggested_grade: 0,
          average_confidence_score: 0,
          concept_mastery: []
        },
        task_history: [],
        ai_synthesis: profileDoc?.ai_synthesis || null
      }
    });
  }

  // 5. STUDENT Flow - Data Aggregation & Smart Caching
  const submissions = await TaskSubmission.find({
    submitter_id: userId,
    status: { $in: ['AI_GRADED', 'FINALIZED'] }
  }).populate('task_id', 'title task_type course_id');

  let totalGrade = 0;
  let totalConfidence = 0;
  let validGradeCount = 0;
  let validConfidenceCount = 0;

  const conceptMasteryMap: Record<string, { total: number; count: number }> = {};
  const allWeaknesses: string[] = [];
  const allRecommendations: string[] = [];

  submissions.forEach(sub => {
    const ai = sub.ai_evaluation;
    if (!ai) return;

    if (ai.suggested_grade !== undefined && ai.suggested_grade !== null) {
      totalGrade += ai.suggested_grade;
      validGradeCount++;
    }

    if (ai.confidence_score !== undefined && ai.confidence_score !== null) {
      totalConfidence += ai.confidence_score;
      validConfidenceCount++;
    }

    if (ai.concept_mastery && Array.isArray(ai.concept_mastery)) {
      ai.concept_mastery.forEach((cm: any) => {
        if (!conceptMasteryMap[cm.concept]) {
          conceptMasteryMap[cm.concept] = { total: 0, count: 0 };
        }
        conceptMasteryMap[cm.concept].total += cm.mastery_level || 0;
        conceptMasteryMap[cm.concept].count++;
      });
    }

    if (ai.weaknesses && Array.isArray(ai.weaknesses)) {
      allWeaknesses.push(...ai.weaknesses);
    }

    if (ai.recommendations && Array.isArray(ai.recommendations)) {
      allRecommendations.push(...ai.recommendations);
    }
  });

  const avgSuggestedGrade = validGradeCount > 0 ? totalGrade / validGradeCount : 0;
  const avgConfidenceScore = validConfidenceCount > 0 ? totalConfidence / validConfidenceCount : 0;

  const aggregatedConcepts = Object.keys(conceptMasteryMap).map(concept => ({
    concept,
    average_mastery: conceptMasteryMap[concept].total / conceptMasteryMap[concept].count
  }));

  const uniqueWeaknesses = [...new Set(allWeaknesses)].filter(Boolean);
  const uniqueRecommendations = [...new Set(allRecommendations)].filter(Boolean);

  let ai_synthesis = null;

  if (submissions.length > 0 && profileDoc) {
    const hasNewSubmissions = profileDoc.ai_synthesis_task_count !== submissions.length;

    if (!hasNewSubmissions && profileDoc.ai_synthesis) {
      // Use cache
      ai_synthesis = profileDoc.ai_synthesis;
    } else {
      // Call AI Service
      const trackingUserId = reqUser._id.toString();
      try {
        ai_synthesis = await ProfileAIService.synthesizeProfile(
          {
            avgSuggestedGrade,
            avgConfidenceScore,
            aggregatedConcepts,
            uniqueWeaknesses,
            uniqueRecommendations
          },
          trackingUserId
        );

        // Save Cache
        profileDoc.ai_synthesis = ai_synthesis;
        profileDoc.ai_synthesis_task_count = submissions.length;
        profileDoc.ai_synthesis_updated_at = new Date();
        await profileDoc.save();
      } catch (error: any) {
        if (error.message === "OPENAI_API_KEY is not configured") {
          return next(new AppError("OPENAI_API_KEY is not configured", 500));
        }
        console.error("[ProfileAnalytics] AI Synthesis failed at controller layer:", error);
      }
    }
  }

  // 6. Response
  res.status(200).json({
    status: "success",
    data: {
      user: {
        _id: targetUser._id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        email: targetUser.email,
        role: targetUser.role
      },
      profile: profileDoc,
      aggregated_metrics: {
        total_submissions: submissions.length,
        average_suggested_grade: avgSuggestedGrade,
        average_confidence_score: avgConfidenceScore,
        concept_mastery: aggregatedConcepts
      },
      task_history: submissions.map(sub => ({
        _id: sub._id,
        task_id: sub.task_id,
        status: sub.status,
        final_grade: sub.final_grade,
        ai_suggested_grade: sub.ai_evaluation?.suggested_grade,
        updatedAt: sub.updatedAt
      })),
      ai_synthesis
    }
  });
});

export const getInstructorInsights = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  
  // Find instructor
  const instructor = await User.findById(id);
  if (!instructor || instructor.role !== 'INSTRUCTOR') {
    return next(new AppError("Instructor not found", 404));
  }

  const profile = await InstructorProfile.findOne({ userId: id });
  if (!profile) {
    return next(new AppError("Instructor profile not found", 404));
  }

  const { chartData, groupedData, totalSubmissions } = await EvaluationAggregationService.aggregateSubjectHistory(instructor._id);

  const forceAI = req.query.forceAI === 'true';

  if (forceAI || totalSubmissions > ((profile as any).ai_evaluation_count || 0)) {
    try {
      const reqUser = (req as any).user;
      const fullName = `${instructor.firstName} ${instructor.lastName}`.trim();
      
      const aiResult = await FormAIService.processComparativeAnalysis(
        groupedData,
        "INSTRUCTOR",
        fullName,
        "en",
        reqUser?.id || reqUser?._id || "anonymous"
      );

      (profile as any).ai_evaluation_synthesis = aiResult;
      (profile as any).ai_evaluation_count = totalSubmissions;
      (profile as any).ai_evaluation_updated_at = new Date();
      await profile.save();
    } catch (aiError: any) {
      console.warn("AI Generation failed (Quota or API Error), falling back to cached data.", aiError);
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      chartData,
      aiInsights: (profile as any).ai_evaluation_synthesis || null,
      ai_status: (profile as any).ai_evaluation_synthesis ? "active" : "quota_exceeded_or_unavailable"
    }
  });
});
