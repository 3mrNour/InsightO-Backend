// src/modules/submission/submission.route.ts

import { Router } from 'express';
import { createSubmission } from './submission.controller.js';
import { protect, authorizeRoles } from '../../middlewares/authMiddleware.js';
import { validate } from '../../middlewares/validateMiddleware.js';
import { createSubmissionSchema } from './submission.validat.js';

const router = Router();

/**
 * POST /api/forms/:formId/submissions
 * 
 * Flow:
 * 1. Auth check (protect)
 * 2. Role check (STUDENT)
 * 3. Schema validation (Zod)
 * 4. Business logic (Controller)
 */
router.post(
  '/:formId/submissions',
  protect,
  authorizeRoles('STUDENT'),
  validate(createSubmissionSchema),
  createSubmission
);

export default router;
