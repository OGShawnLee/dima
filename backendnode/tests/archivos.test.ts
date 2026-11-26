import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { createAuthorize } from '../src/middlewares/auth.middleware';
import {
  isAllowedJpegExtension,
  isValidJpegMagicBytes,
  MAX_IMAGE_SIZE_BYTES,
} from '../src/middlewares/upload.middleware';
import { createArchivosRouter } from '../src/routes/archivos.routes';
import { type ArchivoMetadataDto, registerArchivosPaths } from '../src/schemas/archivos.schema';
import {
  type ArchivoBinaryRecord,
  ArchivosService,
  type ArchivoWriteRecord,
  type IArchivosRepository,
  resolveSafeUploadPath,
} from '../src/services/archivos.service';
import type { IBitacoraService } from '../src/services/bitacora.service';
import { createJwtTokenService } from '../src/services/jwttoken.service';

const TEST_JWT_SECRET = 'test-secret-key-with-at-least-32-characters-1234';
const VALID_JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const UPDATED_JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66]);
const UUID_JPG_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i;

interface StoredRow {
  id: number;
  mime: 'image/jpeg';
  nombre: string;
  size: number;
  indb: boolean;
  datos: Buffer | null;
}

class InMemoryArchivosRepository implements IArchivosRepository {
  private nextId = 1;
  private readonly rows = new Map<number, StoredRow>();
  public failNextInsert = false;

  async findAllMetadata(): Promise<ArchivoMetadataDto[]> {
    return Array.from(this.rows.values()).map((row) => ({
      archivoId: row.id,
      mime: row.mime,
      indb: row.indb,
      nombre: row.nombre,
      size: row.size,
    }));
  }

  async findMetadataById(id: number): Promise<ArchivoMetadataDto | null> {
    const row = this.rows.get(id);
    if (!row) {
      return null;
    }
    return {
      archivoId: row.id,
      mime: row.mime,
      indb: row.indb,
      nombre: row.nombre,
      size: row.size,
    };
  }

  async findBinaryById(id: number): Promise<ArchivoBinaryRecord | null> {
    const row = this.rows.get(id);
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      mime: row.mime,
      nombre: row.nombre,
      indb: row.indb,
      datos: row.datos,
    };
  }

  async insert(data: ArchivoWriteRecord): Promise<number> {
    if (this.failNextInsert) {
      this.failNextInsert = false;
      throw new Error('Simulated DB insert failure');
    }
    const id = this.nextId++;
    this.rows.set(id, {
      id,
      mime: data.mime,
      nombre: data.nombre,
      size: data.size,
      indb: data.indb,
      datos: data.datos,
    });
    return id;
  }

  async updateById(id: number, data: ArchivoWriteRecord): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing) {
      return;
    }
    this.rows.set(id, {
      id,
      mime: data.mime,
      nombre: data.nombre,
      size: data.size,
      indb: data.indb,
      datos: data.datos,
    });
  }

  async deleteById(id: number): Promise<void> {
    this.rows.delete(id);
  }
}

