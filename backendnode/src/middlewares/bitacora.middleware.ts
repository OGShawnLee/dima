import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ClaimTypes } from '../config/claimtypes';
import type { AuditContext } from '../schemas/common.schema';
import { bitacoraService, type IBitacoraService } from '../services/bitacora.service';
import { extractClientIp } from './ratelimit.middleware';

export function buildAuditContext(req: Request, actorEmailOverride?: string): AuditContext {
  return {
    ip: extractClientIp(req),
    actorEmail: actorEmailOverride ?? req.decodedToken?.[ClaimTypes.Name] ?? 'invitado',
  };
}

export function createBitacoraMiddleware(service: IBitacoraService = bitacoraService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip = extractClientIp(req);

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
