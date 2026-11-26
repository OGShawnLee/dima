import { eq } from 'drizzle-orm';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ClaimTypes } from '../config/claimtypes';
import { db, type DbClient } from '../db';
import { rol, usuario } from '../db/schema';
import { RoleNameSchema, type RoleName } from '../schemas/common.schema';
import { jwtTokenService, type IJwtTokenService } from '../services/jwttoken.service';
import type { DecodedTokenPayload } from '../types/express';
import { forbidden, unauthorized } from '../utils/httpError';

const REFRESH_WINDOW_MINUTES = 5;

export interface ActiveUserRecord {
  email: string;
  nombre: string;
  rol: RoleName;
}

export type FindActiveUserByEmail = (email: string) => Promise<ActiveUserRecord | null>;

export interface AuthorizeDeps {
  jwtService?: IJwtTokenService;
  findActiveUserByEmail?: FindActiveUserByEmail;
  database?: DbClient;
}

export function createDefaultFindActiveUserByEmail(
  database: DbClient = db,
): FindActiveUserByEmail {
  return async (email: string): Promise<ActiveUserRecord | null> => {
    const rows = await database
      .select({
        email: usuario.email,
        nombre: usuario.nombre,
        rol: rol.nombre,
      })
      .from(usuario)
      .innerJoin(rol, eq(usuario.rolid, rol.id))
      .where(eq(usuario.email, email))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    const parsedRole = RoleNameSchema.safeParse(row.rol);
    if (!parsedRole.success) {
      return null;
    }

    return {
      email: row.email,
      nombre: row.nombre,
      rol: parsedRole.data,
    };
  };
}

export function createAuthorize(
  deps?: AuthorizeDeps,
): (...allowedRoles: RoleName[]) => RequestHandler {
  const jwtService = deps?.jwtService ?? jwtTokenService;
  const findActiveUserByEmail =
    deps?.findActiveUserByEmail ?? createDefaultFindActiveUserByEmail(deps?.database);

  return (...allowedRoles: RoleName[]): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          next(unauthorized('Acceso denegado'));
          return;
        }

        const token = authHeader.slice('Bearer '.length).trim();
        if (!token) {
          next(unauthorized('Acceso denegado'));
          return;
        }

        let decoded: DecodedTokenPayload;
        try {
          decoded = jwtService.verificarToken(token);
        } catch {
          next(unauthorized('Acceso denegado'));
          return;
        }

        const tokenRole = decoded[ClaimTypes.Role];
        if (allowedRoles.length > 0 && !allowedRoles.includes(tokenRole)) {
          next(forbidden('Acceso denegado'));
          return;
        }

        if (typeof decoded.exp !== 'number') {
          next(unauthorized('Acceso denegado'));
          return;
        }

        const minutosRestantes = (decoded.exp - Date.now() / 1000) / 60;
        if (minutosRestantes < REFRESH_WINDOW_MINUTES) {
          const activeUser = await findActiveUserByEmail(decoded[ClaimTypes.Name]);
          if (!activeUser) {
            next(unauthorized('Acceso denegado'));
            return;
          }

          if (allowedRoles.length > 0 && !allowedRoles.includes(activeUser.rol)) {
            next(forbidden('Acceso denegado'));
            return;
          }

          decoded = {
            ...decoded,
            [ClaimTypes.Name]: activeUser.email,
            [ClaimTypes.GivenName]: activeUser.nombre,
            [ClaimTypes.Role]: activeUser.rol,
          };

          const refreshedToken = jwtService.generaToken(
            activeUser.email,
            activeUser.nombre,
            activeUser.rol,
          );
          res.setHeader('Set-Authorization', refreshedToken);
        }

        req.decodedToken = decoded;
        next();
      } catch (err) {
        next(err);
      }
    };
  };
}

export const authorize = createAuthorize();
