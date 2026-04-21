import type { Request, Response, NextFunction } from "express";
import Question from "../models/Question_Schema.js";
import Form from "../../form/model/formSchema.js";

export const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { formId } = req.params;

    const question = await Question.create({
      ...req.body,
      form_id: formId
    });

    await Form.findByIdAndUpdate(formId, {
      $push: { questions: question._id }
    });

    res.status(201).json({ data: question });
  } catch (error) {
    next(error);
  }
};


export const getQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const questions = await Question.find({ form_id: req.params.formId })
      .sort({ order: 1 });

    res.json({ data: questions });
  } catch (error) {
    next(error);
  }
};

// ✅ Update Question
export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json({ data: question });
  } catch (error) {
    next(error);
  }
};

//  Delete Question
export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);

    await Form.findByIdAndUpdate(question?.form_id, {
      $pull: { questions: question?._id }
    });

    res.json({ message: "Question deleted" });
  } catch (error) {
    next(error);
  }
};

//  Reorder Questions
export const reorderQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = req.body;

    const bulkOps = updates.map((q: any) => ({
      updateOne: {
        filter: { _id: q.id },
        update: { order: q.order }
      }
    }));

    await Question.bulkWrite(bulkOps);

    res.json({ message: "Reordered successfully" });
  } catch (error) {
    next(error);
  }
};