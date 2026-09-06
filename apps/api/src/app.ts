import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './lib/env';
import { UPLOADS_DIR } from './lib/uploadsDir';
import { requestContextMiddleware } from './middleware/requestContext';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

const WEB_DIST_DIR = path.join(__dirname, '../../web/dist');
const WEB_INDEX_HTML = path.join(WEB_DIST_DIR, 'index.html');

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

  if (fs.existsSync(WEB_INDEX_HTML)) {
    app.use(express.static(WEB_DIST_DIR));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith(env.API_PREFIX) || req.path.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(WEB_INDEX_HTML);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
