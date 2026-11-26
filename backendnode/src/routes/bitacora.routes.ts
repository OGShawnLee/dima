import { Router, type RequestHandler } from 'express';
import { createBitacoraController } from '../controllers/bitacora.controller';
import { authorize } from '../middlewares/auth.middleware';
import type { RoleName } from '../schemas/common.schema';
import type { IBitacoraService } from '../services/bitacora.service';

export interface BitacoraRouterDeps {
  service?: IBitacoraService;
  authorizeMiddleware?: (...allowedRoles: RoleName[]) => RequestHandler;
}

export function createBitacoraRouter(deps?: BitacoraRouterDeps): Router {
  const router = Router();
  const controller = createBitacoraController(deps?.service);
  const auth = deps?.authorizeMiddleware ?? authorize;

  router.get('/', auth('Administrador'), controller.getAll);

  return router;
}

export const bitacoraRouter = createBitacoraRouter();
