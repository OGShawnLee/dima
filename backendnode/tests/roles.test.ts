import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { DbClient } from '../src/db';
import { createAuthorize } from '../src/middlewares/auth.middleware';
import { createRolesRouter } from '../src/routes/roles.routes';
import { registerRolesPaths } from '../src/schemas/roles.schema';
import { createJwtTokenService } from '../src/services/jwttoken.service';
import { RolesService, type IRolesService } from '../src/services/roles.service';

const TEST_JWT_SECRET = 'test-secret-key-with-at-least-32-characters-1234';

describe('B005 Roles Service, Controller, Routes & OpenAPI', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempLogFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dima-b005-roles-'));
    tempDirs.push(dir);
    return path.join(dir, 'log.txt');
  }

  describe('GET /api/roles', () => {
    it('returns 401 when unauthenticated', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const service: IRolesService = {
        getAll: vi.fn(async () => []),
        findByNombre: vi.fn(async () => null),
      };

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use('/api/roles', createRolesRouter({ service, authorizeMiddleware: auth }));
        },
      });

      const res = await request(app).get('/api/roles');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ mensaje: 'Acceso denegado' });
    });

    it('returns 403 when authenticated as Usuario', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const userToken = jwtService.generaToken('user@dima.local', 'Usuario', 'Usuario');
      const service: IRolesService = {
        getAll: vi.fn(async () => []),
        findByNombre: vi.fn(async () => null),
      };

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use('/api/roles', createRolesRouter({ service, authorizeMiddleware: auth }));
        },
      });

      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ mensaje: 'Acceso denegado' });
    });

    it('returns 200 with role catalog for Administrador', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');

      const fakeRows = [
        { id: '11111111-1111-4111-8111-111111111111', nombre: 'Administrador' },
        { id: '22222222-2222-4222-8222-222222222222', nombre: 'Usuario' },
      ];
      const orderByMock = vi.fn(async () => fakeRows);
      const fromMock = vi.fn(() => ({ orderBy: orderByMock }));
      const selectMock = vi.fn(() => ({ from: fromMock }));
      const mockDb = { select: selectMock } as unknown as DbClient;

      const service = new RolesService(mockDb);

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use('/api/roles', createRolesRouter({ service, authorizeMiddleware: auth }));
        },
      });

      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(fakeRows);
    });

    it('forwards async errors to errorHandler via next(err)', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const adminToken = jwtService.generaToken('admin@dima.local', 'Admin', 'Administrador');
      const service: IRolesService = {
        getAll: vi.fn(async () => {
          throw new Error('DB failure');
        }),
        findByNombre: vi.fn(async () => null),
      };

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use('/api/roles', createRolesRouter({ service, authorizeMiddleware: auth }));
        },
      });

      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.mensaje).toBe(
        'No se ha podido procesar la petición. Inténtelo nuevamente más tarde.',
      );
    });
  });

  describe('OpenAPI Registration', () => {
    it('registers GetRoles operationId with bearerAuth', () => {
      const registry = new OpenAPIRegistry();
      registerRolesPaths(registry);

      const routeDef = registry.definitions.find(
        (d) => d.type === 'route' && d.route.path === '/api/roles',
      );
      expect(routeDef).toBeDefined();
      if (routeDef && routeDef.type === 'route') {
        expect(routeDef.route.operationId).toBe('GetRoles');
        expect(routeDef.route.security).toEqual([{ bearerAuth: [] }]);
      }
    });
  });
});
