import cors from "cors";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import authRoutes from "./modules/auth/routes/authRoutes.js";
import questionRoutes from "./modules/question/routes/questionRout.js";
import formRoutes from "./modules/form/routes/formRoutes.js";
import submissionRoutes from "./modules/submission/submission.route.js";
import uploadRoutes from "./utils/upload/uploadRoutes.js";
import { UPLOAD_DIR } from "./utils/upload/multerConfig.js";
import adminUserRoutes from "./modules/admin/routes/adminUserRoutes.js";
import departmentRoutes from "./modules/department/routes/departmentRoutes.js";
import taskRoutes from "./modules/task/task.route.js";
import taskSubmittionRoutes from "./modules/taskSubmittion/taskSubmittion.route.js";
import courseRoutes from "./modules/course/course.route.js";
import studentRoutes from "./modules/student/student.route.js";
import cycleRoutes from "./modules/cycle/cycle.route.js";
import ingestionroute from "./modules/AI/ingestion.route.js";
import formGeneratorRoute from "./modules/AI/formGenerator.route.js";
import aiUsageRoute from "./modules/AI/aiUsage.route.js";
import formAIRoute from "./modules/AI/formAI.route.js";

import { getTokenUsage, getAdminTokenUsage } from "./modules/AI/aiUsage.controller.js";
import { protect, authorizeRoles } from "./middlewares/authMiddleware.js";


import path from 'path';


export function createApp() {
  const app = express();

  // ─── Middleware ─────────────────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json({ limit: "5mb" })); // Increased limit for larger JSON payloads

  // ─── Static Files ───────────────────────────────────────────────────────────
  // Serve files inside /uploads folder publicly
  app.use("/uploads", express.static(UPLOAD_DIR));

  // ─── Core Routes ─────────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Auth routes
  app.use("/api/", authRoutes);

  // Form builder routes
  app.use("/api/v1/form", formRoutes);

  // Questions routes
  app.use("/api/v1/questions", questionRoutes);

  // Submission routes (POST /api/forms/:formId/submissions)
  app.use("/api/forms", submissionRoutes);

  // Admin dashboard user management
  app.use("/api/admin/users", adminUserRoutes);
  app.use("/api/admin/departments", departmentRoutes);

  // File Upload routes (POST /api/upload)
  app.use("/api/upload", uploadRoutes);
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  // Task routes
  app.use("/api/tasks", taskRoutes);

  // Student routes
  app.use("/api/student", studentRoutes);

  // Course routes
  app.use("/api/courses", courseRoutes);

  // Task Submissions routes
  app.use("/api/task-submissions", taskSubmittionRoutes);

  // Evaluation Cycle routes
  app.use("/api/cycles", cycleRoutes);

  // AI routes
  app.use("/api/ai", ingestionroute);
  app.use("/api/ai", formGeneratorRoute);
  app.use("/api/ai-usage", aiUsageRoute);
  app.use("/api/ai", formAIRoute);

  // ─── Token Usage API (frontend-facing) ─────────────────────────────────────
  app.get("/api/ai/token-usage", protect, authorizeRoles("INSTRUCTOR", "HOD", "ADMIN"), getTokenUsage);

  // ─── Admin Token Usage Dashboard ───────────────────────────────────────────
  app.get("/api/admin/token-usage", protect, authorizeRoles("ADMIN"), getAdminTokenUsage);

  // ─── Error Handling ─────────────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
