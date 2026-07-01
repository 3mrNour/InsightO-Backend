// src/modules/submission/submission.route.ts

import { Router } from 'express';
import { createSubmission, createPublicSubmission, getFormSubmissions, getMyFormSubmissions } from './submission.controller.js';
import { protect, authorizeRoles } from '../../middlewares/authMiddleware.js';
import { validate } from '../../middlewares/validateMiddleware.js';
import { createSubmissionSchema, createPublicSubmissionSchema } from './submission.validat.js';

const router = Router();

router.post(
  '/public/:formId/submissions',
  validate(createPublicSubmissionSchema),
  createPublicSubmission
);

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

router.get(
  '/my-submissions',
  protect,
  authorizeRoles('STUDENT'),
  getMyFormSubmissions
);

router.get(
  '/:formId/submissions',
  protect,
  authorizeRoles('ADMIN', 'HOD', 'INSTRUCTOR'),
  getFormSubmissions
);

export default router;
