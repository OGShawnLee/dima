import type { NextFunction, Request, Response } from 'express';
import requestIp from 'request-ip';
import { ClaimTypes } from '../config/claimtypes';
import type { AuditContext } from '../schemas/common.schema';
import type {
  CreateUsuarioRequest,
  UpdateUsuarioRequest,
} from '../schemas/usuarios.schema';
import { usuariosService, type IUsuariosService } from '../services/usuarios.service';
import { notFound } from '../utils/httpError';

export interface UsuariosController {
  getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getByEmail: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  update: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  remove: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

function buildAuditContext(req: Request): AuditContext {
  return {
    ip: requestIp.getClientIp(req) ?? 'unknown',
    actorEmail: req.decodedToken?.[ClaimTypes.Name] ?? 'invitado',
  };
}

export function createUsuariosController(
  service: IUsuariosService = usuariosService,
): UsuariosController {
  return {
    getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const users = await service.getAll();
        res.status(200).json(users);
      } catch (err) {
        next(err);
      }
    },

    getByEmail: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = await service.getByEmail(req.params.email);
        if (!user) {
          next(notFound('Usuario no encontrado.'));
          return;
        }
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },

    create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const created = await service.create(
          req.body as CreateUsuarioRequest,
          buildAuditContext(req),
        );
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },

    update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        await service.update(
          req.params.email,
          req.body as UpdateUsuarioRequest,
          buildAuditContext(req),
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    remove: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        await service.delete(req.params.email, buildAuditContext(req));
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}

export const usuariosController = createUsuariosController();
