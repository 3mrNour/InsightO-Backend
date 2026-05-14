import type { Request, Response } from 'express';
import { IngestionService } from './ingestion.service.js';

export const ingestRubric = async (req: Request, res: Response): Promise<Response> => {
  try {
    const file = req.file;
    const text = req.body?.text;

    // Validate that either file or text is present
    if (!file && !text) {
      return res.status(400).json({
        message: 'Bad Request: Please provide either a PDF file (field "file") or raw text (JSON: { text }).'
      });
    }

    // Call service to handle ingestion logic
    const chunkCount = await IngestionService.processAndStore(file, text);

    return res.status(200).json({
      message: 'Ingestion successful',
      chunks: chunkCount,
    });
  } catch (error: any) {
    console.error('Ingestion Error:', error);
    return res.status(500).json({
      message: 'Failed to ingest rubric',
      error: error.message || 'An unknown error occurred',
    });
  }
};
