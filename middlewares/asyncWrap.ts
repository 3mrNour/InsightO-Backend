// src/middlewares/asyncWrap.ts

import type { Request, Response, NextFunction } from "express";

/**
 * A type-safe wrapper for asynchronous Express route handlers.
 * Ensures any rejected promise is automatically passed to the next() error handler.
 * 
 * Note: Express 5+ handles promise rejections automatically, but this wrapper
 * remains a best practice for explicit control and backward compatibility.
 */
export const asyncWrap = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
