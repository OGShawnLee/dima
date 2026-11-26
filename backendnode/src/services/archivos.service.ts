import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { asc, eq } from 'drizzle-orm';
import { env } from '../config/env';
import { db, type DbClient } from '../db';
import { archivo } from '../db/schema';
import { isValidJpegMagicBytes } from '../middlewares/upload.middleware';
import type { ArchivoMetadataDto } from '../schemas/archivos.schema';
import type { AuditContext } from '../schemas/common.schema';
import { bitacoraService, type IBitacoraService } from './bitacora.service';
import { badRequest, notFound } from '../utils/httpError';

export interface UploadedImageInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface ArchivoBinaryResult {
  mime: 'image/jpeg';
  buffer: Buffer;
}

export interface ArchivoBinaryRecord {
  id: number;
  mime: string;
  nombre: string;
  indb: boolean;
  datos: Buffer | null;
}

export interface ArchivoWriteRecord {
  mime: 'image/jpeg';
  nombre: string;
  size: number;
  indb: boolean;
  datos: Buffer | null;
}

export interface IArchivosRepository {
  findAllMetadata(): Promise<ArchivoMetadataDto[]>;
  findMetadataById(id: number): Promise<ArchivoMetadataDto | null>;
  findBinaryById(id: number): Promise<ArchivoBinaryRecord | null>;
  insert(data: ArchivoWriteRecord): Promise<number>;
  updateById(id: number, data: ArchivoWriteRecord): Promise<void>;
  deleteById(id: number): Promise<void>;
}

export interface IArchivosService {
  getAll(): Promise<ArchivoMetadataDto[]>;
  getDetalle(id: number): Promise<ArchivoMetadataDto | null>;
  getBinary(id: number): Promise<ArchivoBinaryResult | null>;
  create(file: UploadedImageInput, audit: AuditContext): Promise<ArchivoMetadataDto>;
  update(id: number, file: UploadedImageInput, audit: AuditContext): Promise<void>;
  delete(id: number, audit: AuditContext): Promise<void>;
}

export interface ArchivosServiceOptions {
  repository?: IArchivosRepository;
  database?: DbClient;
  bitacora?: IBitacoraService;
  uploadsDir?: string;
  filesInDb?: boolean | (() => boolean);
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}

async function unlinkIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (!isEnoent(err)) {
      throw err;
    }
  }
}

async function unlinkQuietly(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Best-effort cleanup after a failed database mutation.
  }
}

export function resolveSafeUploadPath(uploadsDir: string, filename: string): string {
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw badRequest('Nombre de archivo inválido.');
  }

  const baseDir = path.resolve(uploadsDir);
  const resolvedPath = path.resolve(baseDir, filename);
  if (!resolvedPath.startsWith(`${baseDir}${path.sep}`)) {
    throw badRequest('Ruta de archivo inválida.');
  }

  return resolvedPath;
}

export class DrizzleArchivosRepository implements IArchivosRepository {
  constructor(private readonly database: DbClient = db) {}

  async findAllMetadata(): Promise<ArchivoMetadataDto[]> {
    const rows = await this.database
      .select({
        archivoId: archivo.id,
        mime: archivo.mime,
        indb: archivo.indb,
        nombre: archivo.nombre,
        size: archivo.size,
      })
      .from(archivo)
      .orderBy(asc(archivo.id));

    return rows.map((row) => ({
      archivoId: row.archivoId,
      mime: 'image/jpeg',
      indb: Boolean(row.indb),
      nombre: row.nombre,
      size: row.size,
    }));
  }

