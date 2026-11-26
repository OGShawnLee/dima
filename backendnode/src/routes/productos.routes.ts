import { Router, type RequestHandler } from 'express';
import { createProductosController } from '../controllers/productos.controller';
import { authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { NumericIdParamSchema, type RoleName } from '../schemas/common.schema';
import {
  AssignCategoriaBodySchema,
  CreateProductoRequestSchema,
  ProductoCategoriaParamsSchema,
  ProductoSearchQuerySchema,
  UpdateProductoRequestSchema,
} from '../schemas/productos.schema';
import type { IProductosService } from '../services/productos.service';

export interface ProductosRouterDeps {
  service?: IProductosService;
  authorizeMiddleware?: (...allowedRoles: RoleName[]) => RequestHandler;
}

export function createProductosRouter(deps?: ProductosRouterDeps): Router {
  const router = Router();
  const controller = createProductosController(deps?.service);
  const auth = deps?.authorizeMiddleware ?? authorize;

  router.get(
    '/',
    auth('Usuario', 'Administrador'),
    validate({ query: ProductoSearchQuerySchema }),
    controller.getAll,
  );
  router.get(
    '/:id',
    auth('Usuario', 'Administrador'),
    validate({ params: NumericIdParamSchema }),
    controller.getById,
  );
  router.post(
    '/',
    auth('Administrador'),
    validate({ body: CreateProductoRequestSchema }),
    controller.create,
  );
  router.put(
    '/:id',
    auth('Administrador'),
    validate({ params: NumericIdParamSchema, body: UpdateProductoRequestSchema }),
    controller.update,
  );
  router.delete(
    '/:id',
    auth('Administrador'),
    validate({ params: NumericIdParamSchema }),
    controller.delete,
  );
  router.post(
    '/:id/categoria',
    auth('Administrador'),
    validate({ params: NumericIdParamSchema, body: AssignCategoriaBodySchema }),
    controller.assignCategoria,
  );
  router.delete(
    '/:id/categoria/:categoriaid',
    auth('Administrador'),
    validate({ params: ProductoCategoriaParamsSchema }),
    controller.removeCategoria,
  );

  return router;
}

export const productosRouter = createProductosRouter();
