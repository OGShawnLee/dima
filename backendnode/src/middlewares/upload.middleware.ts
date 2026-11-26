import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { badRequest } from '../utils/httpError';

export const MAX_IMAGE_SIZE_BYTES = 100 * 1024;
const INVALID_JPEG_MESSAGE = 'Solo se permiten imágenes con extensión JPG.';

export function isValidJpegMagicBytes(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export function isAllowedJpegExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.jpg' || ext === '.jpeg';
}

function jpegFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if (file.mimetype === 'image/jpeg' && isAllowedJpegExtension(file.originalname)) {
    cb(null, true);
    return;
  }
  cb(badRequest(INVALID_JPEG_MESSAGE));
}

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: jpegFileFilter,
});

export function validateUploadedJpeg(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file) {
    next(badRequest('El archivo es obligatorio.'));
    return;
  }

  if (!isValidJpegMagicBytes(req.file.buffer)) {
    next(badRequest(INVALID_JPEG_MESSAGE));
    return;
  }

  next();
}
