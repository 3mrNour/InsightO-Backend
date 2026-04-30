// src/modules/submission/submission.validat.ts

import { z } from 'zod';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

// ─── Answer Value Schema ──────────────────────────────────────────────────────

const answerValueSchema = z.union([
  z.string().min(1, "Text answer cannot be empty"),
  z.number(),
  z.array(z.string()).min(1, "At least one option must be selected"),
  z.object({
    url: z.string().url("Invalid file URL"),
    type: z.string().min(1, "File type required"),
    size: z.number().positive("File size must be positive").optional(),
  })
]).refine(
  (val) => val !== undefined && val !== null,
  "Answer value is required"
);

// ─── Answer Schema ────────────────────────────────────────────────────────────

const answerSchema = z.object({
  question_id: objectId,
  value: answerValueSchema
});

// ─── Body Schema ───────────────────────────────────────────────────────────────

const submissionBodySchema = z.object({
  subject_id: objectId,
  answers: z
    .array(answerSchema)
    .min(1, "At least one answer is required")
    .refine(
      (answers) => {
        const ids = answers.map(a => a.question_id);
        return new Set(ids).size === ids.length;
      },
      { message: "Duplicate question_id not allowed" }
    )
});

// ─── Params Schema ────────────────────────────────────────────────────────────

const submissionParamsSchema = z.object({
  formId: objectId
});

// ─── Full Schema ───────────────────────────────────────────────────────────────

export const createSubmissionSchema = z.object({
  body: submissionBodySchema,
  params: submissionParamsSchema,
});
