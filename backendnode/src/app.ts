import { Scalar } from '@scalar/express-api-reference';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { generateOpenApiDocument } from './config/openapi';
import { bitacoraMiddleware } from './middlewares/bitacora.middleware';
import { createErrorHandler } from './middlewares/errorhandler.middleware';
import { archivosRouter } from './routes/archivos.routes';
import { authRouter } from './routes/auth.routes';
import { bitacoraRouter } from './routes/bitacora.routes';
import { categoriasRouter } from './routes/categorias.routes';
import { productosRouter } from './routes/productos.routes';
import { rolesRouter } from './routes/roles.routes';
import { usuariosRouter } from './routes/usuarios.routes';

export interface CreateAppOptions {
  corsOrigins?: string[];
  trustProxy?: boolean;
  nodeEnv?: string;
  logFilePath?: string;
  mountDefaultApiRoutes?: boolean;
  registerRoutes?: (app: Express) => void;
}

const DEFAULT_CORS_ORIGINS = ['http://localhost:8080', 'http://localhost:8081'];

export function createApp(options?: CreateAppOptions): Express {
  const app = express();
  const openApiDocument = generateOpenApiDocument();
  const strictHelmet = helmet();
  const docsHelmet = helmet({ contentSecurityPolicy: false });

  app.disable('x-powered-by');
  app.set('trust proxy', options?.trustProxy ?? false);
  app.use((req, res, next) => {
    if (req.path.startsWith('/swagger') || req.path.startsWith('/docs')) {
      docsHelmet(req, res, next);
      return;
    }
    strictHelmet(req, res, next);
  });
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

  app.get('/openapi.json', (_req, res) => {
    res.status(200).json(openApiDocument);
  });
  app.use('/swagger', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use('/docs', Scalar({ url: '/openapi.json' }));

  app.use(bitacoraMiddleware);

  if (options?.registerRoutes) {
    options.registerRoutes(app);
  }

  if (options?.mountDefaultApiRoutes ?? true) {
    app.use('/api/auth', authRouter);
    app.use('/api/bitacora', bitacoraRouter);
    app.use('/api/roles', rolesRouter);
    app.use('/api/usuarios', usuariosRouter);
    app.use('/api/categorias', categoriasRouter);
    app.use('/api/productos', productosRouter);
    app.use('/api/archivos', archivosRouter);
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
