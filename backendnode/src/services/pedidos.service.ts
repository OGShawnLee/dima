import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db, type DbClient } from '../db';
import { pedido, pedidodetalle, producto, usuario } from '../db/schema';
import type { AuditContext, RoleName } from '../schemas/common.schema';
import type {
  CreatePedidoRequest,
  PedidoAdminSummaryDto,
  PedidoCreatedDto,
  PedidoDetailDto,
  PedidoEstado,
  PedidoSummaryDto,
} from '../schemas/pedidos.schema';
import { badRequest, unauthorized } from '../utils/httpError';
import { bitacoraService, type IBitacoraService } from './bitacora.service';

export interface PedidoActor {
  email: string;
  rol: RoleName;
}

export interface IPedidosService {
  create(input: CreatePedidoRequest, actorEmail: string, audit: AuditContext): Promise<PedidoCreatedDto>;
  getMine(actorEmail: string): Promise<PedidoSummaryDto[]>;
  getAll(): Promise<PedidoAdminSummaryDto[]>;
  getById(id: number, actor: PedidoActor): Promise<PedidoDetailDto | null>;
}

export interface OrderLineInsert {
  productoId: number;
  titulo: string;
  precioUnitario: string;
  cantidad: number;
}

export interface CreateOrderTransactionInput {
  usuarioId: string;
  total: string;
  estado: PedidoEstado;
  lines: OrderLineInsert[];
}

export interface IPedidosRepository {
  findUserByEmail(email: string): Promise<{ id: string; email: string; nombre: string } | null>;
  findProductsByIds(ids: number[]): Promise<Array<{ id: number; titulo: string; precio: string }>>;
  createOrderWithLines(input: CreateOrderTransactionInput): Promise<{ pedidoId: number; fecha: Date }>;
  findByUserEmail(email: string): Promise<PedidoSummaryDto[]>;
  findAllWithUsers(): Promise<PedidoAdminSummaryDto[]>;
  findDetailById(id: number): Promise<PedidoDetailDto | null>;
}

function normalizeEstado(raw: string): PedidoEstado {
  if (raw === 'confirmado' || raw === 'cancelado') {
    return raw;
  }
  return 'pendiente';
}

export class DrizzlePedidosRepository implements IPedidosRepository {
  constructor(private readonly database: DbClient = db) {}

  async findUserByEmail(
    email: string,
  ): Promise<{ id: string; email: string; nombre: string } | null> {
    const rows = await this.database
      .select({
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
      })
      .from(usuario)
      .where(eq(usuario.email, email))
      .limit(1);

    return rows[0] ?? null;
  }

  async findProductsByIds(
    ids: number[],
  ): Promise<Array<{ id: number; titulo: string; precio: string }>> {
    if (ids.length === 0) {
      return [];
    }

    return this.database
      .select({
        id: producto.id,
        titulo: producto.titulo,
        precio: producto.precio,
      })
      .from(producto)
      .where(inArray(producto.id, ids));
  }

  async createOrderWithLines(
    input: CreateOrderTransactionInput,
  ): Promise<{ pedidoId: number; fecha: Date }> {
    return this.database.transaction(async (tx) => {
      const [orderResult] = await tx.insert(pedido).values({
        usuarioid: input.usuarioId,
        total: input.total,
        estado: input.estado,
      });

      const pedidoId = Number(orderResult.insertId);

      await tx.insert(pedidodetalle).values(
        input.lines.map((line) => ({
          pedidoid: pedidoId,
          productoid: line.productoId,
          titulo: line.titulo,
          preciounitario: line.precioUnitario,
          cantidad: line.cantidad,
        })),
      );

      const createdRows = await tx
        .select({ fecha: pedido.fecha })
        .from(pedido)
        .where(eq(pedido.id, pedidoId))
        .limit(1);

      return {
        pedidoId,
        fecha: createdRows[0]?.fecha ?? new Date(),
      };
    });
  }

  private async getItemCountsByPedidoIds(pedidoIds: number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    if (pedidoIds.length === 0) {
      return counts;
    }

    const lineRows = await this.database
      .select({
        pedidoid: pedidodetalle.pedidoid,
        cantidad: pedidodetalle.cantidad,
      })
      .from(pedidodetalle)
      .where(inArray(pedidodetalle.pedidoid, pedidoIds));

    // itemCount is consistently the sum of line quantities per order.
    for (const row of lineRows) {
      counts.set(row.pedidoid, (counts.get(row.pedidoid) ?? 0) + row.cantidad);
    }

    return counts;
  }

  async findByUserEmail(email: string): Promise<PedidoSummaryDto[]> {
    const orderRows = await this.database
      .select({
        id: pedido.id,
        total: pedido.total,
        fecha: pedido.fecha,
        estado: pedido.estado,
      })
      .from(pedido)
      .innerJoin(usuario, eq(pedido.usuarioid, usuario.id))
      .where(eq(usuario.email, email))
      .orderBy(desc(pedido.id));

    const itemCounts = await this.getItemCountsByPedidoIds(orderRows.map((row) => row.id));

    return orderRows.map((row) => ({
      pedidoId: row.id,
      total: Number(row.total),
      fecha: row.fecha.toISOString(),
      estado: normalizeEstado(row.estado),
      itemCount: itemCounts.get(row.id) ?? 0,
    }));
  }

