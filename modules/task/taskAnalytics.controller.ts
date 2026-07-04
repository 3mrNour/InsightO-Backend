// modules/task/taskAnalytics.controller.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single controller — delegates all data fetching to TaskAnalyticsService.
// Does NOT modify any existing controller.
// ─────────────────────────────────────────────────────────────────────────────

import type { Request, Response } from 'express';
import { asyncWrap } from '../../middlewares/asyncWrap.js';
import { TaskAnalyticsService } from './taskAnalytics.service.js';

/**
 * GET /api/tasks/analytics
 * Protected: ADMIN and INSTRUCTOR only (enforced in route)
 */
export const getTaskAnalytics = asyncWrap(async (req: Request, res: Response) => {
  const { departmentId, courseId, taskId } = req.query;

  const options = {
    departmentId: typeof departmentId === 'string' ? departmentId : undefined,
    courseId: typeof courseId === 'string' ? courseId : undefined,
    taskId: typeof taskId === 'string' ? taskId : undefined,
  };

  const analytics = await TaskAnalyticsService.getAnalytics(options);

  res.status(200).json({
    status: 'success',
    data: analytics,
  });
});
