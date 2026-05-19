import { Router } from "express";
import { getFormSubmissionAnalysis, getFormDeepAnalysis } from "./formAI.controller.js";
import { protect, authorizeRoles } from "../../middlewares/authMiddleware.js";

const router = Router();

// GET /api/ai/analyze-form/:formId/deep  ← frontend: /ai/analyze-form/${formId}/deep
// Must be defined BEFORE the base route to avoid Express matching "deep" as a formId
router.get(
  "/analyze-form/:formId/deep", 
  protect, 
  authorizeRoles("ADMIN", "HOD", "INSTRUCTOR"), 
  getFormDeepAnalysis
);

// GET /api/ai/analyze-form/:formId  ← frontend: /ai/analyze-form/${formId}
router.get(
  "/analyze-form/:formId", 
  protect, 
  authorizeRoles("ADMIN", "HOD", "INSTRUCTOR"), 
  getFormSubmissionAnalysis
);

export default router;
