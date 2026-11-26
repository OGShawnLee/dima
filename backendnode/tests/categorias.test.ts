import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { DbClient } from '../src/db';
import { createAuthorize } from '../src/middlewares/auth.middleware';
import { createCategoriasRouter } from '../src/routes/categorias.routes';
import { registerCategoriasPaths } from '../src/schemas/categorias.schema';
import { CategoriasService, type ICategoriasService } from '../src/services/categorias.service';
import type { IBitacoraService } from '../src/services/bitacora.service';
import { createJwtTokenService } from '../src/services/jwttoken.service';

const TEST_JWT_SECRET = 'test-secret-key-with-at-least-32-characters-1234';

describe('B006 Categorías Service, Controller, Routes & OpenAPI', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempLogFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dima-b006-categorias-'));
    tempDirs.push(dir);
    return path.join(dir, 'log.txt');
  }

  function setupApp(service: ICategoriasService) {
    const jwtService = createJwtTokenService(TEST_JWT_SECRET);
    const auth = createAuthorize({ jwtService });
    const app = createApp({
      logFilePath: createTempLogFile(),
      nodeEnv: 'test',
      registerRoutes: (expressApp) => {
        expressApp.use('/api/categorias', createCategoriasRouter({ service, authorizeMiddleware: auth }));
      },
    });
    return { app, jwtService };
  }

  function createMockBitacora(): IBitacoraService {
    return {
      registrar: vi.fn(async () => {}),
      getAll: vi.fn(async () => []),
    };
  }

  describe('RBAC & Validation', () => {
    it('returns 401 when unauthenticated', async () => {
      const mockDb = {} as unknown as DbClient;
      const service = new CategoriasService(mockDb, createMockBitacora());
      const { app } = setupApp(service);

      const getRes = await request(app).get('/api/categorias');
      expect(getRes.status).toBe(401);

      const postRes = await request(app).post('/api/categorias').send({ nombre: 'Audio' });
      expect(postRes.status).toBe(401);
    });

    it('allows Usuario to read GET endpoints and blocks mutating endpoints with 403', async () => {
      const limitMock = vi.fn(async () => [{ categoriaId: 1, nombre: 'Televisores', protegida: true }]);
      const whereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => {
        const result = Promise.resolve([{ categoriaId: 1, nombre: 'Televisores', protegida: true }]);
        return Object.assign(result, { where: whereMock });
      });
      const selectMock = vi.fn(() => ({ from: fromMock }));
      const mockDb = { select: selectMock } as unknown as DbClient;

      const service = new CategoriasService(mockDb, createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const userToken = jwtService.generaToken('user@dima.local', 'Usuario', 'Usuario');

      const listRes = await request(app)
        .get('/api/categorias')
        .set('Authorization', `Bearer ${userToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body).toEqual([{ categoriaId: 1, nombre: 'Televisores', protegida: true }]);

      const getOneRes = await request(app)
        .get('/api/categorias/1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(getOneRes.status).toBe(200);
      expect(getOneRes.body).toEqual({ categoriaId: 1, nombre: 'Televisores', protegida: true });

      const postRes = await request(app)
        .post('/api/categorias')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ nombre: 'Nueva' });
      expect(postRes.status).toBe(403);

      const putRes = await request(app)
        .put('/api/categorias/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ nombre: 'Editada' });
      expect(putRes.status).toBe(403);

      const delRes = await request(app)
        .delete('/api/categorias/1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(delRes.status).toBe(403);
    });

    it('returns 400 on non-numeric ID and 404 when category is missing', async () => {
      const limitMock = vi.fn(async () => []);
      const whereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => ({ where: whereMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));
      const mockDb = { select: selectMock } as unknown as DbClient;

      const service = new CategoriasService(mockDb, createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const badIdRes = await request(app)
        .get('/api/categorias/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(badIdRes.status).toBe(400);

      const missingRes = await request(app)
        .get('/api/categorias/999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missingRes.status).toBe(404);
    });
  });

  describe('CRUD, Mass Assignment & Protected Category Rules', () => {
    it('POST /api/categorias returns 201 with categoriaId and logs categoria.crear', async () => {
      const valuesMock = vi.fn(async () => [{ insertId: 16 }]);
      const insertMock = vi.fn(() => ({ values: valuesMock }));
      const mockDb = { insert: insertMock } as unknown as DbClient;
      const bitacora = createMockBitacora();

      const service = new CategoriasService(mockDb, bitacora);
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const res = await request(app)
        .post('/api/categorias')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nombre: '  Accesorios  ', protegida: true });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        categoriaId: 16,
        nombre: 'Accesorios',
        protegida: false,
      });
      expect(valuesMock).toHaveBeenCalledWith({
        nombre: 'Accesorios',
        protegida: false,
      });
      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'categoria.crear',
          elementoid: 16,
          usuario: 'admin@dima.local',
        }),
      );
    });

    it('PUT /api/categorias/:id strips protegida/id (DEC-006), returns 204, and logs categoria.editar', async () => {
      const limitMock = vi.fn(async () => [{ categoriaId: 1, nombre: 'Televisores', protegida: true }]);
      const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => ({ where: selectWhereMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));

      const updateWhereMock = vi.fn(async () => [{ affectedRows: 1 }]);
      const setMock = vi.fn(() => ({ where: updateWhereMock }));
      const updateMock = vi.fn(() => ({ set: setMock }));

      const mockDb = { select: selectMock, update: updateMock } as unknown as DbClient;
      const bitacora = createMockBitacora();

      const service = new CategoriasService(mockDb, bitacora);
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const res = await request(app)
        .put('/api/categorias/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nombre: 'Smart TVs', protegida: false, id: 999, categoriaId: 999 });

      expect(res.status).toBe(204);
      expect(setMock).toHaveBeenCalledWith({ nombre: 'Smart TVs' });
      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'categoria.editar',
          elementoid: 1,
          usuario: 'admin@dima.local',
        }),
      );
    });

    it('PUT /api/categorias/:id returns 404 when category does not exist', async () => {
      const limitMock = vi.fn(async () => []);
      const whereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => ({ where: whereMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));
      const mockDb = { select: selectMock } as unknown as DbClient;

      const service = new CategoriasService(mockDb, createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const res = await request(app)
        .put('/api/categorias/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nombre: 'No Existe' });

      expect(res.status).toBe(404);
    });

    it('DELETE /api/categorias/:id returns 400 on protected category and 204 on unprotected', async () => {
      const limitMock = vi
        .fn()
        .mockResolvedValueOnce([{ categoriaId: 1, nombre: 'Televisores', protegida: true }])
        .mockResolvedValueOnce([{ categoriaId: 16, nombre: 'Accesorios', protegida: false }]);
      const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => ({ where: selectWhereMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));

      const deleteWhereMock = vi.fn(async () => [{ affectedRows: 1 }]);
      const deleteMock = vi.fn(() => ({ where: deleteWhereMock }));

      const mockDb = { select: selectMock, delete: deleteMock } as unknown as DbClient;
      const bitacora = createMockBitacora();

      const service = new CategoriasService(mockDb, bitacora);
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const protectedRes = await request(app)
        .delete('/api/categorias/1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(protectedRes.status).toBe(400);
      expect(deleteMock).not.toHaveBeenCalled();

      const unprotectedRes = await request(app)
        .delete('/api/categorias/16')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(unprotectedRes.status).toBe(204);
      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'categoria.eliminar',
          elementoid: 16,
          usuario: 'admin@dima.local',
        }),
      );
    });
  });

  describe('OpenAPI Registration', () => {
    it('registers all 5 Categorías operationIds with bearerAuth', () => {
      const registry = new OpenAPIRegistry();
      registerCategoriasPaths(registry);

      const routes = registry.definitions
        .filter((d) => d.type === 'route')
        .map((d) => d.route);

      const operationIds = routes.map((r) => r.operationId);
      expect(operationIds).toEqual([
        'GetCategorias',
        'GetCategoriaById',
        'CreateCategoria',
        'UpdateCategoria',
        'DeleteCategoria',
      ]);
      for (const route of routes) {
        expect(route.security).toEqual([{ bearerAuth: [] }]);
      }
    });
  });
});
