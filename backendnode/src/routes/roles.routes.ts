import { Router, type RequestHandler } from 'express';
import { createRolesController } from '../controllers/roles.controller';
import { authorize } from '../middlewares/auth.middleware';
import type { RoleName } from '../schemas/common.schema';
import type { IRolesService } from '../services/roles.service';

export interface RolesRouterDeps {
  service?: IRolesService;
  authorizeMiddleware?: (...allowedRoles: RoleName[]) => RequestHandler;
}

export function createRolesRouter(deps?: RolesRouterDeps): Router {
  const router = Router();
  const controller = createRolesController(deps?.service);
  const auth = deps?.authorizeMiddleware ?? authorize;

  router.get('/', auth('Administrador'), controller.getAll);

  return router;
}

export const rolesRouter = createRolesRouter();
