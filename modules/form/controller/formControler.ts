import type { Request, Response, NextFunction } from "express";
import Form from "../model/formSchema.js";
import Question from "../../question/models/Question_Schema.js";
import { AppError } from "../../../utils/AppError.js";
import StudentProfile from "../../profile/model/StudentProfile.js";
import Task from "../../task/task.model.js";

export const createForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const {
      title,
      description,
      evaluator_roles,
      subject_role,
      is_anonymous,
      department_id,
      category,
      course_id,
      instructor_id
    } = req.body;

    const form = await Form.create({
      title,
      description,
      evaluator_roles,
      subject_role,
      is_anonymous,
      department_id,
      category,
      course_id,
      instructor_id,
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
    let query: any = {};
    
    if (user.role === "STUDENT") {
      query = { is_active: true, evaluator_roles: "STUDENT" };
    } else {
      query = { creator_id: user._id };
    }

    const forms = await Form.find(query).populate({
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
    const isCreator = form.creator_id.toString() === user._id.toString();
    const isAdmin = ["ADMIN", "HOD"].includes(user.role);
    
    // Check if student has an active task assigned with this form
    let isTaskTarget = false;
    if (user.role === "STUDENT") {
      const studentProfile = await StudentProfile.findOne({ userId: user._id });
      if (studentProfile) {
        const taskCount = await Task.countDocuments({
          form_id: form._id,
          status: "ACTIVE",
          $or: [
            { "target.specific_users": user._id },
            { "target.course_id": { $in: studentProfile.enrolledCourses } },
            { "target.department_id": studentProfile.departmentId }
          ]
        });
        if (taskCount > 0) {
          isTaskTarget = true;
        }
      }
    }

    const isEvaluator = form.evaluator_roles.includes(user.role) || isTaskTarget;

    if (!form.is_active && !isCreator && !isAdmin && !isTaskTarget) {
      return next(new AppError("Form is not active", 403));
    }
    
    const isAllowed = isCreator || isAdmin || isTaskTarget || (form.is_active && isEvaluator);
    if (!isAllowed) {
      return next(new AppError("You don't have permission to access this form", 403));
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
    const isCreator = form.creator_id.toString() === user._id.toString();
    const isAdmin = ["ADMIN", "HOD"].includes(user.role);

    if (!isCreator && !isAdmin) {
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

    const user = (req as any).user;
    const isCreator = form.creator_id.toString() === user._id.toString();
    const isAdmin = ["ADMIN", "HOD"].includes(user.role);

    if (!isCreator && !isAdmin) {
      return next(new AppError("Not allowed", 403));
    }
    const updates: any = {};
    ["title", "description", "is_active", "is_anonymous", "category", "course_id", "instructor_id"].forEach(field => {
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

export const getPublicFormById = async (req: Request, res: Response, next: NextFunction) => {
  try {
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

    if (!form.is_active || form.category !== 'GENERAL') {
      return next(new AppError("This form is not publicly accessible", 403));
    }
    
    res.json({
      status: "success",
      data: form
    });
  } catch (error) {
    next(error);
  }
};
