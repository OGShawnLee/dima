import type { NextFunction, Request, Response } from 'express';
import { buildAuditContext } from '../middlewares/bitacora.middleware';
import { categoriasService, type ICategoriasService } from '../services/categorias.service';
import { notFound } from '../utils/httpError';

export interface CategoriasController {
  getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  update: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  delete: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export function createCategoriasController(
  service: ICategoriasService = categoriasService,
): CategoriasController {
  return {
    getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const items = await service.getAll();
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
          next(notFound('Categoría no encontrada'));
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
  };
}

export const categoriasController = createCategoriasController();
