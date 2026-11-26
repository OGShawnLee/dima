import type { NextFunction, Request, Response } from 'express';
import { bitacoraService, type IBitacoraService } from '../services/bitacora.service';

export interface BitacoraController {
  getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export function createBitacoraController(
  service: IBitacoraService = bitacoraService,
): BitacoraController {
  return {
    getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const items = await service.getAll();
        res.status(200).json(items);
      } catch (err) {
        next(err);
      }
    },
  };
}

export const bitacoraController = createBitacoraController();
