import { Router, type RequestHandler } from 'express';
import { createCategoriasController } from '../controllers/categorias.controller';
import { authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  CreateCategoriaRequestSchema,
  UpdateCategoriaRequestSchema,
} from '../schemas/categorias.schema';
import { NumericIdParamSchema, type RoleName } from '../schemas/common.schema';
import type { ICategoriasService } from '../services/categorias.service';

export interface CategoriasRouterDeps {
  service?: ICategoriasService;
  authorizeMiddleware?: (...allowedRoles: RoleName[]) => RequestHandler;
}

export function createCategoriasRouter(deps?: CategoriasRouterDeps): Router {
  const router = Router();
  const controller = createCategoriasController(deps?.service);
  const auth = deps?.authorizeMiddleware ?? authorize;

  router.get('/', auth('Usuario', 'Administrador'), controller.getAll);
  router.get(
    '/:id',
    auth('Usuario', 'Administrador'),
    validate({ params: NumericIdParamSchema }),
    controller.getById,
  );
  router.post(
    '/',
    auth('Administrador'),
    validate({ body: CreateCategoriaRequestSchema }),
    controller.create,
  );
  router.put(
    '/:id',
    auth('Administrador'),
    validate({ params: NumericIdParamSchema, body: UpdateCategoriaRequestSchema }),
    controller.update,
  );
  router.delete(
    '/:id',
    auth('Administrador'),
    validate({ params: NumericIdParamSchema }),
    controller.delete,
  );

  return router;
}

export const categoriasRouter = createCategoriasRouter();
