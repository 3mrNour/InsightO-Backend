// src/modules/submission/submission.controller.ts

import type { Request, Response, NextFunction } from "express";
import Submission from "./submission.model.js";
import Question from "../question/models/Question_Schema.js";

import { AppError } from "../../utils/AppError.js";
import { asyncWrap } from "../../middlewares/asyncWrap.js";
import Form from "../form/model/formSchema.js";
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

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
      if (typeof value !== "string") {
        throw new AppError(`Answer for "${question.label}" must be text.`, 400);
      }
      if (question.text_validation) {
        if (question.text_validation.type === 'email') {
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          if (!emailRegex.test(value)) {
            throw new AppError(`Answer for "${question.label}" must be a valid email format.`, 400);
          }
        }
        if (question.text_validation.type === 'phone') {
          const phoneNumber = parsePhoneNumberFromString(value);
          if (!phoneNumber || !phoneNumber.isValid()) {
            throw new AppError(`Answer for "${question.label}" must be a valid phone number.`, 400);
          }
        }
        if (question.text_validation.type === 'url') {
          const urlRegex = /^https?:\/\/.+/;
          if (!urlRegex.test(value)) {
            throw new AppError(`Answer for "${question.label}" must be a valid URL.`, 400);
          }
        }
      }
      break;

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
      if (typeof value !== "string" && !Array.isArray(value)) {
        throw new AppError(`Answer for "${question.label}" must be a selection or list of selections.`, 400);
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

  const formId = req.params.formId as string;
  const evaluator_id = (req as any).user?._id;
  const { subject_id, answers, task_id } = req.body;

  if (!evaluator_id) {
    return next(new AppError("User context missing", 401));
  }

  //  validate answers structure
  if (!Array.isArray(answers) || answers.length === 0) {
    return next(new AppError("Answers must be a non-empty array", 400));
  }

  // prevent duplicate answers
  const seen = new Set();
  for (const a of answers) {
    if (seen.has(a.question_id)) {
      return next(new AppError(`Duplicate answer for question ${a.question_id}`, 400));
    }
    seen.add(a.question_id);
  }

  // fetch form with populated questions
  const form = await Form.findById(formId).populate({
    path: 'questions',
    select: 'label type required options ai_tag order file_config scale text_validation'
  });
  if (!form) return next(new AppError("Form not found", 404));

  //  check form state
  if (!form.is_active) {
    return next(new AppError("Form is not active", 400));
  }

  //  fetch questions
  const questions = await Question.find({ form_id: formId });

  const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

  // validate answers
  for (const answer of answers) {
    const question = questionMap.get(answer.question_id);

    if (!question) {
      return next(new AppError(`Invalid question ${answer.question_id}`, 400));
    }

    validateAnswerValue(question, answer.value);
  }

  //  required questions
  const answeredSet = new Set(answers.map(a => a.question_id));

  for (const q of questions) {
    if (q.required && !answeredSet.has(q._id.toString())) {
      return next(new AppError(`Missing required question: ${q.label}`, 400));
    }
  }

  // sanitize
  const sanitizedAnswers = answers.map((a: any) => ({
    question_id: a.question_id,
    value: a.value
  }));

  // save
  try {
    const submission = await Submission.create({
      form_id: formId,
      evaluator_id,
      subject_id,
      task_id,
      answers: sanitizedAnswers,
    });

    // Populate form with title, description, and questions for response
    const populatedSubmission = await Submission.findById(submission._id).populate({
      path: 'form_id',
      select: 'title description label',
      populate: {
        path: 'questions',
        select: 'label type required options ai_tag order file_config scale text_validation'
      }
    }).populate({
      path: 'answers.question_id',
      select: 'label type required options file_config scale text_validation'
    });

    res.status(201).json({
      status: "success",
      data: populatedSubmission,
    });

  } catch (error: any) {
    if (error.code === 11000) {
      return next(new AppError("Already submitted", 400));
    }
    next(error);
  }
});

/**
 * createPublicSubmission
 * Handles public responses for GENERAL forms without authentication.
 */
export const createPublicSubmission = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const formId = req.params.formId as string;
  const { answers, subject_id } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) {
    return next(new AppError("Answers must be a non-empty array", 400));
  }

  // prevent duplicate answers
  const seen = new Set();
  for (const a of answers) {
    if (seen.has(a.question_id)) {
      return next(new AppError(`Duplicate answer for question ${a.question_id}`, 400));
    }
    seen.add(a.question_id);
  }

  // fetch form
  const form = await Form.findById(formId);
  if (!form) return next(new AppError("Form not found", 404));

  // check form state and category
  if (!form.is_active) {
    return next(new AppError("Form is not active", 400));
  }
  
  if (form.category !== "GENERAL" && form.subject_role !== "FACILITY") {
    return next(new AppError("This form is not publicly accessible.", 403));
  }

  let finalSubjectId = subject_id;
  if (!finalSubjectId && form.subject_role === "FACILITY") {
    finalSubjectId = form.facility_id;
  }

  // fetch questions
  const questions = await Question.find({ form_id: formId });
  const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

  // validate answers
  for (const answer of answers) {
    const question = questionMap.get(answer.question_id);
    if (!question) {
      return next(new AppError(`Invalid question ${answer.question_id}`, 400));
    }
    validateAnswerValue(question, answer.value);
  }

  // required questions
  const answeredSet = new Set(answers.map(a => a.question_id));
  for (const q of questions) {
    if (q.required && !answeredSet.has(q._id.toString())) {
      return next(new AppError(`Missing required question: ${q.label}`, 400));
    }
  }

  // sanitize
  const sanitizedAnswers = answers.map((a: any) => ({
    question_id: a.question_id,
    value: a.value
  }));

  // save
  try {
    const submission = await Submission.create({
      form_id: formId,
      subject_id: finalSubjectId,
      answers: sanitizedAnswers,
    });

    const populatedSubmission = await Submission.findById(submission._id).populate({
      path: 'form_id',
      select: 'title description label',
    }).populate({
      path: 'answers.question_id',
      select: 'label type required options file_config scale text_validation'
    });

    res.status(201).json({
      status: "success",
      data: populatedSubmission,
    });

  } catch (error: any) {
    next(error);
  }
});

/**
 * getFormSubmissions
 * Retrieves all responses for a specific form.
 */
export const getFormSubmissions = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const { formId } = req.params;
  
  const submissions = await Submission.find({ form_id: formId })
    .populate({
      path: 'evaluator_id',
      select: 'name firstName lastName email role'
    })
    .populate({
      path: 'subject_id',
      select: 'name firstName lastName email role'
    })
    .sort({ createdAt: -1 });

  res.json({
    status: "success",
    count: submissions.length,
    data: submissions
  });
});

/**
 * getMyFormSubmissions
 * Retrieves all responses submitted by the authenticated student.
 */
export const getMyFormSubmissions = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const userId = user.id || user._id;
  
  const submissions = await Submission.find({ evaluator_id: userId })
    .populate({
      path: 'form_id',
      select: 'title description label category'
    })
    .populate({
      path: 'subject_id',
      select: 'name firstName lastName email role'
    })
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    count: submissions.length,
    data: submissions
  });
});
