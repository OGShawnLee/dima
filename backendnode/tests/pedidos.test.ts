import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { DbClient } from '../src/db';
import { createAuthorize } from '../src/middlewares/auth.middleware';
import { createPedidosRouter } from '../src/routes/pedidos.routes';
import { registerPedidosPaths } from '../src/schemas/pedidos.schema';
import type { IBitacoraService } from '../src/services/bitacora.service';
import { createJwtTokenService } from '../src/services/jwttoken.service';
import {
  DrizzlePedidosRepository,
  PedidosService,
  type CreateOrderTransactionInput,
  type IPedidosRepository,
  type IPedidosService,
} from '../src/services/pedidos.service';

const TEST_JWT_SECRET = 'test-secret-key-with-at-least-32-characters-1234';

describe('B010 Pedidos Service, Controller, Routes & OpenAPI', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempLogFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dima-b010-pedidos-'));
    tempDirs.push(dir);
    return path.join(dir, 'log.txt');
  }

  function setupApp(service: IPedidosService) {
    const jwtService = createJwtTokenService(TEST_JWT_SECRET);
    const auth = createAuthorize({ jwtService });
    const app = createApp({
      logFilePath: createTempLogFile(),
      nodeEnv: 'test',
      registerRoutes: (expressApp) => {
        expressApp.use('/api/pedidos', createPedidosRouter({ service, authorizeMiddleware: auth }));
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

  function createMockRepo(overrides?: Partial<IPedidosRepository>): IPedidosRepository {
    return {
      findUserByEmail: vi.fn(async (email: string) => ({
        id: 'user-uuid-1',
        email,
        nombre: 'Usuario Demo',
      })),
      findProductsByIds: vi.fn(async () => [
        { id: 1, titulo: 'Laptop Pro', precio: '19.99' },
        { id: 2, titulo: 'Cable USB-C', precio: '0.10' },
      ]),
      createOrderWithLines: vi.fn(async () => ({
        pedidoId: 42,
        fecha: new Date('2026-11-26T18:00:00.000Z'),
      })),
      findByUserEmail: vi.fn(async () => []),
      findAllWithUsers: vi.fn(async () => []),
      findDetailById: vi.fn(async () => null),
      ...overrides,
    };
  }

  describe('RBAC & Route Ordering', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const service = new PedidosService(createMockRepo(), createMockBitacora());
      const { app } = setupApp(service);

      expect((await request(app).post('/api/pedidos').send({ items: [{ productoId: 1, cantidad: 1 }] })).status).toBe(401);
      expect((await request(app).get('/api/pedidos/mios')).status).toBe(401);
      expect((await request(app).get('/api/pedidos')).status).toBe(401);
      expect((await request(app).get('/api/pedidos/1')).status).toBe(401);
    });

    it('allows Usuario for POST / and GET /mios, and blocks GET / with 403', async () => {
      const repo = createMockRepo({
        findByUserEmail: vi.fn(async () => [
          {
            pedidoId: 10,
            total: 40.28,
            fecha: '2026-11-26T18:00:00.000Z',
            estado: 'pendiente',
            itemCount: 5,
          },
        ]),
      });
      const service = new PedidosService(repo, createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const userToken = jwtService.generaToken('patito@uv.mx', 'Usuario', 'Usuario');

      const mineRes = await request(app)
        .get('/api/pedidos/mios')
        .set('Authorization', `Bearer ${userToken}`);
      expect(mineRes.status).toBe(200);
      expect(mineRes.body).toHaveLength(1);
      expect(repo.findByUserEmail).toHaveBeenCalledWith('patito@uv.mx');
      expect(repo.findDetailById).not.toHaveBeenCalled();

      const allRes = await request(app)
        .get('/api/pedidos')
        .set('Authorization', `Bearer ${userToken}`);
      expect(allRes.status).toBe(403);
    });

    it('allows Administrador for GET / and blocks POST / and GET /mios with 403', async () => {
      const repo = createMockRepo({
        findAllWithUsers: vi.fn(async () => [
          {
            pedidoId: 10,
            total: 40.28,
            fecha: '2026-11-26T18:00:00.000Z',
            estado: 'pendiente',
            itemCount: 5,
            usuarioEmail: 'patito@uv.mx',
            usuarioNombre: 'Usuario patito',
          },
        ]),
      });
      const service = new PedidosService(repo, createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const adminToken = jwtService.generaToken('gvera@uv.mx', 'Guillermo Vera', 'Administrador');

      const allRes = await request(app)
        .get('/api/pedidos')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(allRes.status).toBe(200);
      expect(allRes.body).toHaveLength(1);

      const postRes = await request(app)
        .post('/api/pedidos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ productoId: 1, cantidad: 1 }] });
      expect(postRes.status).toBe(403);

      const mineRes = await request(app)
        .get('/api/pedidos/mios')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(mineRes.status).toBe(403);
    });

    it('rejects non-numeric :id on GET /api/pedidos/:id with 400', async () => {
      const service = new PedidosService(createMockRepo(), createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const userToken = jwtService.generaToken('patito@uv.mx', 'Usuario', 'Usuario');

      const res = await request(app)
        .get('/api/pedidos/not-a-number')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Anti-IDOR on GET /api/pedidos/:id (DEC-015)', () => {
    const orderDetail = {
      pedidoId: 7,
      usuarioEmail: 'Owner@uv.mx',
      usuarioNombre: 'Owner User',
      total: 19.99,
      fecha: '2026-11-26T18:00:00.000Z',
      estado: 'pendiente' as const,
      items: [
        {
          productoId: 1,
          titulo: 'Laptop Pro',
          precioUnitario: 19.99,
          cantidad: 1,
        },
      ],
    };

    it('returns 200 to the owning Usuario (case-insensitive) and Administrador, and 404 to another Usuario', async () => {
      const repo = createMockRepo({
        findDetailById: vi.fn(async (id: number) => (id === 7 ? orderDetail : null)),
      });
      const service = new PedidosService(repo, createMockBitacora());
      const { app, jwtService } = setupApp(service);

      const ownerToken = jwtService.generaToken('owner@uv.mx', 'Owner User', 'Usuario');
      const otherUserToken = jwtService.generaToken('attacker@uv.mx', 'Attacker', 'Usuario');
      const adminToken = jwtService.generaToken('gvera@uv.mx', 'Guillermo Vera', 'Administrador');

      const ownerRes = await request(app)
        .get('/api/pedidos/7')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.pedidoId).toBe(7);

      const adminRes = await request(app)
        .get('/api/pedidos/7')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.pedidoId).toBe(7);

      const idorRes = await request(app)
        .get('/api/pedidos/7')
        .set('Authorization', `Bearer ${otherUserToken}`);
      expect(idorRes.status).toBe(404);

      const missingRes = await request(app)
        .get('/api/pedidos/999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missingRes.status).toBe(404);
    });
  });

  describe('Server-Authoritative Pricing & Validation (OWASP API6 / CWE-602)', () => {
    it('strips client price/total fields, merges duplicate productoId, computes integer cents, and logs pedido.crear', async () => {
      let capturedTxInput: CreateOrderTransactionInput | null = null;
      const repo = createMockRepo({
        createOrderWithLines: vi.fn(async (input) => {
          capturedTxInput = input;
          return {
            pedidoId: 42,
            fecha: new Date('2026-11-26T18:00:00.000Z'),
          };
        }),
      });
      const bitacora = createMockBitacora();
      const service = new PedidosService(repo, bitacora);
      const { app, jwtService } = setupApp(service);
      const userToken = jwtService.generaToken('patito@uv.mx', 'Usuario patito', 'Usuario');

      const res = await request(app)
        .post('/api/pedidos')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          total: 0,
          estado: 'confirmado',
          items: [
            { productoId: 1, cantidad: 1, precio: 0.01, preciounitario: 0.01 },
            { productoId: 2, cantidad: 3, precio: 0.01 },
            { productoId: 1, cantidad: 1, precio: 0.01 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        pedidoId: 42,
        total: 40.28,
        fecha: '2026-11-26T18:00:00.000Z',
        estado: 'pendiente',
      });

      expect(capturedTxInput).toEqual({
        usuarioId: 'user-uuid-1',
        total: '40.28',
        estado: 'pendiente',
        lines: [
          {
            productoId: 1,
            titulo: 'Laptop Pro',
            precioUnitario: '19.99',
            cantidad: 2,
          },
          {
            productoId: 2,
            titulo: 'Cable USB-C',
            precioUnitario: '0.10',
            cantidad: 3,
          },
        ],
      });

      expect(bitacora.registrar).toHaveBeenCalledWith({
        accion: 'pedido.crear',
        elementoid: 42,
        ip: expect.any(String),
        usuario: 'patito@uv.mx',
      });
    });

    it('rejects unknown productoId with 400 and does not write order or bitacora', async () => {
      const repo = createMockRepo({
        findProductsByIds: vi.fn(async () => [{ id: 1, titulo: 'Laptop Pro', precio: '19.99' }]),
      });
      const bitacora = createMockBitacora();
      const service = new PedidosService(repo, bitacora);
      const { app, jwtService } = setupApp(service);
      const userToken = jwtService.generaToken('patito@uv.mx', 'Usuario', 'Usuario');

      const res = await request(app)
        .post('/api/pedidos')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [
            { productoId: 1, cantidad: 1 },
            { productoId: 9999, cantidad: 1 },
          ],
        });

      expect(res.status).toBe(400);
      expect(repo.createOrderWithLines).not.toHaveBeenCalled();
      expect(bitacora.registrar).not.toHaveBeenCalled();
    });

    it('rejects merged duplicate productoId exceeding 99 with 400', async () => {
      const repo = createMockRepo();
      const service = new PedidosService(repo, createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const userToken = jwtService.generaToken('patito@uv.mx', 'Usuario', 'Usuario');

      const res = await request(app)
        .post('/api/pedidos')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [
            { productoId: 1, cantidad: 60 },
            { productoId: 1, cantidad: 40 },
          ],
        });

      expect(res.status).toBe(400);
      expect(repo.createOrderWithLines).not.toHaveBeenCalled();
    });

    it('rejects empty items or cantidad > 99 with 400', async () => {
      const service = new PedidosService(createMockRepo(), createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const userToken = jwtService.generaToken('patito@uv.mx', 'Usuario', 'Usuario');

      expect(
        (
          await request(app)
            .post('/api/pedidos')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ items: [] })
        ).status,
      ).toBe(400);

      expect(
        (
          await request(app)
            .post('/api/pedidos')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ items: [{ productoId: 1, cantidad: 100 }] })
        ).status,
      ).toBe(400);
    });

    it('returns 401 when actor email no longer exists in DB', async () => {
      const repo = createMockRepo({
        findUserByEmail: vi.fn(async () => null),
      });
      const service = new PedidosService(repo, createMockBitacora());
      const { app, jwtService } = setupApp(service);
      const userToken = jwtService.generaToken('deleted@uv.mx', 'Deleted', 'Usuario');

      const res = await request(app)
        .post('/api/pedidos')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ items: [{ productoId: 1, cantidad: 1 }] });

      expect(res.status).toBe(401);
    });
  });

  describe('DrizzlePedidosRepository transaction behavior', () => {
    it('wraps pedido and pedidodetalle inserts in a DB transaction', async () => {
      const insertedPayloads: unknown[] = [];
      const mockTx = {
        insert: vi.fn(() => ({
          values: vi.fn(async (payload: unknown) => {
            insertedPayloads.push(payload);
            return [{ insertId: 77 }];
          }),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ fecha: new Date('2026-11-26T18:30:00.000Z') }]),
            })),
          })),
        })),
      };
      const mockDb = {
        transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
      } as unknown as DbClient;

      const repo = new DrizzlePedidosRepository(mockDb);
      const result = await repo.createOrderWithLines({
        usuarioId: 'user-1',
        total: '39.98',
        estado: 'pendiente',
        lines: [
          {
            productoId: 1,
            titulo: 'Laptop Pro',
            precioUnitario: '19.99',
            cantidad: 2,
          },
        ],
      });

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        pedidoId: 77,
        fecha: new Date('2026-11-26T18:30:00.000Z'),
      });
      expect(insertedPayloads).toEqual([
        {
          usuarioid: 'user-1',
          total: '39.98',
          estado: 'pendiente',
        },
        [
          {
            pedidoid: 77,
            productoid: 1,
            titulo: 'Laptop Pro',
            preciounitario: '19.99',
            cantidad: 2,
          },
        ],
      ]);
    });
  });

  describe('OpenAPI Registration', () => {
    it('registers CreatePedido, GetMyPedidos, GetPedidos, and GetPedidoById', () => {
      const registry = new OpenAPIRegistry();
      registerPedidosPaths(registry);

      const defs = registry.definitions;
      const paths = defs.filter((def) => def.type === 'route').map((def) => def.route.operationId);
      expect(paths).toEqual(['CreatePedido', 'GetMyPedidos', 'GetPedidos', 'GetPedidoById']);
    });
  });
});
