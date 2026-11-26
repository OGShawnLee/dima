import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { ClaimTypes } from '../config/claimtypes';
import { env } from '../config/env';
import { RoleNameSchema, type RoleName } from '../schemas/common.schema';
import type { DecodedTokenPayload } from '../types/express';

export const JWT_ISSUER = 'ServidorFeiJWT';
export const JWT_AUDIENCE = 'ClientesFeiJWT';
export const JWT_ALGORITHM = 'HS256' as const;
export const JWT_EXPIRES_IN = '20m';

const TokenClaimsSchema = z.object({
  [ClaimTypes.Name]: z.string().min(1),
  [ClaimTypes.GivenName]: z.string().min(1),
  [ClaimTypes.Role]: RoleNameSchema,
  exp: z.number().optional(),
  iat: z.number().optional(),
  iss: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
});

export interface IJwtTokenService {
  generaToken(email: string, nombre: string, rol: RoleName): string;
  verificarToken(token: string): DecodedTokenPayload;
  tiempoRestanteDesdeToken(token: string): string | null;
}

export class JwtTokenService implements IJwtTokenService {
  constructor(private readonly secretOverride?: string) {}

  private getSecret(): string {
    return this.secretOverride ?? env.JWT_SECRET;
  }

  generaToken(email: string, nombre: string, rol: RoleName): string {
    return jwt.sign(
      {
        [ClaimTypes.Name]: email,
        [ClaimTypes.GivenName]: nombre,
        [ClaimTypes.Role]: rol,
      },
      this.getSecret(),
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: JWT_EXPIRES_IN,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      },
    );
  }

  verificarToken(token: string): DecodedTokenPayload {
    const verified = jwt.verify(token, this.getSecret(), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (typeof verified === 'string') {
      throw new Error('Invalid token payload');
    }

    const parsed = TokenClaimsSchema.safeParse(verified);
    if (!parsed.success) {
      throw new Error('Invalid token claims');
    }

    return parsed.data as DecodedTokenPayload;
  }

  tiempoRestanteDesdeToken(token: string): string | null {
    try {
      const decoded = this.verificarToken(token);
      if (typeof decoded.exp !== 'number') {
        return null;
      }

      const remainingSeconds = Math.max(0, Math.floor(decoded.exp - Date.now() / 1000));
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;

      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } catch {
      return null;
    }
  }
}

export function createJwtTokenService(secretOverride?: string): IJwtTokenService {
  return new JwtTokenService(secretOverride);
}

export const jwtTokenService: IJwtTokenService = new JwtTokenService();
