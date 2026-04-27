import cors from 'cors';
import express from 'express';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/routes/authRoutes.js';
import questionRoutes from './modules/question/routes/questionRout.js';
import formRoutes from "./modules/form/routes/formRoutes.js";
import submissionRoutes from "./modules/submission/submission.route.js";
import uploadRoutes from "./utils/upload/uploadRoutes.js";
import { UPLOAD_DIR } from "./utils/upload/multerConfig.js";
import adminUserRoutes from "./modules/admin/routes/adminUserRoutes.js";
import departmentRoutes from "./modules/department/routes/departmentRoutes.js";

export function createApp() {
  const app = express();
  
  // ─── Middleware ─────────────────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json({ limit: '5mb' })); // Increased limit for larger JSON payloads

  // ─── Static Files ───────────────────────────────────────────────────────────
  // Serve files inside /uploads folder publicly
  app.use("/uploads", express.static(UPLOAD_DIR));

  // ─── Core Routes ─────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Auth routes
  app.use('/api/', authRoutes);

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

  // ─── Error Handling ─────────────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}