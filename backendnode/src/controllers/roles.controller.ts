import type { NextFunction, Request, Response } from 'express';
import { rolesService, type IRolesService } from '../services/roles.service';

export interface RolesController {
  getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export function createRolesController(service: IRolesService = rolesService): RolesController {
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

export const rolesController = createRolesController();
