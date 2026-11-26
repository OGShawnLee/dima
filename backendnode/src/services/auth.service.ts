import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db, type DbClient } from '../db';
import { rol, usuario } from '../db/schema';
import type { LoginRequest, LoginResponse, RegisterRequest } from '../schemas/auth.schema';
import { RoleNameSchema, type AuditContext, type RoleName } from '../schemas/common.schema';
import type { UsuarioDto } from '../schemas/usuarios.schema';
import { bitacoraService, type IBitacoraService } from './bitacora.service';
import { jwtTokenService, type IJwtTokenService } from './jwttoken.service';
import { createRolesService, rolesService, type IRolesService } from './roles.service';
import { badRequest, conflict, unauthorized } from '../utils/httpError';

const BCRYPT_COST = 10;
const INVALID_CREDENTIALS_MESSAGE = 'Usuario o contraseña incorrectos.';
// Pre-computed bcrypt cost-10 hash used for constant-time comparison when email is unknown (DEC-009).
const DUMMY_BCRYPT_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export interface AuthUserRecord {
  email: string;
  nombre: string;
  passwordhash: string;
  rol: RoleName;
}

export interface InsertRegisteredUserData {
  id: string;
  email: string;
  passwordhash: string;
  nombre: string;
  protegido: boolean;
  rolid: string;
}

export type FindAuthUserByEmail = (email: string) => Promise<AuthUserRecord | null>;
export type InsertRegisteredUser = (data: InsertRegisteredUserData) => Promise<void>;

export interface IAuthService {
  login(input: LoginRequest, audit: AuditContext): Promise<LoginResponse>;
  register(input: RegisterRequest, audit: AuditContext): Promise<UsuarioDto>;
  obtenerTiempoRestante(bearerHeader: string | undefined): string | null;
}

export interface AuthServiceDeps {
  findUserByEmail?: FindAuthUserByEmail;
  insertRegisteredUser?: InsertRegisteredUser;
  rolesService?: IRolesService;
  jwtService?: IJwtTokenService;
  bitacora?: IBitacoraService;
  database?: DbClient;
}

function isDuplicateEntryError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const candidate = err as { code?: unknown; errno?: unknown };
  return candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062;
}

export function createDefaultInsertRegisteredUser(
  database: DbClient = db,
): InsertRegisteredUser {
  return async (data: InsertRegisteredUserData): Promise<void> => {
    await database.insert(usuario).values({
      id: data.id,
      email: data.email,
      passwordhash: data.passwordhash,
      nombre: data.nombre,
      protegido: data.protegido,
      rolid: data.rolid,
    });
  };
}

export function createDefaultFindAuthUserByEmail(
  database: DbClient = db,
): FindAuthUserByEmail {
  return async (email: string): Promise<AuthUserRecord | null> => {
    const rows = await database
      .select({
        email: usuario.email,
        nombre: usuario.nombre,
        passwordhash: usuario.passwordhash,
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
      passwordhash: row.passwordhash,
      rol: parsedRole.data,
    };
  };
}

export class AuthService implements IAuthService {
  private readonly findUserByEmail: FindAuthUserByEmail;
  private readonly insertRegisteredUser: InsertRegisteredUser;
  private readonly roles: IRolesService;
  private readonly jwtService: IJwtTokenService;
  private readonly bitacora: IBitacoraService;

  constructor(deps?: AuthServiceDeps) {
    this.findUserByEmail =
      deps?.findUserByEmail ?? createDefaultFindAuthUserByEmail(deps?.database);
    this.insertRegisteredUser =
      deps?.insertRegisteredUser ?? createDefaultInsertRegisteredUser(deps?.database);
    this.roles =
      deps?.rolesService ?? (deps?.database ? createRolesService(deps.database) : rolesService);
    this.jwtService = deps?.jwtService ?? jwtTokenService;
    this.bitacora = deps?.bitacora ?? bitacoraService;
  }

  async login(input: LoginRequest, audit: AuditContext): Promise<LoginResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.findUserByEmail(normalizedEmail);

    if (!user) {
      await bcrypt.compare(input.password, DUMMY_BCRYPT_HASH);
      await this.bitacora.registrar({
        accion: 'usuario.login.fallido',
        elementoid: normalizedEmail,
        ip: audit.ip,
        usuario: audit.actorEmail,
      });
      throw unauthorized(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordhash);
    if (!passwordMatches) {
      await this.bitacora.registrar({
        accion: 'usuario.login.fallido',
        elementoid: user.email,
        ip: audit.ip,
        usuario: audit.actorEmail,
      });
      throw unauthorized(INVALID_CREDENTIALS_MESSAGE);
    }

    const jwt = this.jwtService.generaToken(user.email, user.nombre, user.rol);
    await this.bitacora.registrar({
      accion: 'usuario.login',
      elementoid: user.email,
      ip: audit.ip,
      usuario: user.email,
    });

    return {
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      jwt,
    };
  }

  async register(input: RegisterRequest, audit: AuditContext): Promise<UsuarioDto> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const nombre = input.nombre.trim();

    const usuarioRole = await this.roles.findByNombre('Usuario');
    if (!usuarioRole) {
      throw badRequest('El rol especificado no existe.');
    }

    const existing = await this.findUserByEmail(normalizedEmail);
    if (existing) {
      throw conflict('El correo electrónico ya está registrado.');
    }

    const passwordhash = await bcrypt.hash(input.password, BCRYPT_COST);
    const id = crypto.randomUUID();

    try {
      await this.insertRegisteredUser({
        id,
        email: normalizedEmail,
        passwordhash,
        nombre,
        protegido: false,
        rolid: usuarioRole.id,
      });
    } catch (err) {
      if (isDuplicateEntryError(err)) {
        throw conflict('El correo electrónico ya está registrado.');
      }
      throw err;
    }

    await this.bitacora.registrar({
      accion: 'usuario.registro',
      elementoid: normalizedEmail,
      ip: audit.ip,
      usuario: normalizedEmail,
    });

    return {
      id,
      email: normalizedEmail,
      nombre,
      rol: 'Usuario',
    };
  }

  obtenerTiempoRestante(bearerHeader: string | undefined): string | null {
    if (!bearerHeader || !bearerHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = bearerHeader.slice('Bearer '.length).trim();
    if (!token) {
      return null;
    }
    return this.jwtService.tiempoRestanteDesdeToken(token);
  }
}

export function createAuthService(deps?: AuthServiceDeps): IAuthService {
  return new AuthService(deps);
}

export const authService: IAuthService = new AuthService();
