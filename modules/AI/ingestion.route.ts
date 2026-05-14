import { Router } from 'express';
import multer from 'multer';
import { ingestRubric } from './ingestion.controller.js';


const router = Router();

// Configure multer to save files to disk so file.path is available for PDFLoader
const upload = multer({
  dest: 'uploads/', // saves files to the 'uploads' directory
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

// Endpoint: POST /api/ai/ingest-rubric
router.post('/ingest-rubric', upload.single('file'), ingestRubric);

export default router;
