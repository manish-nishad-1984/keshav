import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './lib/env';
import { UPLOADS_DIR } from './lib/uploadsDir';
import { requestContextMiddleware } from './middleware/requestContext';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

export const createApp = () => {
  const app = express();

  app.use(requestContextMiddleware);
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.use(env.API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
