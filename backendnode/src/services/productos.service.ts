import { and, eq, inArray, like } from 'drizzle-orm';
import { db, type DbClient } from '../db';
import { archivo, categoria, categoriaproducto, producto } from '../db/schema';
import type { CategoriaDto } from '../schemas/categorias.schema';
import type { AuditContext } from '../schemas/common.schema';
import type {
  CreateProductoRequest,
  ProductoDto,
  UpdateProductoRequest,
} from '../schemas/productos.schema';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { bitacoraService, type IBitacoraService } from './bitacora.service';

export interface IProductosService {
  getAll(search?: string): Promise<ProductoDto[]>;
  getById(id: number): Promise<ProductoDto | null>;
  create(input: CreateProductoRequest, audit: AuditContext): Promise<ProductoDto>;
  update(id: number, input: UpdateProductoRequest, audit: AuditContext): Promise<void>;
  delete(id: number, audit: AuditContext): Promise<void>;
  assignCategoria(productoId: number, categoriaId: number, audit: AuditContext): Promise<void>;
  removeCategoria(productoId: number, categoriaId: number, audit: AuditContext): Promise<void>;
}

/**
 * Escapes SQL LIKE wildcards (`\`, `%`, `_`) so user-supplied search strings
 * are treated as literal substrings inside parameterized Drizzle queries.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const record = err as { code?: unknown; errno?: unknown; cause?: unknown };
  if (record.code === 'ER_DUP_ENTRY' || record.errno === 1062) {
    return true;
  }
  if (typeof record.cause === 'object' && record.cause !== null) {
    const cause = record.cause as { code?: unknown; errno?: unknown };
    return cause.code === 'ER_DUP_ENTRY' || cause.errno === 1062;
  }
  return false;
}

export class ProductosService implements IProductosService {
  constructor(
    private readonly database: DbClient = db,
    private readonly bitacora: IBitacoraService = bitacoraService,
  ) {}

  private async ensureArchivoExists(archivoId: number): Promise<void> {
    const rows = await this.database
      .select({ id: archivo.id })
      .from(archivo)
      .where(eq(archivo.id, archivoId))
      .limit(1);

    if (rows.length === 0) {
      throw badRequest('El archivo especificado no existe.');
    }
  }

  private async ensureProductoExists(productoId: number): Promise<void> {
    const rows = await this.database
      .select({ id: producto.id })
      .from(producto)
      .where(eq(producto.id, productoId))
      .limit(1);

    if (rows.length === 0) {
      throw notFound('Producto no encontrado');
    }
  }

  private async ensureCategoriaExists(categoriaId: number): Promise<void> {
    const rows = await this.database
      .select({ id: categoria.id })
      .from(categoria)
      .where(eq(categoria.id, categoriaId))
      .limit(1);

    if (rows.length === 0) {
      throw notFound('Categoría no encontrada');
    }
  }

  async getAll(search?: string): Promise<ProductoDto[]> {
    const trimmed = search?.trim();
    const baseQuery = this.database
      .select({
        id: producto.id,
        titulo: producto.titulo,
        descripcion: producto.descripcion,
        precio: producto.precio,
        archivoid: producto.archivoid,
      })
      .from(producto);

    const productRows =
      trimmed && trimmed.length > 0
        ? await baseQuery.where(like(producto.titulo, `%${escapeLikePattern(trimmed)}%`))
        : await baseQuery;

    if (productRows.length === 0) {
      return [];
    }

    const productIds = productRows.map((row) => row.id);
    const categoryLinks = await this.database
      .select({
        productoid: categoriaproducto.productoid,
        categoriaId: categoria.id,
        nombre: categoria.nombre,
        protegida: categoria.protegida,
      })
      .from(categoriaproducto)
      .innerJoin(categoria, eq(categoriaproducto.categoriaid, categoria.id))
      .where(inArray(categoriaproducto.productoid, productIds));

    const categoriesByProduct = new Map<number, CategoriaDto[]>();
    for (const link of categoryLinks) {
      const list = categoriesByProduct.get(link.productoid) ?? [];
      list.push({
        categoriaId: link.categoriaId,
        nombre: link.nombre,
        protegida: link.protegida,
      });
      categoriesByProduct.set(link.productoid, list);
    }

    return productRows.map((row) => ({
      productoId: row.id,
      titulo: row.titulo,
      descripcion: row.descripcion,
      precio: Number(row.precio),
      archivoid: row.archivoid ?? null,
      categorias: categoriesByProduct.get(row.id) ?? [],
    }));
  }

  async getById(id: number): Promise<ProductoDto | null> {
    const rows = await this.database
      .select({
        id: producto.id,
        titulo: producto.titulo,
        descripcion: producto.descripcion,
        precio: producto.precio,
        archivoid: producto.archivoid,
      })
      .from(producto)
      .where(eq(producto.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    const categories = await this.database
      .select({
        categoriaId: categoria.id,
        nombre: categoria.nombre,
        protegida: categoria.protegida,
      })
      .from(categoriaproducto)
      .innerJoin(categoria, eq(categoriaproducto.categoriaid, categoria.id))
      .where(eq(categoriaproducto.productoid, id));

    return {
      productoId: row.id,
      titulo: row.titulo,
      descripcion: row.descripcion,
      precio: Number(row.precio),
      archivoid: row.archivoid ?? null,
      categorias: categories,
    };
  }

  async create(input: CreateProductoRequest, audit: AuditContext): Promise<ProductoDto> {
    if (input.archivoid !== undefined && input.archivoid !== null) {
      await this.ensureArchivoExists(input.archivoid);
    }

    const formattedPrecio = input.precio.toFixed(2);
    const archivoid = input.archivoid ?? null;

    const [result] = await this.database.insert(producto).values({
      titulo: input.titulo,
      descripcion: input.descripcion,
      precio: formattedPrecio,
      archivoid,
    });

    const id = Number(result.insertId);

    await this.bitacora.registrar({
      accion: 'producto.crear',
      elementoid: id,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });

    return {
      productoId: id,
      titulo: input.titulo,
      descripcion: input.descripcion,
      precio: Number(formattedPrecio),
      archivoid,
      categorias: [],
    };
  }

  async update(id: number, input: UpdateProductoRequest, audit: AuditContext): Promise<void> {
    await this.ensureProductoExists(id);

    if (input.archivoid !== undefined && input.archivoid !== null) {
      await this.ensureArchivoExists(input.archivoid);
    }

    await this.database
      .update(producto)
      .set({
        titulo: input.titulo,
        descripcion: input.descripcion,
        precio: input.precio.toFixed(2),
        archivoid: input.archivoid ?? null,
      })
      .where(eq(producto.id, id));

    await this.bitacora.registrar({
      accion: 'producto.editar',
      elementoid: id,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });
  }

  async delete(id: number, audit: AuditContext): Promise<void> {
    await this.ensureProductoExists(id);

    await this.database.delete(producto).where(eq(producto.id, id));

    await this.bitacora.registrar({
      accion: 'producto.eliminar',
      elementoid: id,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });
  }

  async assignCategoria(productoId: number, categoriaId: number, audit: AuditContext): Promise<void> {
    await this.ensureProductoExists(productoId);
    await this.ensureCategoriaExists(categoriaId);

    const existingLinks = await this.database
      .select({ categoriaid: categoriaproducto.categoriaid })
      .from(categoriaproducto)
      .where(
        and(
          eq(categoriaproducto.productoid, productoId),
          eq(categoriaproducto.categoriaid, categoriaId),
        ),
      )
      .limit(1);

    if (existingLinks.length > 0) {
      throw conflict('La categoría ya está asignada al producto.');
    }

    try {
      await this.database.insert(categoriaproducto).values({
        productoid: productoId,
        categoriaid: categoriaId,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw conflict('La categoría ya está asignada al producto.');
      }
      throw err;
    }

    await this.bitacora.registrar({
      accion: 'productocategoria.agregar',
      elementoid: `${productoId}:${categoriaId}`,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });
  }

  async removeCategoria(productoId: number, categoriaId: number, audit: AuditContext): Promise<void> {
    await this.ensureProductoExists(productoId);
    await this.ensureCategoriaExists(categoriaId);

    const [result] = await this.database
      .delete(categoriaproducto)
      .where(
        and(
          eq(categoriaproducto.productoid, productoId),
          eq(categoriaproducto.categoriaid, categoriaId),
        ),
      );

    if (result.affectedRows === 0) {
      throw notFound('La categoría no está asignada al producto.');
    }

    await this.bitacora.registrar({
      accion: 'productocategoria.remover',
      elementoid: `${productoId}:${categoriaId}`,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });
  }
}

export function createProductosService(
  database: DbClient = db,
  bitacora: IBitacoraService = bitacoraService,
): IProductosService {
  return new ProductosService(database, bitacora);
}

export const productosService: IProductosService = new ProductosService();