describe('B007 Hardened Archivos Service, Upload Middleware & Routes', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  function setupTestContext(filesInDb: boolean) {
    const uploadsDir = createTempDir('dima-b007-uploads-');
    const logDir = createTempDir('dima-b007-log-');
    const repository = new InMemoryArchivosRepository();
    const registrarMock = vi.fn(async () => {});
    const bitacora: IBitacoraService = {
      registrar: registrarMock,
      getAll: vi.fn(async () => []),
    };
    const service = new ArchivosService({
      repository,
      bitacora,
      uploadsDir,
      filesInDb,
    });

    const jwtService = createJwtTokenService(TEST_JWT_SECRET);
    const auth = createAuthorize({ jwtService });
    const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');
    const userToken = jwtService.generaToken('user@dima.local', 'User', 'Usuario');

    const app = createApp({
      logFilePath: path.join(logDir, 'log.txt'),
      nodeEnv: 'test',
      registerRoutes: (expressApp) => {
        expressApp.use(
          '/api/archivos',
          createArchivosRouter({ service, authorizeMiddleware: auth }),
        );
      },
    });

    return { app, uploadsDir, repository, registrarMock, adminToken, userToken };
  }

  describe('Path traversal & upload helpers (CWE-22 / DEC-007)', () => {
    it('resolveSafeUploadPath blocks traversal attempts and accepts safe UUID names', () => {
      const baseDir = createTempDir('dima-b007-safe-');

      expect(() => resolveSafeUploadPath(baseDir, '../secret.txt')).toThrow();
      expect(() => resolveSafeUploadPath(baseDir, '..\\secret.txt')).toThrow();
      expect(() => resolveSafeUploadPath(baseDir, 'nested/file.jpg')).toThrow();
      expect(() => resolveSafeUploadPath(baseDir, 'nested\\file.jpg')).toThrow();
      expect(() => resolveSafeUploadPath(baseDir, '')).toThrow();

      const safe = resolveSafeUploadPath(baseDir, '123e4567-e89b-12d3-a456-426614174000.jpg');
      expect(safe.startsWith(`${path.resolve(baseDir)}${path.sep}`)).toBe(true);
    });

    it('validates JPEG magic bytes and case-insensitive extensions', () => {
      expect(isValidJpegMagicBytes(VALID_JPEG_BUFFER)).toBe(true);
      expect(isValidJpegMagicBytes(Buffer.from('<html><script>alert(1)</script></html>'))).toBe(
        false,
      );
      expect(isValidJpegMagicBytes(Buffer.from([0xff, 0xd8]))).toBe(false);

      expect(isAllowedJpegExtension('photo.jpg')).toBe(true);
      expect(isAllowedJpegExtension('photo.JPG')).toBe(true);
      expect(isAllowedJpegExtension('photo.jpeg')).toBe(true);
      expect(isAllowedJpegExtension('photo.JPEG')).toBe(true);
      expect(isAllowedJpegExtension('photo.png')).toBe(false);
      expect(isAllowedJpegExtension('evil.jpg.exe')).toBe(false);
    });
  });

  describe('Auth before upload & input validation (DEC-007)', () => {
    it('rejects unauthenticated (401) and Usuario (403) POST/PUT before writing any files', async () => {
      const { app, uploadsDir, userToken } = setupTestContext(false);

      const postUnauth = await request(app)
        .post('/api/archivos')
        .attach('file', VALID_JPEG_BUFFER, { filename: 'test.jpg', contentType: 'image/jpeg' });
      expect(postUnauth.status).toBe(401);

      const postUser = await request(app)
        .post('/api/archivos')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', VALID_JPEG_BUFFER, { filename: 'test.jpg', contentType: 'image/jpeg' });
      expect(postUser.status).toBe(403);

      const putUnauth = await request(app)
        .put('/api/archivos/1')
        .attach('file', VALID_JPEG_BUFFER, { filename: 'test.jpg', contentType: 'image/jpeg' });
      expect(putUnauth.status).toBe(401);

      const putUser = await request(app)
        .put('/api/archivos/1')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', VALID_JPEG_BUFFER, { filename: 'test.jpg', contentType: 'image/jpeg' });
      expect(putUser.status).toBe(403);

      expect(fs.readdirSync(uploadsDir)).toEqual([]);
    });

    it('rejects files > 100 KB with 400 and leaves zero orphan disk files', async () => {
      const { app, uploadsDir, adminToken } = setupTestContext(false);
      const oversized = Buffer.concat([
        VALID_JPEG_BUFFER,
        Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1 - VALID_JPEG_BUFFER.length, 0x00),
      ]);

      const res = await request(app)
        .post('/api/archivos')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', oversized, { filename: 'big.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(fs.readdirSync(uploadsDir)).toEqual([]);
    });

    it('rejects HTML/JS payload spoofed as evil.jpg with image/jpeg MIME (magic-byte check)', async () => {
      const { app, uploadsDir, adminToken } = setupTestContext(false);
      const spoofedPayload = Buffer.from('<script>alert("xss")</script>', 'utf8');

      const res = await request(app)
        .post('/api/archivos')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', spoofedPayload, { filename: 'evil.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.mensaje).toBe('Solo se permiten imágenes con extensión JPG.');
      expect(fs.readdirSync(uploadsDir)).toEqual([]);
    });

    it('rejects non-JPG extension or wrong MIME type with 400', async () => {
      const { app, uploadsDir, adminToken } = setupTestContext(false);

      const wrongExt = await request(app)
        .post('/api/archivos')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', VALID_JPEG_BUFFER, { filename: 'image.png', contentType: 'image/jpeg' });
      expect(wrongExt.status).toBe(400);

      const wrongMime = await request(app)
        .post('/api/archivos')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', VALID_JPEG_BUFFER, { filename: 'image.jpg', contentType: 'image/png' });
      expect(wrongMime.status).toBe(400);

      const missingFile = await request(app)
        .post('/api/archivos')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missingFile.status).toBe(400);

      expect(fs.readdirSync(uploadsDir)).toEqual([]);
    });
  });

  describe('Disk mode (FILES_IN_BD=false)', () => {
    it('supports full CRUD lifecycle with UUID filenames, nosniff binary streaming, cleanup & audit', async () => {
      const { app, uploadsDir, registrarMock, adminToken, userToken } = setupTestContext(false);

      // POST with traversal originalname -> server generates UUID.jpg
      const createRes = await request(app)
        .post('/api/archivos')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', VALID_JPEG_BUFFER, {
          filename: '../../evil.JPG',
          contentType: 'image/jpeg',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body).toEqual({
        archivoId: 1,
        mime: 'image/jpeg',
        indb: false,
        nombre: expect.stringMatching(UUID_JPG_REGEX),
        size: VALID_JPEG_BUFFER.length,
      });
      const firstFilename = createRes.body.nombre as string;
      expect(fs.existsSync(path.join(uploadsDir, firstFilename))).toBe(true);
      expect(registrarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'archivos.crear',
          elementoid: 1,
          usuario: 'admin@dima.local',
        }),
      );

      // GET / & GET /:id/detalle require Administrador
      expect((await request(app).get('/api/archivos')).status).toBe(401);
      expect(
        (await request(app).get('/api/archivos').set('Authorization', `Bearer ${userToken}`)).status,
      ).toBe(403);

      const listRes = await request(app)
        .get('/api/archivos')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body).toEqual([createRes.body]);

      const detalleRes = await request(app)
        .get('/api/archivos/1/detalle')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detalleRes.status).toBe(200);
      expect(detalleRes.body).toEqual(createRes.body);

      // GET /:id is public and sets Content-Type + X-Content-Type-Options: nosniff
      const downloadRes = await request(app).get('/api/archivos/1');
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers['content-type']).toMatch(/^image\/jpeg/);
      expect(downloadRes.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.compare(downloadRes.body as Buffer, VALID_JPEG_BUFFER)).toBe(0);

      // PUT /:id replaces file, unlinks old file, audits archivos.editar with real numeric id
      const updateRes = await request(app)
        .put('/api/archivos/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', UPDATED_JPEG_BUFFER, {
          filename: 'updated.jpeg',
          contentType: 'image/jpeg',
        });
      expect(updateRes.status).toBe(204);
      expect(fs.existsSync(path.join(uploadsDir, firstFilename))).toBe(false);
      const filesAfterUpdate = fs.readdirSync(uploadsDir);
      expect(filesAfterUpdate).toHaveLength(1);
      expect(filesAfterUpdate[0]).toMatch(UUID_JPG_REGEX);
      expect(registrarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'archivos.editar',
          elementoid: 1,
          usuario: 'admin@dima.local',
        }),
      );

      const downloadUpdatedRes = await request(app).get('/api/archivos/1');
      expect(downloadUpdatedRes.status).toBe(200);
      expect(Buffer.compare(downloadUpdatedRes.body as Buffer, UPDATED_JPEG_BUFFER)).toBe(0);

      // Missing disk file returns 404 cleanly
      fs.unlinkSync(path.join(uploadsDir, filesAfterUpdate[0]));
      const missingDiskRes = await request(app).get('/api/archivos/1');
      expect(missingDiskRes.status).toBe(404);

      // DELETE /:id cleans up and audits archivos.eliminar
      const deleteRes = await request(app)
        .delete('/api/archivos/1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteRes.status).toBe(204);
      expect(registrarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'archivos.eliminar',
          elementoid: 1,
          usuario: 'admin@dima.local',
        }),
      );
      expect(fs.readdirSync(uploadsDir)).toEqual([]);
    });

    it('cleans up written disk file when DB insert fails and returns 404 on PUT/DELETE for missing id', async () => {
      const { app, uploadsDir, repository, adminToken } = setupTestContext(false);

      repository.failNextInsert = true;
      const failedCreate = await request(app)
        .post('/api/archivos')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', VALID_JPEG_BUFFER, { filename: 'test.jpg', contentType: 'image/jpeg' });
      expect(failedCreate.status).toBe(500);
      expect(fs.readdirSync(uploadsDir)).toEqual([]);

      const missingPut = await request(app)
        .put('/api/archivos/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', VALID_JPEG_BUFFER, { filename: 'test.jpg', contentType: 'image/jpeg' });
      expect(missingPut.status).toBe(404);
      expect(fs.readdirSync(uploadsDir)).toEqual([]);

      const missingDelete = await request(app)
        .delete('/api/archivos/999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missingDelete.status).toBe(404);
    });
  });

  describe('Database LONGBLOB mode (FILES_IN_BD=true)', () => {
    it('stores buffer in DB without writing disk files and serves binary publicly', async () => {
      const { app, uploadsDir, repository, registrarMock, adminToken } = setupTestContext(true);

      const createRes = await request(app)
        .post('/api/archivos')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', VALID_JPEG_BUFFER, { filename: 'photo.jpg', contentType: 'image/jpeg' });

      expect(createRes.status).toBe(201);
      expect(createRes.body).toEqual({
        archivoId: 1,
        mime: 'image/jpeg',
        indb: true,
        nombre: expect.stringMatching(UUID_JPG_REGEX),
        size: VALID_JPEG_BUFFER.length,
      });
      expect(fs.readdirSync(uploadsDir)).toEqual([]);

      const stored = await repository.findBinaryById(1);
      expect(stored?.datos).toBeInstanceOf(Buffer);
      expect(Buffer.compare(stored?.datos ?? Buffer.alloc(0), VALID_JPEG_BUFFER)).toBe(0);

      const downloadRes = await request(app).get('/api/archivos/1');
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers['content-type']).toMatch(/^image\/jpeg/);
      expect(downloadRes.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.compare(downloadRes.body as Buffer, VALID_JPEG_BUFFER)).toBe(0);

      const updateRes = await request(app)
        .put('/api/archivos/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', UPDATED_JPEG_BUFFER, { filename: 'new.jpg', contentType: 'image/jpeg' });
      expect(updateRes.status).toBe(204);
      expect(fs.readdirSync(uploadsDir)).toEqual([]);
      expect(registrarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'archivos.editar',
          elementoid: 1,
        }),
      );

      const downloadUpdated = await request(app).get('/api/archivos/1');
      expect(downloadUpdated.status).toBe(200);
      expect(Buffer.compare(downloadUpdated.body as Buffer, UPDATED_JPEG_BUFFER)).toBe(0);

      const deleteRes = await request(app)
        .delete('/api/archivos/1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteRes.status).toBe(204);
      expect(registrarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'archivos.eliminar',
          elementoid: 1,
        }),
      );
    });
  });

  describe('OpenAPI Registration', () => {
    it('registers all 6 exact operationIds with bearerAuth on all except DownloadArchivo', () => {
      const registry = new OpenAPIRegistry();
      registerArchivosPaths(registry);

      const routes = registry.definitions
        .filter((def) => def.type === 'route')
        .map((def) => def.route);

      const byOperationId = new Map(routes.map((route) => [route.operationId, route]));
      expect(Array.from(byOperationId.keys())).toEqual([
        'GetArchivos',
        'DownloadArchivo',
        'GetArchivoDetalle',
        'UploadArchivo',
        'ReplaceArchivo',
        'DeleteArchivo',
      ]);

      expect(byOperationId.get('GetArchivos')?.security).toEqual([{ bearerAuth: [] }]);
      expect(byOperationId.get('DownloadArchivo')?.security).toBeUndefined();
      expect(byOperationId.get('GetArchivoDetalle')?.security).toEqual([{ bearerAuth: [] }]);
      expect(byOperationId.get('UploadArchivo')?.security).toEqual([{ bearerAuth: [] }]);
      expect(byOperationId.get('ReplaceArchivo')?.security).toEqual([{ bearerAuth: [] }]);
      expect(byOperationId.get('DeleteArchivo')?.security).toEqual([{ bearerAuth: [] }]);
    });
  });
});
