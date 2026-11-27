import type { NextFunction, Request, Response } from 'express';
import { buildAuditContext } from '../middlewares/bitacora.middleware';
import type { LoginRequest, RegisterRequest } from '../schemas/auth.schema';
import { authService, type IAuthService } from '../services/auth.service';

export interface AuthController {
  login: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  register: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  tiempo: (req: Request, res: Response) => void;
}

export function createAuthController(service: IAuthService = authService): AuthController {
  return {
    login: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.login(req.body as LoginRequest, buildAuditContext(req));
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    register: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const body = req.body as RegisterRequest;
        const result = await service.register(body, buildAuditContext(req, body.email));
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },

    tiempo: (req: Request, res: Response): void => {
      const remaining = service.obtenerTiempoRestante(req.header('Authorization'));
      if (!remaining) {
        res.status(404).json({ mensaje: 'Tiempo de token no disponible.' });
        return;
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(200).send(remaining);
    },
  };
}

export const authController = createAuthController();
