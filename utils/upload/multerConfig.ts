// src/utils/upload/multerConfig.ts

import multer, { type FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import type { Request } from "express";

// ─── Constants ───────────────────────────────────────────────────────────────

const UPLOAD_DIR = "uploads";

/** Allowed MIME types for uploaded files */
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "application/pdf"];

/** Maximum allowed file size in bytes (5 MB) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ─── Ensure uploads directory exists ─────────────────────────────────────────

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ─── Storage Configuration ────────────────────────────────────────────────────

/**
 * Storage strategy:
 * - destination: "uploads"
 * - filename: unique timestamp-based name
 */
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

// ─── File Filter ──────────────────────────────────────────────────────────────

/**
 * Rejects files with unsupported MIME types.
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type "${file.mimetype}" is not supported. Use PNG, JPEG, or PDF.`));
  }
};

// ─── Exported Instance ────────────────────────────────────────────────────────

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

export { UPLOAD_DIR, ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
