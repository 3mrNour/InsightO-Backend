import type { Request, Response, NextFunction } from "express";
import Form from "../model/formSchema.js";
import Question from "../../question/models/Question_Schema.js";
import { AppError } from "../../../utils/AppError.js";

export const createForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const {
      title,
      description,
      evaluator_roles,
      subject_role,
      is_anonymous,
      department_id
    } = req.body;

    const form = await Form.create({
      title,
      description,
      evaluator_roles,
      subject_role,
      is_anonymous,
      department_id,
      creator_id: user._id
    });

    res.status(201).json({
      status: "success",
      data: form
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return next(new AppError("Form already exists", 400));
    }
    next(error);
  }
};

export const getAllForms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const forms = await Form.find({
      creator_id: user._id
    }).populate({
      path: 'questions',
      select: 'label title description type required options ai_tag order'
    }).populate({
      path: 'creator_id',
      select: 'name email'
    });
    res.json({
      status: "success",
      count: forms.length,
      data: forms
    });
  } catch (error) {
    next(error);
  }
};

export const getFormById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const form = await Form.findById(req.params.id)
      .populate({
        path: 'questions',
        select: 'label title description type required options ai_tag order'
      }).populate({
        path: 'creator_id',
        select: 'name email'
      });
    if (!form) {
      return next(new AppError("Form not found", 404));
    }
    if (!form.is_active) {
      return next(new AppError("Form is not active", 403));
    }
    if (form.creator_id.toString() !== user._id.toString()) {
      return next(new AppError("You don't own this form", 403));
    }
    res.json({
      status: "success",
      data: form
    });
  } catch (error) {
    next(error);
  }
};

export const deleteForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const form = await Form.findById(id);
    if (!form) {
      return next(new AppError("Form not found", 404));
    }
    if (form.creator_id.toString() !== user._id.toString()) {
      return next(new AppError("Unauthorized", 403));
    }
    await Question.deleteMany({ form_id: id });
    await Form.findByIdAndDelete(id);
    res.json({
      status: "success",
      message: "Form deleted"
    });
  } catch (error) {
    next(error);
  }
};

export const updateFormSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) {
      return next(new AppError("Form not found", 404));
    }
    const updates: any = {};
    ["title", "description", "is_active", "is_anonymous"].forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    Object.assign(form, updates);
    await form.save();
    res.json({
      status: "success",
      data: form
    });
  } catch (error) {
    next(error);
  }
};
