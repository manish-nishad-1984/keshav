import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { emptyContext, runWithContext } from '../lib/requestContext';

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = randomUUID();
  res.setHeader('x-request-id', requestId);

  const context = emptyContext({
    requestId,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });

  runWithContext(context, () => next());
};
