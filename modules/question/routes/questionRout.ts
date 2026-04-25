import {
  createQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  reorderQuestions
} from "../Controllers/questionController.js";

import { protect, authorizeRoles } from "../../../middlewares/authMiddleware.js";
import { validate } from "../../../middlewares/validateMiddleware.js";

import {
  createQuestionSchema,
  reorderSchema,
  formIdParamSchema,
  questionIdParamSchema
} from "../Validation/questionValidation.js";

import express from "express";

const router = express.Router();


router.post(
  "/:formId/questions",
  protect,
  authorizeRoles("ADMIN", "HOD", "INSTRUCTOR"),
  validate(formIdParamSchema),
  validate(createQuestionSchema),
  createQuestion
);


router.get(
  "/:formId/questions",
  protect,
  validate(formIdParamSchema),
  getQuestions
);


router.patch(
  "/questions/:id",
  protect,
  authorizeRoles("ADMIN", "HOD", "INSTRUCTOR"),
  validate(questionIdParamSchema),
  validate(createQuestionSchema.partial()), // 🔥 update partial
  updateQuestion
);


router.delete(
  "/questions/:id",
  protect,
  authorizeRoles("ADMIN", "HOD"),
  validate(questionIdParamSchema),
  deleteQuestion
);


router.patch(
  "/:formId/questions/reorder",
  protect,
  authorizeRoles("ADMIN", "HOD", "INSTRUCTOR"),
  validate(formIdParamSchema),
  validate(reorderSchema),
  reorderQuestions
);

export default router;