  async findAllWithUsers(): Promise<PedidoAdminSummaryDto[]> {
    const orderRows = await this.database
      .select({
        id: pedido.id,
        total: pedido.total,
        fecha: pedido.fecha,
        estado: pedido.estado,
        usuarioEmail: usuario.email,
        usuarioNombre: usuario.nombre,
      })
      .from(pedido)
      .innerJoin(usuario, eq(pedido.usuarioid, usuario.id))
      .orderBy(desc(pedido.id));

    const itemCounts = await this.getItemCountsByPedidoIds(orderRows.map((row) => row.id));

    return orderRows.map((row) => ({
      pedidoId: row.id,
      total: Number(row.total),
      fecha: row.fecha.toISOString(),
      estado: normalizeEstado(row.estado),
      itemCount: itemCounts.get(row.id) ?? 0,
      usuarioEmail: row.usuarioEmail,
      usuarioNombre: row.usuarioNombre,
    }));
  }

  async findDetailById(id: number): Promise<PedidoDetailDto | null> {
    const orderRows = await this.database
      .select({
        id: pedido.id,
        total: pedido.total,
        fecha: pedido.fecha,
        estado: pedido.estado,
        usuarioEmail: usuario.email,
        usuarioNombre: usuario.nombre,
      })
      .from(pedido)
      .innerJoin(usuario, eq(pedido.usuarioid, usuario.id))
      .where(eq(pedido.id, id))
      .limit(1);

    const order = orderRows[0];
    if (!order) {
      return null;
    }

    const lineRows = await this.database
      .select({
        productoid: pedidodetalle.productoid,
        titulo: pedidodetalle.titulo,
        preciounitario: pedidodetalle.preciounitario,
        cantidad: pedidodetalle.cantidad,
      })
      .from(pedidodetalle)
      .where(eq(pedidodetalle.pedidoid, id))
      .orderBy(asc(pedidodetalle.id));

    return {
      pedidoId: order.id,
      usuarioEmail: order.usuarioEmail,
      usuarioNombre: order.usuarioNombre,
      total: Number(order.total),
      fecha: order.fecha.toISOString(),
      estado: normalizeEstado(order.estado),
      items: lineRows.map((line) => ({
        productoId: line.productoid ?? null,
        titulo: line.titulo,
        precioUnitario: Number(line.preciounitario),
        cantidad: line.cantidad,
      })),
    };
  }
}

export class PedidosService implements IPedidosService {
  constructor(
    private readonly repository: IPedidosRepository = new DrizzlePedidosRepository(),
    private readonly bitacora: IBitacoraService = bitacoraService,
  ) {}

  async create(
    input: CreatePedidoRequest,
    actorEmail: string,
    audit: AuditContext,
  ): Promise<PedidoCreatedDto> {
    const actor = await this.repository.findUserByEmail(actorEmail);
    if (!actor) {
      throw unauthorized('Usuario no autenticado.');
    }

    const mergedQuantities = new Map<number, number>();
    for (const item of input.items) {
      const mergedCantidad = (mergedQuantities.get(item.productoId) ?? 0) + item.cantidad;
      if (mergedCantidad > 99) {
        throw badRequest('La cantidad total por producto no puede exceder 99.');
      }
      mergedQuantities.set(item.productoId, mergedCantidad);
    }

    const requestedIds = Array.from(mergedQuantities.keys());
    const products = await this.repository.findProductsByIds(requestedIds);
    const productsById = new Map(products.map((prod) => [prod.id, prod]));

    for (const productId of requestedIds) {
      if (!productsById.has(productId)) {
        throw badRequest('Uno o más productos no existen.');
      }
    }

    let totalCents = 0;
    const lines: OrderLineInsert[] = [];

    for (const [productId, cantidad] of mergedQuantities.entries()) {
      const prod = productsById.get(productId);
      if (!prod) {
        throw badRequest('Uno o más productos no existen.');
      }

      // Compute all line totals and order total in integer cents to prevent floating-point drift.
      const unitCents = Math.round(Number(prod.precio) * 100);
      totalCents += unitCents * cantidad;
      lines.push({
        productoId: prod.id,
        titulo: prod.titulo,
        precioUnitario: (unitCents / 100).toFixed(2),
        cantidad,
      });
    }

    const formattedTotal = (totalCents / 100).toFixed(2);
    const created = await this.repository.createOrderWithLines({
      usuarioId: actor.id,
      total: formattedTotal,
      estado: 'pendiente',
      lines,
    });

    await this.bitacora.registrar({
      accion: 'pedido.crear',
      elementoid: created.pedidoId,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });

    return {
      pedidoId: created.pedidoId,
      total: Number(formattedTotal),
      fecha: created.fecha.toISOString(),
      estado: 'pendiente',
    };
  }

  async getMine(actorEmail: string): Promise<PedidoSummaryDto[]> {
    return this.repository.findByUserEmail(actorEmail);
  }

  async getAll(): Promise<PedidoAdminSummaryDto[]> {
    return this.repository.findAllWithUsers();
  }

  async getById(id: number, actor: PedidoActor): Promise<PedidoDetailDto | null> {
    const order = await this.repository.findDetailById(id);
    if (!order) {
      return null;
    }

    if (
      actor.rol === 'Usuario' &&
      order.usuarioEmail.toLowerCase() !== actor.email.toLowerCase()
    ) {
      // Return null so controller responds 404 (anti-IDOR: never leak order existence via 403).
      return null;
    }

    return order;
  }
}

export function createPedidosService(
  database: DbClient = db,
  bitacora: IBitacoraService = bitacoraService,
): IPedidosService {
  return new PedidosService(new DrizzlePedidosRepository(database), bitacora);
}

export const pedidosService: IPedidosService = new PedidosService();
