import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError';

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: { message: 'Not found' } });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      success: false,
      error: { message: err.message, code: err.code, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: err.flatten() },
    });
  }

  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({
      success: false,
      error: { message: tooBig ? 'The photo is too large (maximum 10 MB).' : 'The file could not be uploaded.' },
    });
  }

  console.error(err);
  return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
};
