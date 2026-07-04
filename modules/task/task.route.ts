// src/modules/task/task.route.ts

import { Router } from 'express';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask
} from './task.controller.js';
import { protect, authorizeRoles } from '../../middlewares/authMiddleware.js';
// import { validate } from '../../middlewares/validateMiddleware.js';
// import { createTaskSchema, updateTaskSchema } from './task.validat.js'; 
import { upload } from '../../utils/upload/multerConfig.js';
import { getTaskAnalytics } from './taskAnalytics.controller.js';

const router = Router();

// 1. كل مسارات المهام بتحتاج إن اليوزر يكون عامل Login
router.use(protect);

/**
 * GET /api/tasks
 * Flow: 
 * 1. Auth check (protect)
 * 2. Business logic (Controller filters based on role dynamically)
 */
router.route('/')
  .get(getTasks)

/**
 * POST /api/tasks
 * Flow: 
 * 1. Auth check (protect)
 * 2. Role check (No Students)
 * 3. Schema validation (Zod) - Uncomment when validate middleware is ready
 * 4. Business logic (Controller handles Gatekeeper target validation)
 */
  .post(
    authorizeRoles('ADMIN', 'HOD', 'INSTRUCTOR'),
    upload.single('file'),
    // validate(createTaskSchema), 
    createTask
  );

/**
 * GET /api/tasks/analytics
 * Protected: ADMIN and INSTRUCTOR only
 * IMPORTANT: Must be declared BEFORE /:id so "analytics" is not captured as an id param
 */
router.route('/analytics')
  .get(authorizeRoles('ADMIN', 'INSTRUCTOR'), getTaskAnalytics);

/**
 * GET /api/tasks/:id
 * Flow: 
 * 1. Auth check (protect)
 * 2. Business logic (Controller)
 */
router.route('/:id')
  .get(getTaskById)

/**
 * PATCH /api/tasks/:id
 * Flow: 
 * 1. Auth check (protect)
 * 2. Role check (No Students)
 * 3. Schema validation (Zod) - Uncomment when validate middleware is ready
 * 4. Business logic (Controller checks if user is creator or ADMIN)
 */
  .patch(
    authorizeRoles('ADMIN', 'HOD', 'INSTRUCTOR'),
    // validate(updateTaskSchema),
    updateTask
  )

/**
 * DELETE /api/tasks/:id
 * Flow: 
 * 1. Auth check (protect)
 * 2. Role check (No Students)
 * 3. Business logic (Controller checks if user is creator or ADMIN)
 */
  .delete(
    authorizeRoles('ADMIN', 'HOD', 'INSTRUCTOR'),
    deleteTask
  );

export default router;