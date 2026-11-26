import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { DbClient } from '../src/db';
import { createAuthorize } from '../src/middlewares/auth.middleware';
import { createProductosRouter } from '../src/routes/productos.routes';
import { registerProductosPaths } from '../src/schemas/productos.schema';
import type { IBitacoraService } from '../src/services/bitacora.service';
import { createJwtTokenService } from '../src/services/jwttoken.service';
import {
  escapeLikePattern,
  ProductosService,
  type IProductosService,
} from '../src/services/productos.service';

const TEST_JWT_SECRET = 'test-secret-key-with-at-least-32-characters-1234';

describe('B006 Productos Service, Controller, Routes & OpenAPI', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempLogFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dima-b006-productos-'));
    tempDirs.push(dir);
    return path.join(dir, 'log.txt');
  }

  function setupApp(service: IProductosService) {
    const jwtService = createJwtTokenService(TEST_JWT_SECRET);
    const auth = createAuthorize({ jwtService });
    const app = createApp({
      logFilePath: createTempLogFile(),
      nodeEnv: 'test',
      registerRoutes: (expressApp) => {
        expressApp.use('/api/productos', createProductosRouter({ service, authorizeMiddleware: auth }));
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

  describe('escapeLikePattern (DEC-009)', () => {
    it('escapes backslashes, percent signs, and underscores', () => {
      expect(escapeLikePattern('laptop')).toBe('laptop');
      expect(escapeLikePattern('100%')).toBe('100\\%');
      expect(escapeLikePattern('usb_c')).toBe('usb\\_c');
      expect(escapeLikePattern('a\\b%c_d')).toBe('a\\\\b\\%c\\_d');
    });
  });

  describe('RBAC & Validation', () => {
    it('returns 401 when unauthenticated', async () => {
      const service = new ProductosService({} as unknown as DbClient, createMockBitacora());
      const { app } = setupApp(service);

      const res = await request(app).get('/api/productos');
      expect(res.status).toBe(401);
    });

    it('allows Usuario to read GET endpoints and blocks mutating endpoints with 403', async () => {
      const service: IProductosService = {
        getAll: vi.fn(async () => [
          {
            productoId: 1,
            titulo: 'TV 4K',
            descripcion: 'Smart TV',
            precio: 12999.5,
            archivoid: null,
            categorias: [{ categoriaId: 1, nombre: 'Televisores', protegida: true }],
          },
        ]),
        getById: vi.fn(async () => ({
          productoId: 1,
          titulo: 'TV 4K',
          descripcion: 'Smart TV',
          precio: 12999.5,
          archivoid: null,
          categorias: [],
        })),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        assignCategoria: vi.fn(),
        removeCategoria: vi.fn(),
      };
      const { app, jwtService } = setupApp(service);
      const userToken = jwtService.generaToken('user@dima.local', 'Usuario', 'Usuario');

      const listRes = await request(app)
        .get('/api/productos?s=TV')
        .set('Authorization', `Bearer ${userToken}`);
      expect(listRes.status).toBe(200);
      expect(service.getAll).toHaveBeenCalledWith('TV');

      const getOneRes = await request(app)
        .get('/api/productos/1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(getOneRes.status).toBe(200);

      const postRes = await request(app)
        .post('/api/productos')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ titulo: 'A', descripcion: 'B', precio: 10 });
      expect(postRes.status).toBe(403);

      const putRes = await request(app)
        .put('/api/productos/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ titulo: 'A', descripcion: 'B', precio: 10 });
      expect(putRes.status).toBe(403);

      const delRes = await request(app)
        .delete('/api/productos/1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(delRes.status).toBe(403);

      const assignRes = await request(app)
        .post('/api/productos/1/categoria')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ categoriaid: 1 });
      expect(assignRes.status).toBe(403);

      const removeRes = await request(app)
        .delete('/api/productos/1/categoria/1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(removeRes.status).toBe(403);
    });
  });

  describe('Reads, Search & Numeric Precio Serialization (DEC-010)', () => {
    it('GET /api/productos?s=50%_off filters with escaped LIKE and serializes precio as number', async () => {
      const productRows = [
        {
          id: 10,
          titulo: 'Promo 50%_off',
          descripcion: 'Oferta',
          precio: '199.95',
          archivoid: 3,
        },
      ];
      const categoryLinks = [
        {
          productoid: 10,
          categoriaId: 2,
          nombre: 'Electrónica',
          protegida: true,
        },
      ];

      const productWhereMock = vi.fn(async () => productRows);
      const productFromMock = vi.fn(() => ({ where: productWhereMock }));

      const linkWhereMock = vi.fn(async () => categoryLinks);
      const innerJoinMock = vi.fn(() => ({ where: linkWhereMock }));
      const linkFromMock = vi.fn(() => ({ innerJoin: innerJoinMock }));

      const selectMock = vi
        .fn()
        .mockImplementationOnce(() => ({ from: productFromMock }))
        .mockImplementationOnce(() => ({ from: linkFromMock }));

      const mockDb = { select: selectMock } as unknown as DbClient;
      const service = new ProductosService(mockDb, createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const userToken = jwtService.generaToken('user@dima.local', 'Usuario', 'Usuario');

      const res = await request(app)
        .get('/api/productos')
        .query({ s: '50%_off' })
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          productoId: 10,
          titulo: 'Promo 50%_off',
          descripcion: 'Oferta',
          precio: 199.95,
          archivoid: 3,
          categorias: [{ categoriaId: 2, nombre: 'Electrónica', protegida: true }],
        },
      ]);
      expect(typeof res.body[0].precio).toBe('number');
      expect(productWhereMock).toHaveBeenCalledTimes(1);
    });

    it('GET /api/productos/:id returns 404 when missing and 200 with nested categorias when found', async () => {
      const limitMock = vi.fn(async () => []);
      const whereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => ({ where: whereMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));
      const mockDb = { select: selectMock } as unknown as DbClient;

      const service = new ProductosService(mockDb, createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const userToken = jwtService.generaToken('user@dima.local', 'Usuario', 'Usuario');

      const res = await request(app)
        .get('/api/productos/404')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST, PUT & DELETE with FK Pre-Validation & Mass Assignment Defense', () => {
    it('POST /api/productos returns 400 when archivoid does not exist', async () => {
      const limitMock = vi.fn(async () => []);
      const whereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => ({ where: whereMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));
      const insertMock = vi.fn();
      const mockDb = { select: selectMock, insert: insertMock } as unknown as DbClient;

      const service = new ProductosService(mockDb, createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const res = await request(app)
        .post('/api/productos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          titulo: 'Laptop',
          descripcion: 'Pro 16',
          precio: 25000,
          archivoid: 999,
        });

      expect(res.status).toBe(400);
      expect(insertMock).not.toHaveBeenCalled();
    });

    it('POST /api/productos returns 201 with productoId + categorias: [] and logs producto.crear', async () => {
      const valuesMock = vi.fn(async () => [{ insertId: 7 }]);
      const insertMock = vi.fn(() => ({ values: valuesMock }));
      const mockDb = { insert: insertMock } as unknown as DbClient;
      const bitacora = createMockBitacora();

      const service = new ProductosService(mockDb, bitacora);
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const res = await request(app)
        .post('/api/productos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          titulo: 'Mouse Gamer',
          descripcion: '16000 DPI',
          precio: 599.9,
          extraField: 'should-be-stripped',
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        productoId: 7,
        titulo: 'Mouse Gamer',
        descripcion: '16000 DPI',
        precio: 599.9,
        archivoid: null,
        categorias: [],
      });
      expect(valuesMock).toHaveBeenCalledWith({
        titulo: 'Mouse Gamer',
        descripcion: '16000 DPI',
        precio: '599.90',
        archivoid: null,
      });
      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'producto.crear',
          elementoid: 7,
          usuario: 'admin@dima.local',
        }),
      );
    });

    it('PUT /api/productos/:id strips unknown fields (DEC-006), validates archivoid FK, and logs producto.editar', async () => {
      const limitMock = vi
        .fn()
        .mockResolvedValueOnce([{ id: 7 }])
        .mockResolvedValueOnce([{ id: 5 }]);
      const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => ({ where: selectWhereMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));

      const updateWhereMock = vi.fn(async () => [{ affectedRows: 1 }]);
      const setMock = vi.fn(() => ({ where: updateWhereMock }));
      const updateMock = vi.fn(() => ({ set: setMock }));

      const mockDb = { select: selectMock, update: updateMock } as unknown as DbClient;
      const bitacora = createMockBitacora();

      const service = new ProductosService(mockDb, bitacora);
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const res = await request(app)
        .put('/api/productos/7')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: 999,
          productoId: 999,
          titulo: 'Mouse Pro',
          descripcion: 'Wireless',
          precio: 799,
          archivoid: 5,
          categorias: [{ categoriaId: 1 }],
        });

      expect(res.status).toBe(204);
      expect(setMock).toHaveBeenCalledWith({
        titulo: 'Mouse Pro',
        descripcion: 'Wireless',
        precio: '799.00',
        archivoid: 5,
      });
      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'producto.editar',
          elementoid: 7,
          usuario: 'admin@dima.local',
        }),
      );
    });

    it('DELETE /api/productos/:id returns 204 and logs producto.eliminar', async () => {
      const limitMock = vi.fn(async () => [{ id: 7 }]);
      const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => ({ where: selectWhereMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));

      const deleteWhereMock = vi.fn(async () => [{ affectedRows: 1 }]);
      const deleteMock = vi.fn(() => ({ where: deleteWhereMock }));

      const mockDb = { select: selectMock, delete: deleteMock } as unknown as DbClient;
      const bitacora = createMockBitacora();

      const service = new ProductosService(mockDb, bitacora);
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const res = await request(app)
        .delete('/api/productos/7')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'producto.eliminar',
          elementoid: 7,
          usuario: 'admin@dima.local',
        }),
      );
    });
  });

  describe('M:N Category Relations', () => {
    it('POST /api/productos/:id/categoria returns 204 and logs productocategoria.agregar with productId:categoriaId', async () => {
      const limitMock = vi
        .fn()
        .mockResolvedValueOnce([{ id: 7 }]) // producto exists
        .mockResolvedValueOnce([{ id: 2 }]) // categoria exists
        .mockResolvedValueOnce([]); // link does not exist yet
      const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => ({ where: selectWhereMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));

      const valuesMock = vi.fn(async () => [{ affectedRows: 1 }]);
      const insertMock = vi.fn(() => ({ values: valuesMock }));

      const mockDb = { select: selectMock, insert: insertMock } as unknown as DbClient;
      const bitacora = createMockBitacora();

      const service = new ProductosService(mockDb, bitacora);
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const res = await request(app)
        .post('/api/productos/7/categoria')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ categoriaid: 2 });

      expect(res.status).toBe(204);
      expect(valuesMock).toHaveBeenCalledWith({ productoid: 7, categoriaid: 2 });
      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'productocategoria.agregar',
          elementoid: '7:2',
          usuario: 'admin@dima.local',
        }),
      );
    });

    it('POST /api/productos/:id/categoria returns 404 when product or category missing and 409 on duplicate', async () => {
      const limitMock = vi
        .fn()
        .mockResolvedValueOnce([]) // missing product
        .mockResolvedValueOnce([{ id: 7 }]) // product exists
        .mockResolvedValueOnce([]) // missing category
        .mockResolvedValueOnce([{ id: 7 }]) // product exists
        .mockResolvedValueOnce([{ id: 2 }]) // category exists
        .mockResolvedValueOnce([{ categoriaid: 2 }]); // duplicate link
      const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => ({ where: selectWhereMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));

      const mockDb = { select: selectMock } as unknown as DbClient;
      const service = new ProductosService(mockDb, createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const missingProdRes = await request(app)
        .post('/api/productos/7/categoria')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ categoriaid: 2 });
      expect(missingProdRes.status).toBe(404);

      const missingCatRes = await request(app)
        .post('/api/productos/7/categoria')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ categoriaid: 99 });
      expect(missingCatRes.status).toBe(404);

      const dupRes = await request(app)
        .post('/api/productos/7/categoria')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ categoriaid: 2 });
      expect(dupRes.status).toBe(409);
    });

    it('DELETE /api/productos/:id/categoria/:categoriaid returns 404 when unlinked and 204 + logs productocategoria.remover when linked', async () => {
      const limitMock = vi
        .fn()
        .mockResolvedValueOnce([{ id: 7 }])
        .mockResolvedValueOnce([{ id: 2 }])
        .mockResolvedValueOnce([{ id: 7 }])
        .mockResolvedValueOnce([{ id: 2 }]);
      const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
      const fromMock = vi.fn(() => ({ where: selectWhereMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));

      const deleteWhereMock = vi
        .fn()
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      const deleteMock = vi.fn(() => ({ where: deleteWhereMock }));

      const mockDb = { select: selectMock, delete: deleteMock } as unknown as DbClient;
      const bitacora = createMockBitacora();

      const service = new ProductosService(mockDb, bitacora);
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const notLinkedRes = await request(app)
        .delete('/api/productos/7/categoria/2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(notLinkedRes.status).toBe(404);

      const removedRes = await request(app)
        .delete('/api/productos/7/categoria/2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(removedRes.status).toBe(204);
      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'productocategoria.remover',
          elementoid: '7:2',
          usuario: 'admin@dima.local',
        }),
      );
    });
  });

  describe('OpenAPI Registration', () => {
    it('registers all 7 Productos operationIds with bearerAuth', () => {
      const registry = new OpenAPIRegistry();
      registerProductosPaths(registry);

      const routes = registry.definitions
        .filter((d) => d.type === 'route')
        .map((d) => d.route);

      const operationIds = routes.map((r) => r.operationId);
      expect(operationIds).toEqual([
        'GetProductos',
        'GetProductoById',
        'CreateProducto',
        'UpdateProducto',
        'DeleteProducto',
        'AssignProductoCategoria',
        'RemoveProductoCategoria',
      ]);
      for (const route of routes) {
        expect(route.security).toEqual([{ bearerAuth: [] }]);
      }
    });
  });
});
