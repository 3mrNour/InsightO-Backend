// src/modules/course/course.route.ts

import { Router } from "express";
import {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
} from "./course.controller.js";
import { protect, authorizeRoles } from "../../middlewares/authMiddleware.js";
import { validate } from '../../middlewares/validateMiddleware.js';
import { createCourseSchema, updateCourseSchema } from './course.validation.js';

const router = Router();

// 1. جميع مسارات الكورسات تتطلب تسجيل الدخول
router.use(protect);

/**
 * GET /api/courses
 * الوصول: متاح لجميع المستخدمين (الكنترولر يفلتر الداتا حسب الدور)
 */
router
  .route("/")
  .get(getCourses)

  /**
   * POST /api/courses
   * الوصول: ADMIN و HOD فقط
   */
  .post(
    authorizeRoles("ADMIN", "HOD"),
    validate(createCourseSchema),
    createCourse,
  );

/**
 * GET /api/courses/:id
 * الوصول: متاح لجميع المستخدمين
 */
router
  .route("/:id")
  .get(getCourseById)

  /**
   * PATCH /api/courses/:id
   * الوصول: ADMIN و HOD فقط
   */
  .patch(
    authorizeRoles("ADMIN", "HOD"),
    validate(updateCourseSchema),
    updateCourse,
  )

  /**
   * DELETE /api/courses/:id
   * الوصول: ADMIN و HOD فقط
   */
  .delete(authorizeRoles("ADMIN", "HOD"), deleteCourse);

export default router;
