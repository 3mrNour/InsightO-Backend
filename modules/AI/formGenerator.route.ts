import { Router } from "express";
import { generateAIForm } from "./formGenerator.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router = Router();

// Endpoint: POST /api/ai/generate-form
router.post("/generate-form", protect,generateAIForm);

export default router;
