// src/modules/taskSubmittion/taskSubmittion.controller.ts

import type { Request, Response, NextFunction } from "express";
import TaskSubmission from "./taskSubmittion.model.js";
import Task from "../task/task.model.js";
import { AppError } from "../../utils/AppError.js";
import { asyncWrap } from "../../middlewares/asyncWrap.js";
import { gradeSubmission } from "../AI/aiGrader.service.js";
import { Chunk } from "../AI/chunk.model.js";
import mongoose from "mongoose";
import { IngestionService } from "../AI/ingestion.service.js";
export const submitTask = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const { content, attachments, form_answers } = req.body;
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
    form_answers,
  });

  // ─── AI Grading Hook (Vectorized Chunks Integration) ──────────────────────────
  setImmediate(async () => {
    try {
      let textToGrade = content || "";
      let rubricToUse = task.ai_grading_rubric || "";

      // 0. Processing Attachments via IngestionService
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.url) {
            try {
              await IngestionService.processAndStore({
                url: attachment.url,
                metadata: {
                  taskId: taskId.toString(),
                  submissionId: submission._id.toString(),
                  source: "student_attachment",
                  fileName: attachment.fileName
                }
              });
              console.log(`[aiGrader] Successfully ingested attachment: ${attachment.fileName || attachment.url}`);
            } catch (err: any) {
              console.error(`[aiGrader] Failed to ingest attachment ${attachment.url}:`, err?.message ?? err);
            }
          }
        }
      }

      // 1. السحر كله هنا: سحب الـ Chunks الجاهزة من الداتابيز!
      // بنجيب الـ Chunks الخاصة بالتاسك أو بالتسليم ده مباشرة
      const chunks = await Chunk.find({
        $or: [
          { taskId: taskId.toString() },
          { submissionId: submission._id.toString() } // لو إنت رابط الـ Chunks برقم التسليم
        ]
      });

      let chunkText = "";
      if (chunks && chunks.length > 0) {
        chunkText = chunks.map(c => c.text).join("\n\n");
      }

      // 2. لو الطالب رافع ملف (Attachments).. هنخلي الـ AI يقرأ الـ Chunks مباشرة! (ولا كأن فيه URL)
      if (!textToGrade.trim() && attachments && attachments.length > 0) {
        textToGrade = chunkText ? `[VECTORIZED CHUNKS CONTENT]:\n${chunkText}` : "// No chunks processed yet.";
        chunkText = ""; // بنفضيها عشان متبقاش متكررة في الـ Rubric تحت
      }
      // 3. لو مش فايل، بنضيف الـ Chunks كـ Context عادي للـ Rubric
      else if (chunkText) {
        rubricToUse = rubricToUse ? `${rubricToUse}\n\n[CONTEXT PROVIDED]:\n${chunkText}` : chunkText;
      }

      // 4. تجميع إجابات الكويز (لو موجودة)
      if (form_answers && Array.isArray(form_answers) && form_answers.length > 0) {
        const form = await mongoose.model('Form').findById(task.form_id).populate('questions');
        const formattedAnswers = form_answers.map((ans: any, idx: number) => {
          let qLabel = `Question ${idx + 1}`;
          if (form && form.questions) {
            const matchedQ = form.questions.find((q: any) => String(q._id) === String(ans.question_id));
            if (matchedQ) qLabel = matchedQ.label;
          }
          const val = Array.isArray(ans.value) ? ans.value.join(', ') : String(ans.value);
          return `Question: ${qLabel}\nAnswer: ${val}`;
        }).join("\n\n---\n\n");

        textToGrade = textToGrade ? `${textToGrade}\n\n[QUIZ RESPONSES]\n${formattedAnswers}` : formattedAnswers;
      }

      // لو مفيش أي داتا أو Chunks اخرج
      if (!textToGrade.trim() || textToGrade === "// No chunks processed yet.") {
        console.log(`[aiGrader] Submission ${submission._id} lacks chunks or content. Skipping.`);
        return;
      }

      // 5. استدعاء الـ AI (دلوقتي الـ content جواه الـ Chunks اللي فيها كود الـ JS!)
      const result = await gradeSubmission({
        content: textToGrade,
        rubric: rubricToUse,
        type: task.task_type === 'QUIZ' ? 'text' : 'file',
        userId: task.creator_id.toString(),
      });

      // 🎯 التحديث الشامل (مع حل مشكلة Mongoose Warning)
      await TaskSubmission.findByIdAndUpdate(
        submission._id,
        {
          ai_evaluation: {
            suggested_grade: result.proposed_grade,
            feedback: result.feedback,
            confidence_score: result.confidence,
            weaknesses: result.weaknesses || [],
            recommendations: result.recommendations || [],
            criteria_breakdown: result.criteria_breakdown || [],
            concept_mastery: result.concept_mastery || [],
            quality_metrics: result.quality_metrics || { readability: 0, complexity_score: 0, security_guardrails: 0 }
          },
          status: "AI_GRADED",
        },
        // 👇 التحذير المزعج بتاع Mongoose اختفى بسبب دي
        { strict: false, returnDocument: 'after' }
      );

      console.log(`[aiGrader] Successfully saved full rich metrics for submission ${submission._id}`);
    } catch (err: any) {
      console.error(`[aiGrader] Failed to grade submission ${submission._id}:`, err?.message ?? err);
    }
  });
  // ───────────────────────────────────────────────────────────────────────────

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
    // 👈 السحر هنا: بنجيب بيانات السؤال (النص، النوع، الخيارات) ونزرعها جوه الإجابة
    .populate({
      path: 'form_answers.question_id',
      select: 'label type options'
    })
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
    .populate('task_id', 'title description deadline ai_grading_rubric status task_type form_id')
    // 👈 وضفناها هنا كمان عشان الطالب لو شاف درجاته يشوف أسئلة الكويز صح
    .populate({
      path: 'form_answers.question_id',
      select: 'label type options'
    })
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    count: submissions.length,
    data: { submissions }
  });
});