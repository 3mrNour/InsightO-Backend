// src/modules/submission/submission.controller.ts

import type { Request, Response, NextFunction } from "express";
import Submission from "./submission.model.js";
import Question from "../question/models/Question_Schema.js";
import { AppError } from "../../utils/AppError.js";
import { asyncWrap } from "../../middlewares/asyncWrap.js";

/**
 * Validates an answer's value against its question's configuration.
 * Handles text, numeric scales, multiple choice arrays, and file metadata.
 */
const validateAnswerValue = (question: any, value: any) => {
  const isValueEmpty = value === undefined || value === null || value === "";

  // 1. Mandatory field check
  if (question.required && isValueEmpty) {
    throw new AppError(`Field "${question.label}" is required.`, 400);
  }

  // Skip validation if optional and empty
  if (isValueEmpty) return;

  // 2. Data type validation
  switch (question.type) {
    case "short_text":
    case "long_text":
      if (typeof value !== "string") {
        throw new AppError(`Answer for "${question.label}" must be text.`, 400);
      }
      break;

    case "linear_scale":
      if (typeof value !== "number") {
        throw new AppError(`Answer for "${question.label}" must be a number.`, 400);
      }
      break;

    case "multiple_choice":
      if (!Array.isArray(value)) {
        throw new AppError(`Answer for "${question.label}" must be a list of selections.`, 400);
      }
      break;

    case "file":
      if (typeof value !== "object" || !value.url || !value.type) {
        throw new AppError(`Invalid file information for "${question.label}".`, 400);
      }
      
      // Detailed file config validation (size & type)
      if (question.file_config) {
        const { allowed_types, max_size } = question.file_config;
        if (!allowed_types.includes(value.type)) {
          throw new AppError(`Type "${value.type}" is not allowed for "${question.label}".`, 400);
        }
        if (value.size && value.size > max_size) {
          throw new AppError(`File for "${question.label}" is too large.`, 400);
        }
      }
      break;
  }
};

/**
 * createSubmission
 * Handles form response submission with comprehensive validation.
 */
export const createSubmission = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const { formId } = req.params;
  const evaluator_id = (req as any).user?._id;
  const { subject_id, answers } = req.body;

  if (!evaluator_id) {
    return next(new AppError("User context missing. Please login again.", 401));
  }

  // 1. Fetch form questions to validate against
  const questions = await Question.find({ form_id: formId });
  
  if (!questions || questions.length === 0) {
    return next(new AppError("The specific form does not exist or has no questions.", 404));
  }

  // Build map for efficient validation
  const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

  // 2. Cross-reference answers with question requirements
  for (const answer of answers) {
    const question = questionMap.get(answer.question_id);

    if (!question) {
      return next(new AppError(`Invalid question reference: ${answer.question_id}`, 400));
    }

    try {
      validateAnswerValue(question, answer.value);
    } catch (err: any) {
      return next(err);
    }
  }

  // 3. Ensure all required questions were actually answered
  for (const question of questions) {
    if (question.required) {
      const isAnswered = answers.some((a: any) => a.question_id === question._id.toString());
      if (!isAnswered) {
        return next(new AppError(`Required question missing: "${question.label}"`, 400));
      }
    }
  }

  // 4. Persistence
  try {
    const submission = await Submission.create({
      form_id: formId,
      evaluator_id,
      subject_id,
      answers,
    });

    return res.status(201).json({
      status: "success",
      data: submission,
    });
  } catch (error: any) {
    // Handle uniqueness violation (User trying to submit twice)
    if (error.code === 11000) {
      return next(new AppError("You have already submitted a response for this form.", 400));
    }
    return next(error);
  }
});
