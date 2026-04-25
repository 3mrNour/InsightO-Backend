import type { Request, Response, NextFunction } from "express";
import Question from "../models/Question_Schema.js";
import Form from "../../form/model/formSchema.js";
import { AppError } from "../../../utils/AppError.js";

export const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { formId } = req.params;
    const user = (req as any).user;
    const form = await Form.findById(formId);
    if (!form) {
      return next(new AppError("Form not found", 404));
    }
    if (form.creator_id.toString() !== user._id.toString()) {
      return next(new AppError("Not allowed", 403));
    }
    const question = await Question.create({
      ...req.body,
      form_id: formId
    });
    await Form.findByIdAndUpdate(formId, {
      $addToSet: { questions: question._id }
    });
    res.status(201).json({ status: "success", data: question });
  } catch (error: any) {
    if (error.code === 11000) {
      return next(new AppError("Question already exists", 400));
    }
    next(error);
  }
};

export const getQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const questions = await Question.find({ form_id: req.params.formId })
      .sort({ order: 1 });
    res.json({ status: "success", data: questions });
  } catch (error) {
    next(error);
  }
};

export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!question) {
      return next(new AppError("Question not found", 404));
    }
    res.json({ status: "success", data: question });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return next(new AppError("Question not found", 404));
    }
    await Question.deleteOne({ _id: question._id });
    await Form.findByIdAndUpdate(question.form_id, {
      $pull: { questions: question._id }
    });
    res.json({ status: "success", message: "Deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const reorderQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { formId } = req.params;
    const updates = req.body;
    const bulkOps = updates.map((q: { id: string; order: number }) => ({
      updateOne: {
        filter: { _id: q.id, form_id: formId },
        update: { order: q.order }
      }
    }));
    await Question.bulkWrite(bulkOps);
    res.json({ status: "success", message: "Reordered successfully" });
  } catch (error) {
    next(error);
  }
};
