import fs from 'node:fs';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { env } from './env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { optionalAuth } from './middleware/auth';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  // Behind a proxy in production; needed for correct client IPs in rate limiting.
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logs help while developing and would drown the test output.
  if (!env.isProduction && env.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: 'rate_limited', message: 'Slow down a moment and try again.' } },
    }),
  );

  // Resolves the viewer once, for every route. Routes that require a session
  // add requireAuth on top; the rest can simply read req.auth when present.
  app.use(optionalAuth);

  // Files held on local disk while no Cloudinary account is configured. Only
  // the public half is served this way; verification documents live in a
  // separate directory that is never mounted, and are released one request at a
  // time by a route that checks who is asking.
  if (env.storage.provider === 'local') {
    const publicDir = `${env.storage.localDir}/public`;
    fs.mkdirSync(publicDir, { recursive: true });
    app.use('/uploads', express.static(publicDir, { maxAge: '1y', index: false, dotfiles: 'deny' }));
  }

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
