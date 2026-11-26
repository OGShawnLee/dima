import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { ClaimTypes } from '../src/config/claimtypes';
import type { DbClient } from '../src/db';
import { createAuthorize } from '../src/middlewares/auth.middleware';
import { createBitacoraMiddleware } from '../src/middlewares/bitacora.middleware';
import { createBitacoraRouter } from '../src/routes/bitacora.routes';
import { registerBitacoraPaths } from '../src/schemas/bitacora.schema';
import { BitacoraService, type IBitacoraService } from '../src/services/bitacora.service';
import { createJwtTokenService } from '../src/services/jwttoken.service';

const TEST_JWT_SECRET = 'test-secret-key-with-at-least-32-characters-1234';

describe('B004 Bitácora Service, Middleware & Routes', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempLogFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dima-b004-bitacora-'));
    tempDirs.push(dir);
    return path.join(dir, 'log.txt');
  }

  describe('GET /api/bitacora', () => {
    it('returns 401 when unauthenticated', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const service: IBitacoraService = {
        registrar: vi.fn(async () => {}),
        getAll: vi.fn(async () => []),
      };

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use('/api/bitacora', createBitacoraRouter({ service, authorizeMiddleware: auth }));
        },
      });

      const res = await request(app).get('/api/bitacora');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ mensaje: 'Acceso denegado' });
    });

    it('returns 403 when authenticated as Usuario', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const token = jwtService.generaToken('user@dima.local', 'Usuario Normal', 'Usuario');
      const service: IBitacoraService = {
        registrar: vi.fn(async () => {}),
        getAll: vi.fn(async () => []),
      };

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use('/api/bitacora', createBitacoraRouter({ service, authorizeMiddleware: auth }));
        },
      });

      const res = await request(app)
        .get('/api/bitacora')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ mensaje: 'Acceso denegado' });
    });

    it('returns 200 ordered by id DESC for Administrador', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const fakeRows = [
        {
          bitacoraId: 2,
          accion: 'usuario.login',
          elementoid: 'admin@dima.local',
          ip: '127.0.0.1',
          usuario: 'admin@dima.local',
          fecha: new Date('2026-11-25T12:00:00.000Z'),
        },
        {
          bitacoraId: 1,
          accion: 'usuario.login.fallido',
          elementoid: 'unknown@dima.local',
          ip: '127.0.0.1',
          usuario: 'invitado',
          fecha: new Date('2026-11-25T11:00:00.000Z'),
        },
      ];

      const orderByMock = vi.fn(async () => fakeRows);
      const fromMock = vi.fn(() => ({ orderBy: orderByMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));
      const mockDb = { select: selectMock } as unknown as DbClient;

      const service = new BitacoraService(mockDb);

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use('/api/bitacora', createBitacoraRouter({ service, authorizeMiddleware: auth }));
        },
      });

      const res = await request(app)
        .get('/api/bitacora')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          bitacoraId: 2,
          accion: 'usuario.login',
          elementoid: 'admin@dima.local',
          ip: '127.0.0.1',
          usuario: 'admin@dima.local',
          fecha: '2026-11-25T12:00:00.000Z',
        },
        {
          bitacoraId: 1,
          accion: 'usuario.login.fallido',
          elementoid: 'unknown@dima.local',
          ip: '127.0.0.1',
          usuario: 'invitado',
          fecha: '2026-11-25T11:00:00.000Z',
        },
      ]);
      expect(orderByMock).toHaveBeenCalledTimes(1);
    });

    it('forwards async errors to errorHandler via next(err)', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');
      const service: IBitacoraService = {
        registrar: vi.fn(async () => {}),
        getAll: vi.fn(async () => {
          throw new Error('DB connection lost');
        }),
      };

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use('/api/bitacora', createBitacoraRouter({ service, authorizeMiddleware: auth }));
        },
      });

      const res = await request(app)
        .get('/api/bitacora')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.mensaje).toBe(
        'No se ha podido procesar la petición. Inténtelo nuevamente más tarde.',
      );
    });
  });

  describe('bitacoraMiddleware & BitacoraService sanitization', () => {
    it('resolves req.decodedToken dynamically at call time even when registered before authorize', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const registrarMock = vi.fn(async () => {});
      const mockService: IBitacoraService = {
        registrar: registrarMock,
        getAll: vi.fn(async () => []),
      };

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use(createBitacoraMiddleware(mockService));
          expressApp.post('/test-protected', auth('Administrador'), async (req, res) => {
            await req.bitacora('producto.crear', 42);
            res.status(201).json({ ok: true });
          });
          expressApp.post('/test-public', async (req, res) => {
            await req.bitacora('public.ping', null);
            res.status(200).json({ ok: true });
          });
        },
      });

      const protectedRes = await request(app)
        .post('/test-protected')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(protectedRes.status).toBe(201);
      expect(registrarMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          accion: 'producto.crear',
          elementoid: 42,
          usuario: 'admin@dima.local',
        }),
      );

      const publicRes = await request(app).post('/test-public');
      expect(publicRes.status).toBe(200);
      expect(registrarMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          accion: 'public.ping',
          elementoid: null,
          usuario: 'invitado',
        }),
      );
    });

    it('sanitizes CR/LF/TAB characters and clamps strings to <= 255 chars', async () => {
      const valuesMock = vi.fn(async () => {});
      const insertMock = vi.fn(() => ({ values: valuesMock }));
      const mockDb = { insert: insertMock } as unknown as DbClient;

      const service = new BitacoraService(mockDb);
      const longAction = 'a'.repeat(300);

      await service.registrar({
        accion: `${longAction}\r\n\tforged`,
        elementoid: 99,
        ip: '127.0.0.1\r\nX-Forwarded: evil',
        usuario: 'user\n@dima.local\t',
      });

      expect(valuesMock).toHaveBeenCalledTimes(1);
      const inserted = valuesMock.mock.calls[0]?.[0] as {
        accion: string;
        elementoid: string | null;
        ip: string;
        usuario: string;
      };
      expect(inserted.accion).toHaveLength(255);
      expect(inserted.accion).not.toMatch(/[\r\n\t]/);
      expect(inserted.elementoid).toBe('99');
      expect(inserted.ip).toBe('127.0.0.1X-Forwarded: evil');
      expect(inserted.usuario).toBe('user@dima.local');
    });
  });

  describe('OpenAPI Registration', () => {
    it('registers GetBitacora operationId and schemas', () => {
      const registry = new OpenAPIRegistry();
      registerBitacoraPaths(registry);

      const defs = registry.definitions;
      const routeDef = defs.find(
        (d) => d.type === 'route' && d.route.path === '/api/bitacora',
      );
      expect(routeDef).toBeDefined();
      if (routeDef && routeDef.type === 'route') {
        expect(routeDef.route.operationId).toBe('GetBitacora');
        expect(routeDef.route.security).toEqual([{ bearerAuth: [] }]);
      }
      expect(ClaimTypes.Name).toBeDefined();
    });
  });
});
