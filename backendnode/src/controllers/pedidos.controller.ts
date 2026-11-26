import type { NextFunction, Request, Response } from 'express';
import requestIp from 'request-ip';
import { ClaimTypes } from '../config/claimtypes';
import type { AuditContext } from '../schemas/common.schema';
import { pedidosService, type IPedidosService } from '../services/pedidos.service';
import { notFound, unauthorized } from '../utils/httpError';

export interface PedidosController {
  create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getMine: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

function getAuditContext(req: Request): AuditContext {
  return {
    ip: requestIp.getClientIp(req) ?? 'unknown',
    actorEmail: req.decodedToken?.[ClaimTypes.Name] ?? 'invitado',
  };
}

export function createPedidosController(
  service: IPedidosService = pedidosService,
): PedidosController {
  return {
    create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const actorEmail = req.decodedToken?.[ClaimTypes.Name];
        if (!actorEmail) {
          next(unauthorized());
          return;
        }
        const created = await service.create(req.body, actorEmail, getAuditContext(req));
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },

    getMine: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const actorEmail = req.decodedToken?.[ClaimTypes.Name];
        if (!actorEmail) {
          next(unauthorized());
          return;
        }
        const items = await service.getMine(actorEmail);
        res.status(200).json(items);
      } catch (err) {
        next(err);
      }
    },

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
        const email = req.decodedToken?.[ClaimTypes.Name];
        const rol = req.decodedToken?.[ClaimTypes.Role];
        if (!email || (rol !== 'Usuario' && rol !== 'Administrador')) {
          next(unauthorized());
          return;
        }

        const item = await service.getById(id, { email, rol });
        if (!item) {
          next(notFound('Pedido no encontrado'));
          return;
        }
        res.status(200).json(item);
      } catch (err) {
        next(err);
      }
    },
  };
}

export const pedidosController = createPedidosController();
