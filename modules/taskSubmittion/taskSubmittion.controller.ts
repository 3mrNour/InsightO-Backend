// src/modules/taskSubmittion/taskSubmittion.controller.ts

import type { Request, Response, NextFunction } from "express";
import TaskSubmission from "./taskSubmittion.model.js";
import Task from "../task/task.model.js";
import { AppError } from "../../utils/AppError.js";
import { asyncWrap } from "../../middlewares/asyncWrap.js";
import { gradeSubmission } from "../AI/aiGrader.service.js";

// 1. الطالب بيسلم التاسك
export const submitTask = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const { content, attachments } = req.body;
  const taskId = req.params.taskId;
  const user = (req as any).user;
  const userId = user.id || user._id;

  // فحص 1: هل التاسك موجود؟
  const task = await Task.findById(taskId);
  if (!task) return next(new AppError("Task not found", 404));

  // فحص 2: هل التاسك لسه متاح للتسليم؟
  if (task.status !== 'ACTIVE') {
    return next(new AppError("This task is closed for submissions", 400));
  }

  // فحص 3: هل الـ Deadline عدى؟
  if (new Date() > new Date(task.deadline)) {
    return next(new AppError("Submission deadline has passed", 400));
  }

  // فحص 4: منع التسليم المزدوج
  const existingSubmission = await TaskSubmission.findOne({ task_id: taskId, submitter_id: userId });
  if (existingSubmission) {
    return next(new AppError("You have already submitted this task.", 400));
  }

  // إنشاء التسليم
  const submission = await TaskSubmission.create({
    task_id: taskId,
    submitter_id: userId,
    content,
    attachments,
  });



  res.status(201).json({
    status: "success",
    message: "Task submitted successfully.",
    data: { submission }
  });
});

// 2. جلب تسليمات تاسك معين (للدكتور/رئيس القسم)
export const getTaskSubmissions = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const taskId = req.params.taskId;
  
  const task = await Task.findById(taskId);
  if (!task) return next(new AppError("Task not found", 404));

  const submissions = await TaskSubmission.find({ task_id: taskId })
    .populate('submitter_id', 'firstName lastName email nationalId')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    count: submissions.length,
    data: { submissions }
  });
});

// 3. التقييم البشري النهائي
export const finalizeGrade = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const { submissionId } = req.params;
  const { final_grade, instructor_feedback } = req.body;
  const user = (req as any).user;
  const userId = user.id || user._id;

  const submission = await TaskSubmission.findById(submissionId).populate('task_id');
  if (!submission) return next(new AppError("Submission not found", 404));

  const task = submission.task_id as any;

 // التأكد إن اللي بيقيم هو صاحب التاسك أو أدمن
  if (task.creator_id.toString() !== userId.toString() && user.role !== "ADMIN") {
    return next(new AppError("Not authorized to grade this submission", 403));
  }

  submission.final_grade = final_grade;
  submission.instructor_feedback = instructor_feedback;
  submission.status = 'FINALIZED';

  await submission.save();

  res.status(200).json({
    status: "success",
    message: "Grade finalized successfully",
    data: { submission }
  });
});

// 4. جلب تسليمات المستخدم الحالي (لصفحة التقييمات)
export const getMySubmissions = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const userId = user.id || user._id;

  const submissions = await TaskSubmission.find({ submitter_id: userId })
    .populate('task_id', 'title description deadline ai_grading_rubric status')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    count: submissions.length,
    data: { submissions }
  });
});