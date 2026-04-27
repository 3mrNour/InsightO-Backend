import type { NextFunction, Request, Response } from 'express';
import Department from '../model/Department.js';
import { AppError } from '../../../utils/AppError.js';

export const createDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, code, description } = req.body;
    const department = await Department.create({ name, code, description });
    res.status(201).json({ status: 'success', data: department });
  } catch (error: any) {
    if (error?.code === 11000) {
      return next(new AppError('Department code already exists', 409));
    }
    next(error);
  }
};

export const getAllDepartments = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departments = await Department.find().sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: departments.length, data: departments });
  } catch (error) {
    next(error);
  }
};

export const getDepartmentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return next(new AppError('Department not found', 404));
    }
    res.status(200).json({ status: 'success', data: department });
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );
    if (!department) {
      return next(new AppError('Department not found', 404));
    }
    res.status(200).json({ status: 'success', data: department });
  } catch (error: any) {
    if (error?.code === 11000) {
      return next(new AppError('Department code already exists', 409));
    }
    next(error);
  }
};

export const deleteDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) {
      return next(new AppError('Department not found', 404));
    }
    res.status(200).json({ status: 'success', message: 'Department deleted successfully' });
  } catch (error) {
    next(error);
  }
};
