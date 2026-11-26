import { desc } from 'drizzle-orm';
import { db, type DbClient } from '../db';
import { bitacora } from '../db/schema';
import type { BitacoraDto } from '../schemas/bitacora.schema';

const MAX_BITACORA_FIELD_LENGTH = 255;

export interface CreateBitacoraInput {
  accion: string;
  elementoid?: string | number | null;
  ip: string;
  usuario: string;
}

export interface IBitacoraService {
  registrar(input: CreateBitacoraInput): Promise<void>;
  getAll(): Promise<BitacoraDto[]>;
}

export function sanitizeBitacoraField(value: string): string {
  return value.replace(/[\r\n\t]/g, '').slice(0, MAX_BITACORA_FIELD_LENGTH);
}

export class BitacoraService implements IBitacoraService {
  constructor(private readonly database: DbClient = db) {}

  async registrar(input: CreateBitacoraInput): Promise<void> {
    const elementoid =
      input.elementoid === undefined || input.elementoid === null
        ? null
        : sanitizeBitacoraField(String(input.elementoid));

    await this.database.insert(bitacora).values({
      accion: sanitizeBitacoraField(input.accion),
      elementoid,
      ip: sanitizeBitacoraField(input.ip),
      usuario: sanitizeBitacoraField(input.usuario),
      fecha: new Date(),
    });
  }

  async getAll(): Promise<BitacoraDto[]> {
    const rows = await this.database
      .select({
        bitacoraId: bitacora.id,
        accion: bitacora.accion,
        elementoid: bitacora.elementoid,
        ip: bitacora.ip,
        usuario: bitacora.usuario,
        fecha: bitacora.fecha,
      })
      .from(bitacora)
      .orderBy(desc(bitacora.id));

    return rows.map((row) => ({
      bitacoraId: row.bitacoraId,
      accion: row.accion,
      elementoid: row.elementoid,
      ip: row.ip,
      usuario: row.usuario,
      fecha: row.fecha instanceof Date ? row.fecha.toISOString() : new Date(row.fecha).toISOString(),
    }));
  }
}

export function createBitacoraService(database: DbClient = db): IBitacoraService {
  return new BitacoraService(database);
}

export const bitacoraService: IBitacoraService = new BitacoraService();
