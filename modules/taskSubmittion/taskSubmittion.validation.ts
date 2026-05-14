import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

const attachmentSchema = z.object({
  url: z.string().min(1, "Invalid file URL"),
  fileName: z.string().optional(),
  size: z.number().positive("File size must be positive").optional(),
});

export const submitTaskBodySchema = z.object({
  content: z.string().trim().optional(),
  attachments: z.array(attachmentSchema).optional(),
}).refine(data => data.content || (data.attachments && data.attachments.length > 0), {
  message: "Submission must contain either content or attachments",
});

export const submitTaskSchema = z.object({
  params: z.object({ taskId: objectId }),
  body: submitTaskBodySchema,
});

export const finalizeGradeBodySchema = z.object({
  final_grade: z.number().min(0, "Grade cannot be negative"),
  instructor_feedback: z.string().trim().optional(),
});

export const finalizeGradeSchema = z.object({
  params: z.object({ submissionId: objectId }),
  body: finalizeGradeBodySchema,
});

export const getTaskSubmissionsSchema = z.object({
  params: z.object({ taskId: objectId }),
});
