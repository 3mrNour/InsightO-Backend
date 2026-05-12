import type { Request, Response, NextFunction } from "express";
import Cycle from "./cycle.model.js";
import { asyncWrap } from "../../middlewares/asyncWrap.js";
import { AppError } from "../../utils/AppError.js";

export const createCycle = asyncWrap(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const newCycle = await Cycle.create({
    ...req.body,
    creatorId: user.id || user._id,
  });

  res.status(201).json({
    status: "success",
    data: { cycle: newCycle },
  });
});

export const getCycles = asyncWrap(async (req: Request, res: Response) => {
  const cycles = await Cycle.find()
    .populate("formId", "title")
    .sort({ startDate: -1 });

  res.status(200).json({
    status: "success",
    results: cycles.length,
    data: { cycles },
  });
});

export const updateCycle = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const cycle = await Cycle.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!cycle) return next(new AppError("Cycle not found", 404));

  res.status(200).json({
    status: "success",
    data: { cycle },
  });
});

export const deleteCycle = asyncWrap(async (req: Request, res: Response, next: NextFunction) => {
  const cycle = await Cycle.findByIdAndDelete(req.params.id);
  if (!cycle) return next(new AppError("Cycle not found", 404));

  res.status(200).json({
    status: "success",
    message: "Cycle deleted successfully",
  });
});
