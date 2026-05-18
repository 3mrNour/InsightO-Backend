import { Router } from "express";
import { generateAIForm } from "./formGenerator.controller.js";

const router = Router();

// Endpoint: POST /api/ai/generate-form
router.post("/generate-form", generateAIForm);

export default router;
