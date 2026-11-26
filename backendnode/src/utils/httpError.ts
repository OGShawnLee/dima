export interface ErrorDetail {
  path: string;
  message: string;
}

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly detalles?: ErrorDetail[];

  constructor(statusCode: number, message: string, detalles?: ErrorDetail[]) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    if (detalles) {
      this.detalles = detalles;
    }
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export function badRequest(message: string, detalles?: ErrorDetail[]): HttpError {
  return new HttpError(400, message, detalles);
}

export function unauthorized(message = 'Acceso denegado'): HttpError {
  return new HttpError(401, message);
}

export function forbidden(message = 'No tiene permisos para realizar esta acción'): HttpError {
  return new HttpError(403, message);
}

export function notFound(message = 'Recurso no encontrado'): HttpError {
  return new HttpError(404, message);
}

export function conflict(message: string): HttpError {
  return new HttpError(409, message);
}
