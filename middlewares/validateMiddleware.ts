import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import type { ZodSchema } from "zod";
import { AppError } from "../utils/AppError.js";

export const validate = (schema: ZodSchema) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const zodError = error as ZodError<any>;
        const message = zodError.issues
          .map((err: any) => `${err.path.join(".")} : ${err.message}`)
          .join(", ");

        return next(new AppError(message, 400));
      }

      next(error);
    }
  };
};
