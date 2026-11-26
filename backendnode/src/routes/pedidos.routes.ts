import { Router, type RequestHandler } from 'express';
import { createPedidosController } from '../controllers/pedidos.controller';
import { authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { NumericIdParamSchema, type RoleName } from '../schemas/common.schema';
import { CreatePedidoRequestSchema } from '../schemas/pedidos.schema';
import type { IPedidosService } from '../services/pedidos.service';

export interface PedidosRouterDeps {
  service?: IPedidosService;
  authorizeMiddleware?: (...allowedRoles: RoleName[]) => RequestHandler;
}

export function createPedidosRouter(deps?: PedidosRouterDeps): Router {
  const router = Router();
  const controller = createPedidosController(deps?.service);
  const auth = deps?.authorizeMiddleware ?? authorize;

  router.post(
    '/',
    auth('Usuario'),
    validate({ body: CreatePedidoRequestSchema }),
    controller.create,
  );
  // Register /mios before /:id so Express never interprets "mios" as :id.
  router.get('/mios', auth('Usuario'), controller.getMine);
  router.get('/', auth('Administrador'), controller.getAll);
  router.get(
    '/:id',
    auth('Usuario', 'Administrador'),
    validate({ params: NumericIdParamSchema }),
    controller.getById,
  );

  return router;
}

export const pedidosRouter = createPedidosRouter();
