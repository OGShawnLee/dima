import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { createErrorHandler } from './middlewares/errorhandler.middleware';

export interface CreateAppOptions {
  corsOrigins?: string[];
  trustProxy?: boolean;
  nodeEnv?: string;
  logFilePath?: string;
  registerRoutes?: (app: Express) => void;
}

const DEFAULT_CORS_ORIGINS = ['http://localhost:8080', 'http://localhost:8081'];

export function createApp(options?: CreateAppOptions): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', options?.trustProxy ?? false);
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(
    cors({
      origin: options?.corsOrigins ?? DEFAULT_CORS_ORIGINS,
      methods: 'GET,PUT,POST,DELETE',
      exposedHeaders: ['Set-Authorization'],
    }),
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  if (options?.registerRoutes) {
    options.registerRoutes(app);
  }

  app.use((_req, res) => {
    res.status(404).send('Recurso no encontrado');
  });

  app.use(
    createErrorHandler({
      logFilePath: options?.logFilePath,
      nodeEnv: options?.nodeEnv,
    }),
  );

  return app;
}
