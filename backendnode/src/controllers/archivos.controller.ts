import type { NextFunction, Request, Response } from 'express';
import requestIp from 'request-ip';
import { ClaimTypes } from '../config/claimtypes';
import type { AuditContext } from '../schemas/common.schema';
import {
  archivosService,
  type IArchivosService,
  type UploadedImageInput,
} from '../services/archivos.service';
import { badRequest, notFound } from '../utils/httpError';

export interface ArchivosController {
  getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getDetalle: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getBinary: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  update: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  delete: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

function buildAuditContext(req: Request): AuditContext {
  return {
    ip: requestIp.getClientIp(req) ?? 'unknown',
    actorEmail: req.decodedToken?.[ClaimTypes.Name] ?? 'invitado',
  };
}

function toUploadedImageInput(file: Express.Multer.File): UploadedImageInput {
  return {
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

export function createArchivosController(
  service: IArchivosService = archivosService,
): ArchivosController {
  return {
    getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const items = await service.getAll();
        res.status(200).json(items);
      } catch (err) {
        next(err);
      }
    },

    getDetalle: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = Number(req.params.id);
        const item = await service.getDetalle(id);
        if (!item) {
          throw notFound('Archivo no encontrado.');
        }
        res.status(200).json(item);
      } catch (err) {
        next(err);
      }
    },

    getBinary: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = Number(req.params.id);
        const result = await service.getBinary(id);
        if (!result) {
          throw notFound('Archivo no encontrado.');
        }
        res.setHeader('Content-Type', result.mime);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(200).send(result.buffer);
      } catch (err) {
        next(err);
      }
    },

    create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.file) {
          throw badRequest('El archivo es obligatorio.');
        }
        const created = await service.create(toUploadedImageInput(req.file), buildAuditContext(req));
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },

    update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = Number(req.params.id);
        if (!req.file) {
          throw badRequest('El archivo es obligatorio.');
        }
        await service.update(id, toUploadedImageInput(req.file), buildAuditContext(req));
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

export const archivosController = createArchivosController();
