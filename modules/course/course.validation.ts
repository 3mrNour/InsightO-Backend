import { z } from 'zod';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

// ─── Body Schema ───────────────────────────────────────────────────────────────

const createCourseBodySchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  courseCode: z.string().min(1, "Course code is required").trim().toUpperCase(),
  description: z.string().trim().optional(),
  departmentId: objectId,
  instructorId: objectId,
  credits: z.number().min(1, "Credits must be at least 1").max(10, "Credits cannot exceed 10").optional(),
  isActive: z.boolean().optional().default(true),
});

// ─── Params Schema ────────────────────────────────────────────────────────────

const courseIdParamsSchema = z.object({
  id: objectId
});

// ─── Full Schemas ──────────────────────────────────────────────────────────────

export const createCourseSchema = z.object({
  body: createCourseBodySchema,
});

export const updateCourseSchema = z.object({
  params: courseIdParamsSchema,
  body: createCourseBodySchema.partial(),
});

export const getCourseParamsSchema = z.object({
  params: courseIdParamsSchema,
});

export const enrollStudentsSchema = z.object({
  params: courseIdParamsSchema,
  body: z.object({
    studentIds: z.array(objectId).min(1, "At least one student ID must be provided"),
  }),
});
