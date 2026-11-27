import type { Request } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

export interface AuthRateLimiterOptions {
  windowMs?: number;
  max?: number;
}

/**
 * Extracts the client IP using Express's trust-proxy-aware `req.ip`
 * instead of blindly trusting unvalidated forwarded headers.
 */
export function extractClientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function createAuthRateLimiter(options?: AuthRateLimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options?.windowMs ?? 15 * 60 * 1000,
    max: options?.max ?? 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      const ip = extractClientIp(req);
      const rawEmail = (req.body as { email?: unknown } | undefined)?.email;
      if (typeof rawEmail === 'string') {
        const normalizedEmail = rawEmail.trim().toLowerCase();
        if (normalizedEmail.length > 0) {
          return `${ip}:${normalizedEmail}`;
        }
      }
      return ip;
    },
    message: {
      mensaje: 'Demasiados intentos de inicio de sesión. Inténtelo nuevamente más tarde.',
    },
  });
}

export function createLoginIpRateLimiter(
  options?: AuthRateLimiterOptions,
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options?.windowMs ?? 15 * 60 * 1000,
    max: options?.max ?? 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => extractClientIp(req),
    message: {
      mensaje: 'Demasiados intentos de inicio de sesión desde esta dirección IP. Inténtelo nuevamente más tarde.',
    },
  });
}

export function createRegisterRateLimiter(
  options?: AuthRateLimiterOptions,
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options?.windowMs ?? 60 * 60 * 1000,
    max: options?.max ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => extractClientIp(req),
    message: {
      mensaje: 'Demasiados intentos de registro desde esta dirección IP. Inténtelo nuevamente más tarde.',
    },
  });
}
