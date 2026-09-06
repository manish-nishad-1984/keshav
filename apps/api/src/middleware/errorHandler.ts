import type { NextFunction, Request, Response } from 'express';
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

  console.error(err);
  return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
};
