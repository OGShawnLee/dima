import { eq } from 'drizzle-orm';
import { db, type DbClient } from '../db';
import { categoria } from '../db/schema';
import type {
  CategoriaDto,
  CreateCategoriaRequest,
  UpdateCategoriaRequest,
} from '../schemas/categorias.schema';
import type { AuditContext } from '../schemas/common.schema';
import { badRequest, notFound } from '../utils/httpError';
import { bitacoraService, type IBitacoraService } from './bitacora.service';

export interface ICategoriasService {
  getAll(): Promise<CategoriaDto[]>;
  getById(id: number): Promise<CategoriaDto | null>;
  create(input: CreateCategoriaRequest, audit: AuditContext): Promise<CategoriaDto>;
  update(id: number, input: UpdateCategoriaRequest, audit: AuditContext): Promise<void>;
  delete(id: number, audit: AuditContext): Promise<void>;
}

export class CategoriasService implements ICategoriasService {
  constructor(
    private readonly database: DbClient = db,
    private readonly bitacora: IBitacoraService = bitacoraService,
  ) {}

  async getAll(): Promise<CategoriaDto[]> {
    return this.database
      .select({
        categoriaId: categoria.id,
        nombre: categoria.nombre,
        protegida: categoria.protegida,
      })
      .from(categoria);
  }

  async getById(id: number): Promise<CategoriaDto | null> {
    const rows = await this.database
      .select({
        categoriaId: categoria.id,
        nombre: categoria.nombre,
        protegida: categoria.protegida,
      })
      .from(categoria)
      .where(eq(categoria.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async create(input: CreateCategoriaRequest, audit: AuditContext): Promise<CategoriaDto> {
    const [result] = await this.database.insert(categoria).values({
      nombre: input.nombre,
      protegida: false,
    });

    const id = Number(result.insertId);

    await this.bitacora.registrar({
      accion: 'categoria.crear',
      elementoid: id,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });

    return {
      categoriaId: id,
      nombre: input.nombre,
      protegida: false,
    };
  }

  async update(id: number, input: UpdateCategoriaRequest, audit: AuditContext): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw notFound('Categoría no encontrada');
    }

    await this.database
      .update(categoria)
      .set({ nombre: input.nombre })
      .where(eq(categoria.id, id));

    await this.bitacora.registrar({
      accion: 'categoria.editar',
      elementoid: id,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });
  }

  async delete(id: number, audit: AuditContext): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw notFound('Categoría no encontrada');
    }

    if (existing.protegida === true) {
      throw badRequest('No se puede eliminar una categoría protegida.');
    }

    await this.database.delete(categoria).where(eq(categoria.id, id));

    await this.bitacora.registrar({
      accion: 'categoria.eliminar',
      elementoid: id,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });
  }
}

export function createCategoriasService(
  database: DbClient = db,
  bitacora: IBitacoraService = bitacoraService,
): ICategoriasService {
  return new CategoriasService(database, bitacora);
}

export const categoriasService: ICategoriasService = new CategoriasService();
