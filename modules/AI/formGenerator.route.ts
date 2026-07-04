import { Router } from "express";
import { generateAIForm, generateAIFormFromFileController } from "./formGenerator.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";
import { upload } from "../../utils/upload/multerConfig.js";

const router = Router();

// Endpoint: POST /api/ai/generate-form
router.post("/generate-form", protect, generateAIForm);

// Endpoint: POST /api/ai/generate-from-file
router.post("/generate-from-file", protect, upload.single("file"), generateAIFormFromFileController);

export default router;
