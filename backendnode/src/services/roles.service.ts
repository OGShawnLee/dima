import { asc, eq } from 'drizzle-orm';
import { db, type DbClient } from '../db';
import { rol } from '../db/schema';
import { RoleNameSchema, type RoleName } from '../schemas/common.schema';
import type { RolDto } from '../schemas/roles.schema';

export interface IRolesService {
  getAll(): Promise<RolDto[]>;
  findByNombre(nombre: RoleName): Promise<RolDto | null>;
}

export class RolesService implements IRolesService {
  constructor(private readonly database: DbClient = db) {}

  async getAll(): Promise<RolDto[]> {
    const rows = await this.database
      .select({
        id: rol.id,
        nombre: rol.nombre,
      })
      .from(rol)
      .orderBy(asc(rol.nombre));

    return rows.map((row) => ({
      id: row.id,
      nombre: RoleNameSchema.parse(row.nombre),
    }));
  }

  async findByNombre(nombre: RoleName): Promise<RolDto | null> {
    const rows = await this.database
      .select({
        id: rol.id,
        nombre: rol.nombre,
      })
      .from(rol)
      .where(eq(rol.nombre, nombre))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    const parsedRole = RoleNameSchema.safeParse(row.nombre);
    if (!parsedRole.success) {
      return null;
    }

    return {
      id: row.id,
      nombre: parsedRole.data,
    };
  }
}

export function createRolesService(database: DbClient = db): IRolesService {
  return new RolesService(database);
}

export const rolesService: IRolesService = new RolesService();
