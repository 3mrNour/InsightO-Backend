import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { upload } from './multerConfig.js';
import { protect } from '../../middlewares/authMiddleware.js';

const uploadRouter = Router();

/**
 * POST /api/upload
 *
 * Protected route – requires a valid JWT Bearer token.
 * Accepts a single file field named "file".
 * Returns the URL path, MIME type, and size of the uploaded file.
 */
uploadRouter.post(
  '/',
  protect, // only authenticated users can upload
  (req: Request, res: Response, next: NextFunction) => {
    // Run multer middleware for a single file named "file"
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        // Multer / file-filter errors land here
        return next(err);
      }

      // No file was attached to the request
      if (!req.file) {
        return res
          .status(400)
          .json({ status: 'fail', message: 'No file uploaded.' });
      }

      const { filename, mimetype, size } = req.file;

      // Return a public-accessible URL path alongside metadata
      return res.status(201).json({
        status: 'success',
        data: {
          url: `/uploads/${filename}`,
          type: mimetype,
          size,
        },
      });
    });
  },
);

export default uploadRouter;
