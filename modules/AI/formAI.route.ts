import { Router } from "express";
import { getFormSubmissionAnalysis, getFormDeepAnalysis } from "./formAI.controller.js";
import { protect, authorizeRoles } from "../../middlewares/authMiddleware.js";

const router = Router();

// Protect all analysis routes - only administrative/instructor roles should access aggregated data
router.use(protect);
router.use(authorizeRoles("ADMIN", "HOD", "INSTRUCTOR"));

// GET /api/ai/analyze-form/:formId
router.get("/analyze-form/:formId", getFormSubmissionAnalysis);

// GET /api/ai/analyze-form/:formId/deep
router.get("/analyze-form/:formId/deep", getFormDeepAnalysis);

export default router;
