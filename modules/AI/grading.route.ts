import { Router } from "express";
import { gradeSubmission } from "./grading.controller.js";

const router = Router();

// Endpoint: POST /api/ai/grade-submission
router.post("/grade-submission", gradeSubmission);

export default router;
