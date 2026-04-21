import type { Request, Response, NextFunction } from "express";
import Form from "../model/formSchema.js";
import Question from "../../question/models/Question_Schema.js";

export const createForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    const form = await Form.create({
      ...req.body,
      creator_id: user._id
    });

    res.status(201).json({
      message: "Form created successfully",
      data: form
    });
  } catch (error) {
    next(error);
  }
};

// Get All Forms
export const getAllForms = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const forms = await Form.find().populate("creator_id", "firstName email");

    res.json({ data: forms });
  } catch (error) {
    next(error);
  }
};

//  Get Form By ID
export const getFormById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const form = await Form.findById(req.params.id)
      .populate("creator_id", "firstName email")
      .populate("questions");

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    res.json({ data: form });
  } catch (error) {
    next(error);
  }
};

export const deleteForm = async (req: Request, res: Response, next: NextFunction) => {
  try {

   
 const user = (req as any).user;

    const { id } = req.params;
     const form = await Form.findById(id);
     if(!form){
        return res.status(404).json({ message: "Form not found" });
     }
     if(form.creator_id.toString()!== user._id.toString()){
      return res.status(403).json({massage:"Unauthorized"});
     }
    await Question.deleteMany({ form_id: id });
    await Form.deleteOne();

    res.json({ message: "Form and related questions deleted" });
  } catch (error) {
    next(error);
  }
};


export const updateFormSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const form = await Form.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json({ data: form });
  } catch (error) {
    next(error);
  }
};