  async findMetadataById(id: number): Promise<ArchivoMetadataDto | null> {
    const rows = await this.database
      .select({
        archivoId: archivo.id,
        mime: archivo.mime,
        indb: archivo.indb,
        nombre: archivo.nombre,
        size: archivo.size,
      })
      .from(archivo)
      .where(eq(archivo.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      archivoId: row.archivoId,
      mime: 'image/jpeg',
      indb: Boolean(row.indb),
      nombre: row.nombre,
      size: row.size,
    };
  }

  async findBinaryById(id: number): Promise<ArchivoBinaryRecord | null> {
    const rows = await this.database
      .select({
        id: archivo.id,
        mime: archivo.mime,
        nombre: archivo.nombre,
        indb: archivo.indb,
        datos: archivo.datos,
      })
      .from(archivo)
      .where(eq(archivo.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      mime: row.mime,
      nombre: row.nombre,
      indb: Boolean(row.indb),
      datos: row.datos ?? null,
    };
  }

  async insert(data: ArchivoWriteRecord): Promise<number> {
    const [result] = await this.database.insert(archivo).values({
      mime: data.mime,
      nombre: data.nombre,
      size: data.size,
      indb: data.indb,
      datos: data.datos,
    });
    return Number(result.insertId);
  }

  async updateById(id: number, data: ArchivoWriteRecord): Promise<void> {
    await this.database
      .update(archivo)
      .set({
        mime: data.mime,
        nombre: data.nombre,
        size: data.size,
        indb: data.indb,
        datos: data.datos,
      })
      .where(eq(archivo.id, id));
  }

  async deleteById(id: number): Promise<void> {
    await this.database.delete(archivo).where(eq(archivo.id, id));
  }
}

export class ArchivosService implements IArchivosService {
  private readonly repository: IArchivosRepository;
  private readonly bitacora: IBitacoraService;
  private readonly uploadsDir: string;
  private readonly getFilesInDb: () => boolean;

  constructor(options?: ArchivosServiceOptions) {
    this.repository = options?.repository ?? new DrizzleArchivosRepository(options?.database);
    this.bitacora = options?.bitacora ?? bitacoraService;
    this.uploadsDir = path.resolve(options?.uploadsDir ?? path.resolve(process.cwd(), 'uploads'));
    const filesInDbOption = options?.filesInDb;
    if (typeof filesInDbOption === 'function') {
      this.getFilesInDb = filesInDbOption;
    } else if (typeof filesInDbOption === 'boolean') {
      this.getFilesInDb = () => filesInDbOption;
    } else {
      this.getFilesInDb = () => env.FILES_IN_BD;
    }
  }

  async getAll(): Promise<ArchivoMetadataDto[]> {
    return this.repository.findAllMetadata();
  }

  async getDetalle(id: number): Promise<ArchivoMetadataDto | null> {
    return this.repository.findMetadataById(id);
  }

  async getBinary(id: number): Promise<ArchivoBinaryResult | null> {
    const record = await this.repository.findBinaryById(id);
    if (!record) {
      return null;
    }

    if (record.indb) {
      if (!record.datos) {
        return null;
      }
      return {
        mime: 'image/jpeg',
        buffer: record.datos,
      };
    }

    const filePath = resolveSafeUploadPath(this.uploadsDir, record.nombre);
    try {
      const buffer = await fs.readFile(filePath);
      return {
        mime: 'image/jpeg',
        buffer,
      };
    } catch (err) {
      if (isEnoent(err)) {
        return null;
      }
      throw err;
    }
  }

  async create(file: UploadedImageInput, audit: AuditContext): Promise<ArchivoMetadataDto> {
    if (!isValidJpegMagicBytes(file.buffer)) {
      throw badRequest('Solo se permiten imágenes con extensión JPG.');
    }

    const nombre = `${crypto.randomUUID()}.jpg`;
    const indb = this.getFilesInDb();
    const size = file.buffer.length;
    let archivoId: number;

    if (indb) {
      archivoId = await this.repository.insert({
        mime: 'image/jpeg',
        nombre,
        size,
        indb: true,
        datos: file.buffer,
      });
    } else {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      const filePath = resolveSafeUploadPath(this.uploadsDir, nombre);
      await fs.writeFile(filePath, file.buffer);
      try {
        archivoId = await this.repository.insert({
          mime: 'image/jpeg',
          nombre,
          size,
          indb: false,
          datos: null,
        });
      } catch (err) {
        await unlinkQuietly(filePath);
        throw err;
      }
    }

    await this.bitacora.registrar({
      accion: 'archivos.crear',
      elementoid: archivoId,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });

    return {
      archivoId,
      mime: 'image/jpeg',
      indb,
      nombre,
      size,
    };
  }

  async update(id: number, file: UploadedImageInput, audit: AuditContext): Promise<void> {
    const existing = await this.repository.findMetadataById(id);
    if (!existing) {
      throw notFound('Archivo no encontrado.');
    }

    if (!isValidJpegMagicBytes(file.buffer)) {
      throw badRequest('Solo se permiten imágenes con extensión JPG.');
    }

    const nombre = `${crypto.randomUUID()}.jpg`;
    const indb = this.getFilesInDb();
    const size = file.buffer.length;

    if (indb) {
      await this.repository.updateById(id, {
        mime: 'image/jpeg',
        nombre,
        size,
        indb: true,
        datos: file.buffer,
      });
    } else {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      const newFilePath = resolveSafeUploadPath(this.uploadsDir, nombre);
      await fs.writeFile(newFilePath, file.buffer);
      try {
        await this.repository.updateById(id, {
          mime: 'image/jpeg',
          nombre,
          size,
          indb: false,
          datos: null,
        });
      } catch (err) {
        await unlinkQuietly(newFilePath);
        throw err;
      }
    }

    await this.bitacora.registrar({
      accion: 'archivos.editar',
      elementoid: id,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });

    if (!existing.indb) {
      const oldFilePath = resolveSafeUploadPath(this.uploadsDir, existing.nombre);
      await unlinkIfExists(oldFilePath);
    }
  }

  async delete(id: number, audit: AuditContext): Promise<void> {
    const existing = await this.repository.findMetadataById(id);
    if (!existing) {
      throw notFound('Archivo no encontrado.');
    }

    await this.repository.deleteById(id);

    await this.bitacora.registrar({
      accion: 'archivos.eliminar',
      elementoid: id,
      ip: audit.ip,
      usuario: audit.actorEmail,
    });

    if (!existing.indb) {
      const oldFilePath = resolveSafeUploadPath(this.uploadsDir, existing.nombre);
      await unlinkIfExists(oldFilePath);
    }
  }
}

export function createArchivosService(options?: ArchivosServiceOptions): IArchivosService {
  return new ArchivosService(options);
}

export const archivosService: IArchivosService = new ArchivosService();
