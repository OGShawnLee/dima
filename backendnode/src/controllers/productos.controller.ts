import type { NextFunction, Request, Response } from 'express';
import { buildAuditContext } from '../middlewares/bitacora.middleware';
import { productosService, type IProductosService } from '../services/productos.service';
import { notFound } from '../utils/httpError';

export interface ProductosController {
  getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  update: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  delete: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  assignCategoria: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  removeCategoria: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export function createProductosController(
  service: IProductosService = productosService,
): ProductosController {
  return {
    getAll: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const search = typeof req.query.s === 'string' ? req.query.s : undefined;
        const items = await service.getAll(search);
        res.status(200).json(items);
      } catch (err) {
        next(err);
      }
    },

    getById: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = Number(req.params.id);
        const item = await service.getById(id);
        if (!item) {
          next(notFound('Producto no encontrado'));
          return;
        }
        res.status(200).json(item);
      } catch (err) {
        next(err);
      }
    },

    create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const created = await service.create(req.body, buildAuditContext(req));
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },

    update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = Number(req.params.id);
        await service.update(id, req.body, buildAuditContext(req));
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    delete: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = Number(req.params.id);
        await service.delete(id, buildAuditContext(req));
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    assignCategoria: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const productoId = Number(req.params.id);
        const categoriaId = Number(req.body.categoriaid);
        await service.assignCategoria(productoId, categoriaId, buildAuditContext(req));
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    removeCategoria: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const productoId = Number(req.params.id);
        const categoriaId = Number(req.params.categoriaid);
        await service.removeCategoria(productoId, categoriaId, buildAuditContext(req));
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}

export const productosController = createProductosController();
