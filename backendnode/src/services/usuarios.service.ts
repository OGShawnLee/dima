import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { asc, eq } from 'drizzle-orm';
import { db, type DbClient } from '../db';
import { rol, usuario } from '../db/schema';
import { RoleNameSchema, type AuditContext, type RoleName } from '../schemas/common.schema';
import type {
  CreateUsuarioRequest,
  UpdateUsuarioRequest,
  UsuarioDto,
} from '../schemas/usuarios.schema';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError';
import { bitacoraService, type IBitacoraService } from './bitacora.service';
import { rolesService, type IRolesService } from './roles.service';

const BCRYPT_COST = 10;

export interface UsuarioRecord {
  id: string;
  email: string;
  nombre: string;
  protegido: boolean;
  rol: RoleName;
}

export interface InsertUsuarioData {
  id: string;
  email: string;
  passwordhash: string;
  nombre: string;
  protegido: boolean;
  rolid: string;
}

export interface UpdateUsuarioData {
  rolid: string;
  nombre?: string;
}

export interface IUsuariosRepository {
  findAll(): Promise<UsuarioDto[]>;
  findByEmail(email: string): Promise<UsuarioRecord | null>;
  insert(data: InsertUsuarioData): Promise<void>;
  updateByEmail(email: string, data: UpdateUsuarioData): Promise<void>;
  deleteByEmail(email: string): Promise<void>;
}

export interface IUsuariosService {
  getAll(): Promise<UsuarioDto[]>;
  getByEmail(email: string): Promise<UsuarioDto | null>;
  create(input: CreateUsuarioRequest, audit: AuditContext): Promise<UsuarioDto>;
  update(email: string, input: UpdateUsuarioRequest, audit: AuditContext): Promise<void>;
  delete(email: string, audit: AuditContext): Promise<void>;
}

export interface UsuariosServiceDeps {
  repository?: IUsuariosRepository;
  database?: DbClient;
  rolesService?: IRolesService;
  bitacora?: IBitacoraService;
}

function isDuplicateEntryError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const candidate = err as { code?: unknown; errno?: unknown };
  return candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062;
}

export class DrizzleUsuariosRepository implements IUsuariosRepository {
  constructor(private readonly database: DbClient = db) {}

  async findAll(): Promise<UsuarioDto[]> {
    const rows = await this.database
      .select({
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: rol.nombre,
      })
      .from(usuario)
      .innerJoin(rol, eq(usuario.rolid, rol.id))
      .orderBy(asc(usuario.email));

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      nombre: row.nombre,
      rol: RoleNameSchema.parse(row.rol),
    }));
  }

  async findByEmail(email: string): Promise<UsuarioRecord | null> {
    const rows = await this.database
      .select({
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        protegido: usuario.protegido,
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

    return {
      id: row.id,
      email: row.email,
      nombre: row.nombre,
      protegido: row.protegido,
      rol: RoleNameSchema.parse(row.rol),
    };
  }

  async insert(data: InsertUsuarioData): Promise<void> {
    await this.database.insert(usuario).values({
      id: data.id,
      email: data.email,
      passwordhash: data.passwordhash,
      nombre: data.nombre,
      protegido: data.protegido,
      rolid: data.rolid,
    });
  }

  async updateByEmail(email: string, data: UpdateUsuarioData): Promise<void> {
    const updateValues: { rolid: string; nombre?: string } = {
      rolid: data.rolid,
    };
    if (data.nombre !== undefined) {
      updateValues.nombre = data.nombre;
    }

    await this.database
      .update(usuario)
      .set(updateValues)
      .where(eq(usuario.email, email));
  }

  async deleteByEmail(email: string): Promise<void> {
    await this.database.delete(usuario).where(eq(usuario.email, email));
  }
}

export class UsuariosService implements IUsuariosService {
  private readonly repository: IUsuariosRepository;
  private readonly roles: IRolesService;
  private readonly bitacora: IBitacoraService;

  constructor(deps?: UsuariosServiceDeps) {
    this.repository =
      deps?.repository ?? new DrizzleUsuariosRepository(deps?.database ?? db);
    this.roles = deps?.rolesService ?? rolesService;
    this.bitacora = deps?.bitacora ?? bitacoraService;
  }

  async getAll(): Promise<UsuarioDto[]> {
    return this.repository.findAll();
  }

  async getByEmail(email: string): Promise<UsuarioDto | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const record = await this.repository.findByEmail(normalizedEmail);
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      email: record.email,
      nombre: record.nombre,
      rol: record.rol,
    };
  }

  async create(input: CreateUsuarioRequest, audit: AuditContext): Promise<UsuarioDto> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const role = await this.roles.findByNombre(input.rol);
    if (!role) {
      throw badRequest('El rol especificado no existe.');
    }

    const existing = await this.repository.findByEmail(normalizedEmail);
    if (existing) {
      throw conflict('El correo electrónico ya está registrado.');
    }

    const passwordhash = await bcrypt.hash(input.password, BCRYPT_COST);
    const id = crypto.randomUUID();

    try {
      await this.repository.insert({
        id,
        email: normalizedEmail,
        passwordhash,
        nombre: input.nombre,
        protegido: false,
        rolid: role.id,
      });
    } catch (err) {
      if (isDuplicateEntryError(err)) {
        throw conflict('El correo electrónico ya está registrado.');
      }
      throw err;
    }

    await this.bitacora.registrar({
      accion: 'usuarios.crear',
      elementoid: normalizedEmail,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });

    return {
      id,
      email: normalizedEmail,
      nombre: input.nombre,
      rol: role.nombre,
    };
  }

  async update(
    email: string,
    input: UpdateUsuarioRequest,
    audit: AuditContext,
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const target = await this.repository.findByEmail(normalizedEmail);
    if (!target) {
      throw notFound('Usuario no encontrado.');
    }

    if (target.protegido) {
      throw forbidden('No se puede modificar un usuario protegido.');
    }

    if (target.email.toLowerCase() === audit.actorEmail.toLowerCase()) {
      throw forbidden('No puede modificar su propio usuario.');
    }

    const role = await this.roles.findByNombre(input.rol);
    if (!role) {
      throw badRequest('El rol especificado no existe.');
    }

    await this.repository.updateByEmail(target.email, {
      rolid: role.id,
      ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
    });

    await this.bitacora.registrar({
      accion: 'usuarios.editar',
      elementoid: target.email,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });
  }

  async delete(email: string, audit: AuditContext): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const target = await this.repository.findByEmail(normalizedEmail);
    if (!target) {
      throw notFound('Usuario no encontrado.');
    }

    if (target.protegido) {
      throw forbidden('No se puede eliminar un usuario protegido.');
    }

    if (target.email.toLowerCase() === audit.actorEmail.toLowerCase()) {
      throw forbidden('No puede eliminar su propio usuario.');
    }

    await this.repository.deleteByEmail(target.email);

    await this.bitacora.registrar({
      accion: 'usuarios.eliminar',
      elementoid: target.email,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });
  }
}

export function createUsuariosService(deps?: UsuariosServiceDeps): IUsuariosService {
  return new UsuariosService(deps);
}

export const usuariosService: IUsuariosService = new UsuariosService();
