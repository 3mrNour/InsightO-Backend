import {
  createQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  reorderQuestions
} from "../Controllers/questionController.js";
import { protect, authorizeRoles } from "../../../middlewares/authMiddleware.js";
import { validate } from "../../../middlewares/validateMiddleware.js";
import { createQuestionSchema } from "../Validation/questionValidation.js";
import express from "express";
const router = express.Router();

// Questions
router.post("/:formId/questions", protect, createQuestion);
router.get("/:formId/questions", protect, getQuestions);

router.patch("/questions/:id", protect, updateQuestion);
router.delete("/questions/:id", protect, deleteQuestion);

router.patch("/:formId/questions/reorder", protect, reorderQuestions);