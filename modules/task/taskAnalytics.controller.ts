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
export const getTaskAnalytics = asyncWrap(async (_req: Request, res: Response) => {
  const analytics = await TaskAnalyticsService.getAnalytics();

  res.status(200).json({
    status: 'success',
    data: analytics,
  });
});
