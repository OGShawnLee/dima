import type { NextFunction, Request, RequestHandler, Response } from 'express';
import requestIp from 'request-ip';
import { ClaimTypes } from '../config/claimtypes';
import { bitacoraService, type IBitacoraService } from '../services/bitacora.service';

export function createBitacoraMiddleware(service: IBitacoraService = bitacoraService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip = requestIp.getClientIp(req) ?? 'unknown';

    req.bitacora = async (accion: string, elementoid?: string | number | null): Promise<void> => {
      const usuario = req.decodedToken?.[ClaimTypes.Name] ?? 'invitado';
      await service.registrar({
        accion,
        elementoid: elementoid ?? null,
        ip,
        usuario,
      });
    };

    next();
  };
}

export const bitacoraMiddleware = createBitacoraMiddleware();
