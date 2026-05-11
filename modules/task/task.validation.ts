import { z } from 'zod';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const targetSchema = z.object({
  department_id: objectId.optional(),
  course_id: objectId.optional(),
  specific_users: z.array(objectId).optional(),
}).refine(
  (data) => data.department_id || data.course_id || (data.specific_users && data.specific_users.length > 0),
  "At least one target (department_id, course_id, or specific_users) must be provided"
);

const attachmentSchema = z.object({
  url: z.string().url("Invalid file URL"),
  fileName: z.string().optional(),
  size: z.number().positive("File size must be positive").optional(),
});

// ─── Body Schema ───────────────────────────────────────────────────────────────

const createTaskBodySchema = z.object({
  title: z.string().min(1, "Title is required").trim(),
  description: z.string().min(1, "Description is required"),
  target: targetSchema,
  attachments: z.array(attachmentSchema).optional(),
  ai_grading_rubric: z.string().optional(),
  deadline: z.string().datetime("Invalid ISO date string").or(z.date()),
  status: z.enum(["ACTIVE", "CLOSED"]).optional().default("ACTIVE"),
});

// ─── Params Schema ────────────────────────────────────────────────────────────

const taskIdParamsSchema = z.object({
  taskId: objectId
});

// ─── Full Schemas ──────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  body: createTaskBodySchema,
});

export const updateTaskSchema = z.object({
  params: taskIdParamsSchema,
  body: createTaskBodySchema.partial(),
});

export const getTaskParamsSchema = z.object({
  params: taskIdParamsSchema,
});
