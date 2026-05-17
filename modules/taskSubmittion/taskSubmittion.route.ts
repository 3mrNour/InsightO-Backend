import { Router } from "express";
import {
  submitTask,
  getTaskSubmissions,
  finalizeGrade,
  getMySubmissions,
} from "./taskSubmittion.controller.js";
import { protect, authorizeRoles } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import {
  submitTaskSchema,
  finalizeGradeSchema,
  getTaskSubmissionsSchema,
} from "./taskSubmittion.validation.js";

const router = Router();

// جميع مسارات التسليم تتطلب تسجيل الدخول
router.use(protect);

/**
 * المسارات الخاصة بالتاسك نفسه (تسليم واسترجاع التسليمات)
 */
router
  .route("/task/:taskId")
  // 1. الطالب بيسلم التاسك
  .post(authorizeRoles("STUDENT"), validate(submitTaskSchema), submitTask)
  // 2. جلب تسليمات تاسك معين (للدكتور/رئيس القسم/الأدمن)
  .get(
    authorizeRoles("ADMIN", "HOD", "INSTRUCTOR"),
    validate(getTaskSubmissionsSchema),
    getTaskSubmissions,
  );
router
  .route("/my-submissions")
  .get(
    authorizeRoles("STUDENT", "INSTRUCTOR", "HOD", "ADMIN"),
    getMySubmissions,
  );
/**
 * المسارات الخاصة بالتسليم نفسه (التقييم البشري)
 */
router
  .route("/:submissionId/grade")
  // 3. التقييم البشري النهائي
  .patch(
    authorizeRoles("ADMIN", "HOD", "INSTRUCTOR"),
    validate(finalizeGradeSchema),
    finalizeGrade,
  );

export default router;
