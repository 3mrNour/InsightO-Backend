import cors from 'cors';
import express from 'express';
import path from 'path';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/routes/authRoutes.js';
import formRoutes from "./modules/form/routes/formRoutes.js";
import submissionRoutes from "./modules/submission/submission.route.js";
import uploadRoutes from "./utils/upload/uploadRoutes.js";

export function createApp() {
  const app = express();
  
  // ─── Middleware ─────────────────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json({ limit: '5mb' })); // Increased limit for larger JSON payloads

  // ─── Static Files ───────────────────────────────────────────────────────────
  // Serve files inside /uploads folder publicly
  app.use("/uploads", express.static("uploads"));

  // ─── Core Routes ─────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Auth routes
  app.use('/api/', authRoutes);

  // Form builder routes
  app.use("/api/v1/form", formRoutes);
  
  // Submission routes (POST /api/forms/:formId/submissions)
  app.use("/api/forms", submissionRoutes);

  // File Upload routes (POST /api/upload)
  app.use("/api/upload", uploadRoutes);

  // ─── Error Handling ─────────────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}