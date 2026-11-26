import { Router, type RequestHandler } from 'express';
import { createArchivosController } from '../controllers/archivos.controller';
import { authorize } from '../middlewares/auth.middleware';
import { uploadImage, validateUploadedJpeg } from '../middlewares/upload.middleware';
import { validate } from '../middlewares/validate.middleware';
import { NumericIdParamSchema, type RoleName } from '../schemas/common.schema';
import type { IArchivosService } from '../services/archivos.service';

export interface ArchivosRouterDeps {
  service?: IArchivosService;
  authorizeMiddleware?: (...allowedRoles: RoleName[]) => RequestHandler;
}

export function createArchivosRouter(deps?: ArchivosRouterDeps): Router {
  const router = Router();
  const controller = createArchivosController(deps?.service);
  const auth = deps?.authorizeMiddleware ?? authorize;

  router.get('/', auth('Administrador'), controller.getAll);
  router.get(
    '/:id/detalle',
    auth('Administrador'),
    validate({ params: NumericIdParamSchema }),
    controller.getDetalle,
  );
  router.get('/:id', validate({ params: NumericIdParamSchema }), controller.getBinary);
  router.post(
    '/',
    auth('Administrador'),
    uploadImage.single('file'),
    validateUploadedJpeg,
    controller.create,
  );
  router.put(
    '/:id',
    auth('Administrador'),
    validate({ params: NumericIdParamSchema }),
    uploadImage.single('file'),
    validateUploadedJpeg,
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

export const archivosRouter = createArchivosRouter();
