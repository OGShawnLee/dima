import fs from 'node:fs';
import path from 'node:path';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import requestIp from 'request-ip';
import { ZodError } from 'zod';
import { ClaimTypes } from '../config/claimtypes';
import { type ErrorDetail, HttpError } from '../utils/httpError';

const DEFAULT_ERROR_MESSAGE = 'No se ha podido procesar la petición. Inténtelo nuevamente más tarde.';

export interface ErrorHandlerOptions {
  logFilePath?: string;
  nodeEnv?: string;
}

export function sanitizeLogField(value: string): string {
  return value.replace(/[\r\n\t]/g, '');
}

interface ResolvedError {
  statusCode: number;
  clientMessage: string;
  logMessage: string;
  detalles?: ErrorDetail[];
}

function isPayloadTooLargeError(err: unknown): err is Error & { status: number } {
  if (!(err instanceof Error)) {
    return false;
  }
  const candidate = err as { status?: unknown; type?: unknown };
  return candidate.status === 413 || candidate.type === 'entity.too.large';
}

function isMalformedJsonError(err: unknown): err is SyntaxError & { status: number } {
  return (
    err instanceof SyntaxError &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number' &&
    (err as { status: number }).status === 400
  );
}

function resolveError(err: unknown): ResolvedError {
  if (err instanceof HttpError) {
    return {
      statusCode: err.statusCode,
      clientMessage: err.message,
      logMessage: err.message,
      detalles: err.detalles,
    };
  }

  if (err instanceof ZodError) {
    const detalles: ErrorDetail[] = err.errors.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return {
      statusCode: 400,
      clientMessage: 'Datos de entrada inválidos.',
      logMessage: 'Datos de entrada inválidos.',
      detalles,
    };
  }

  if (isPayloadTooLargeError(err)) {
    return {
      statusCode: 413,
      clientMessage: 'El cuerpo de la petición excede el límite permitido.',
      logMessage: err.message,
    };
  }

  if (isMalformedJsonError(err)) {
    return {
      statusCode: 400,
      clientMessage: 'JSON malformado en el cuerpo de la petición.',
      logMessage: err.message,
    };
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo excede el tamaño máximo permitido.'
        : 'Error al procesar el archivo adjunto.';
    return {
      statusCode: 400,
      clientMessage: message,
      logMessage: err.message,
    };
  }

  const rawMessage = err instanceof Error && err.message ? err.message : DEFAULT_ERROR_MESSAGE;
  return {
    statusCode: 500,
    clientMessage: DEFAULT_ERROR_MESSAGE,
    logMessage: rawMessage,
  };
}

export function createErrorHandler(options?: ErrorHandlerOptions): ErrorRequestHandler {
  const resolvedLogPath =
    options?.logFilePath ?? path.resolve(process.cwd(), 'log', 'log.txt');

  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const { statusCode, clientMessage, logMessage, detalles } = resolveError(err);
    const activeNodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? 'production';

    const rawIp = requestIp.getClientIp(req) ?? 'unknown';
    const rawEmail = req.decodedToken?.[ClaimTypes.Name] ?? 'invitado';

    const safeIp = sanitizeLogField(rawIp);
    const safeEmail = sanitizeLogField(rawEmail);
    const safeMessage = sanitizeLogField(logMessage);
    const logLine = `${new Date().toISOString()} - ${statusCode} - ${safeIp} - ${safeEmail} - ${safeMessage}\n`;

    try {
      fs.mkdirSync(path.dirname(resolvedLogPath), { recursive: true });
      fs.appendFileSync(resolvedLogPath, logLine, 'utf8');
    } catch {
      // Avoid crashing the response pipeline if the log file cannot be written.
    }

    if (activeNodeEnv === 'development') {
      res.status(statusCode).json({
        status: statusCode,
        mensaje: clientMessage,
        stack: err instanceof Error ? err.stack : undefined,
        ...(detalles ? { detalles } : {}),
      });
      return;
    }

    res.status(statusCode).json({
      mensaje: clientMessage,
      ...(detalles ? { detalles } : {}),
    });
  };
}

export const errorHandler = createErrorHandler();
