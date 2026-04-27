// src/modules/submission/submission.validat.ts

import { z } from 'zod';

/**
 * Submission Validation Schema
 * Validates the structure of the incoming submission request.
 */
export const createSubmissionSchema = z.object({
  body: z.object({
    subject_id: z.string({
      required_error: "subject_id is required",
    }),
    answers: z
      .array(
        z.object({
          question_id: z.string({
            required_error: "question_id is required for each answer",
          }),
          value: z.any({
            required_error: "value is required for each answer",
          }),
        })
      )
      .min(1, "At least one answer is required"),
  }),
  params: z.object({
    formId: z.string({
      required_error: "formId is required in params",
    }),
  }),
});
