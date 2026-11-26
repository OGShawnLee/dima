import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

export interface AuthRateLimiterOptions {
  windowMs?: number;
  max?: number;
}

export function createAuthRateLimiter(options?: AuthRateLimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options?.windowMs ?? 15 * 60 * 1000,
    max: options?.max ?? 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      mensaje: 'Demasiados intentos de inicio de sesión. Inténtelo nuevamente más tarde.',
    },
  });
}
