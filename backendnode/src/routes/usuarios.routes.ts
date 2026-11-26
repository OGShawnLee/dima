import { Router, type RequestHandler } from 'express';
import { createUsuariosController } from '../controllers/usuarios.controller';
import { authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import type { RoleName } from '../schemas/common.schema';
import {
  CreateUsuarioRequestSchema,
  UpdateUsuarioRequestSchema,
  UsuarioEmailParamSchema,
} from '../schemas/usuarios.schema';
import type { IUsuariosService } from '../services/usuarios.service';

export interface UsuariosRouterDeps {
  service?: IUsuariosService;
  authorizeMiddleware?: (...allowedRoles: RoleName[]) => RequestHandler;
}

export function createUsuariosRouter(deps?: UsuariosRouterDeps): Router {
  const router = Router();
  const controller = createUsuariosController(deps?.service);
  const auth = deps?.authorizeMiddleware ?? authorize;

  router.get('/', auth('Administrador'), controller.getAll);
  router.get(
    '/:email',
    auth('Administrador'),
    validate({ params: UsuarioEmailParamSchema }),
    controller.getByEmail,
  );
  router.post(
    '/',
    auth('Administrador'),
    validate({ body: CreateUsuarioRequestSchema }),
    controller.create,
  );
  router.put(
    '/:email',
    auth('Administrador'),
    validate({ params: UsuarioEmailParamSchema, body: UpdateUsuarioRequestSchema }),
    controller.update,
  );
  router.delete(
    '/:email',
    auth('Administrador'),
    validate({ params: UsuarioEmailParamSchema }),
    controller.remove,
  );

  return router;
}

export const usuariosRouter = createUsuariosRouter();
