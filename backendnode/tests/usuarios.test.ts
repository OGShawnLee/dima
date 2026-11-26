import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { createAuthorize } from '../src/middlewares/auth.middleware';
import { createUsuariosRouter } from '../src/routes/usuarios.routes';
import type { RoleName } from '../src/schemas/common.schema';
import { registerUsuariosPaths } from '../src/schemas/usuarios.schema';
import type { IBitacoraService } from '../src/services/bitacora.service';
import { createJwtTokenService } from '../src/services/jwttoken.service';
import type { IRolesService } from '../src/services/roles.service';
import {
  UsuariosService,
  type InsertUsuarioData,
  type IUsuariosRepository,
  type UpdateUsuarioData,
  type UsuarioRecord,
} from '../src/services/usuarios.service';

const TEST_JWT_SECRET = 'test-secret-key-with-at-least-32-characters-1234';
const ADMIN_ROLE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ROLE_ID = '22222222-2222-4222-8222-222222222222';

interface InMemoryUser extends UsuarioRecord {
  passwordhash: string;
  rolid: string;
}

describe('B005 Usuarios Service, Guards, Routes & OpenAPI', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempLogFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dima-b005-usuarios-'));
    tempDirs.push(dir);
    return path.join(dir, 'log.txt');
  }

  function createHarness(initialUsers?: InMemoryUser[]) {
    const store: InMemoryUser[] = initialUsers ?? [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        email: 'gvera@uv.mx',
        nombre: 'Guillermo Vera',
        protegido: true,
        rol: 'Administrador',
        rolid: ADMIN_ROLE_ID,
        passwordhash: '$2b$10$hash1',
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        email: 'admin@dima.local',
        nombre: 'Admin Activo',
        protegido: false,
        rol: 'Administrador',
        rolid: ADMIN_ROLE_ID,
        passwordhash: '$2b$10$hash2',
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        email: 'patito@uv.mx',
        nombre: 'Usuario Patito',
        protegido: false,
        rol: 'Usuario',
        rolid: USER_ROLE_ID,
        passwordhash: '$2b$10$hash3',
      },
    ];

    const insertSpy = vi.fn();
    const updateSpy = vi.fn();
    const deleteSpy = vi.fn();

    const repository: IUsuariosRepository = {
      findAll: async () =>
        store.map((u) => ({
          id: u.id,
          email: u.email,
          nombre: u.nombre,
          rol: u.rol,
        })),
      findByEmail: async (email: string) => {
        const found = store.find((u) => u.email === email);
        if (!found) {
          return null;
        }
        return {
          id: found.id,
          email: found.email,
          nombre: found.nombre,
          protegido: found.protegido,
          rol: found.rol,
        };
      },
      insert: async (data: InsertUsuarioData) => {
        insertSpy(data);
        const roleName: RoleName = data.rolid === ADMIN_ROLE_ID ? 'Administrador' : 'Usuario';
        store.push({
          id: data.id,
          email: data.email,
          nombre: data.nombre,
          protegido: data.protegido,
          rol: roleName,
          rolid: data.rolid,
          passwordhash: data.passwordhash,
        });
      },
      updateByEmail: async (email: string, data: UpdateUsuarioData) => {
        updateSpy(email, data);
        const target = store.find((u) => u.email === email);
        if (target) {
          target.rolid = data.rolid;
          target.rol = data.rolid === ADMIN_ROLE_ID ? 'Administrador' : 'Usuario';
          if (data.nombre !== undefined) {
            target.nombre = data.nombre;
          }
        }
      },
      deleteByEmail: async (email: string) => {
        deleteSpy(email);
        const idx = store.findIndex((u) => u.email === email);
        if (idx >= 0) {
          store.splice(idx, 1);
        }
      },
    };

    const rolesService: IRolesService = {
      getAll: async () => [
        { id: ADMIN_ROLE_ID, nombre: 'Administrador' },
        { id: USER_ROLE_ID, nombre: 'Usuario' },
      ],
      findByNombre: async (nombre: RoleName) => {
        if (nombre === 'Administrador') {
          return { id: ADMIN_ROLE_ID, nombre: 'Administrador' };
        }
        if (nombre === 'Usuario') {
          return { id: USER_ROLE_ID, nombre: 'Usuario' };
        }
        return null;
      },
    };

    const registrarMock = vi.fn(async () => {});
    const bitacora: IBitacoraService = {
      registrar: registrarMock,
      getAll: vi.fn(async () => []),
    };

    const service = new UsuariosService({
      repository,
      rolesService,
      bitacora,
    });

    const jwtService = createJwtTokenService(TEST_JWT_SECRET);
    const auth = createAuthorize({ jwtService });
    const adminToken = jwtService.generaToken('admin@dima.local', 'Admin Activo', 'Administrador');
    const userToken = jwtService.generaToken('patito@uv.mx', 'Usuario Patito', 'Usuario');

    const app = createApp({
      logFilePath: createTempLogFile(),
      nodeEnv: 'test',
      registerRoutes: (expressApp) => {
        expressApp.use('/api/usuarios', createUsuariosRouter({ service, authorizeMiddleware: auth }));
      },
    });

    return {
      app,
      store,
      rolesService,
      registrarMock,
      insertSpy,
      updateSpy,
      deleteSpy,
      adminToken,
      userToken,
    };
  }

  describe('RBAC on all 5 routes', () => {
    it('returns 401 unauthenticated and 403 for Usuario on every /api/usuarios route', async () => {
      const { app, userToken } = createHarness();

      const requests = [
        { method: 'get' as const, url: '/api/usuarios' },
        { method: 'get' as const, url: '/api/usuarios/patito@uv.mx' },
        { method: 'post' as const, url: '/api/usuarios' },
        { method: 'put' as const, url: '/api/usuarios/patito@uv.mx' },
        { method: 'delete' as const, url: '/api/usuarios/patito@uv.mx' },
      ];

      for (const reqSpec of requests) {
        const unauth = await request(app)[reqSpec.method](reqSpec.url);
        expect(unauth.status).toBe(401);

        const forbiddenRes = await request(app)
          [reqSpec.method](reqSpec.url)
          .set('Authorization', `Bearer ${userToken}`);
        expect(forbiddenRes.status).toBe(403);
      }
    });
  });

  describe('GET /api/usuarios & GET /api/usuarios/:email', () => {
    it('returns users without passwordhash, 404 for missing user, and 400 for invalid email param', async () => {
      const { app, adminToken } = createHarness();

      const listRes = await request(app)
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(3);
      expect(JSON.stringify(listRes.body)).not.toContain('passwordhash');

      const singleRes = await request(app)
        .get('/api/usuarios/patito@uv.mx')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(singleRes.status).toBe(200);
      expect(singleRes.body).toEqual({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        email: 'patito@uv.mx',
        nombre: 'Usuario Patito',
        rol: 'Usuario',
      });
      expect(singleRes.body.passwordhash).toBeUndefined();

      const missingRes = await request(app)
        .get('/api/usuarios/missing@uv.mx')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missingRes.status).toBe(404);

      const invalidParamRes = await request(app)
        .get('/api/usuarios/not-an-email')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(invalidParamRes.status).toBe(400);
    });
  });

  describe('POST /api/usuarios', () => {
    it('returns 201 with rol (not rolid), no passwordhash, bcrypt cost-10 hash, and usuarios.crear audit', async () => {
      const hashSpy = vi.spyOn(bcrypt, 'hash');
      const { app, adminToken, insertSpy, registrarMock } = createHarness();

      const res = await request(app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: '  Nuevo@Dima.Local ',
          password: 'password123',
          nombre: 'Nuevo Usuario',
          rol: 'Usuario',
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        email: 'nuevo@dima.local',
        nombre: 'Nuevo Usuario',
        rol: 'Usuario',
      });
      expect(res.body.rolid).toBeUndefined();
      expect(res.body.passwordhash).toBeUndefined();
      expect(hashSpy).toHaveBeenCalledWith('password123', 10);
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'nuevo@dima.local',
          protegido: false,
          rolid: USER_ROLE_ID,
        }),
      );
      expect(registrarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'usuarios.crear',
          elementoid: 'nuevo@dima.local',
          usuario: 'admin@dima.local',
        }),
      );
    });

    it('rejects < 6 char password (400), invalid role (400), and duplicate email (409)', async () => {
      const { app, adminToken } = createHarness();

      const shortPassRes = await request(app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'short@dima.local',
          password: '12345',
          nombre: 'Short',
          rol: 'Usuario',
        });
      expect(shortPassRes.status).toBe(400);

      const badRoleRes = await request(app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'badrole@dima.local',
          password: 'password123',
          nombre: 'Bad Role',
          rol: 'SuperAdmin',
        });
      expect(badRoleRes.status).toBe(400);

      const dupRes = await request(app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'patito@uv.mx',
          password: 'password123',
          nombre: 'Dup',
          rol: 'Usuario',
        });
      expect(dupRes.status).toBe(409);
    });
  });

  describe('PUT /api/usuarios/:email', () => {
    it('strips mass-assignment fields, returns 204, writes only rolid + nombre, and logs usuarios.editar', async () => {
      const { app, adminToken, updateSpy, registrarMock } = createHarness();

      const res = await request(app)
        .put('/api/usuarios/patito@uv.mx')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Patito Actualizado',
          rol: 'Administrador',
          protegido: true,
          passwordhash: 'hacked',
          id: 'evil-id',
          email: 'evil@dima.local',
        });

      expect(res.status).toBe(204);
      expect(updateSpy).toHaveBeenCalledWith('patito@uv.mx', {
        rolid: ADMIN_ROLE_ID,
        nombre: 'Patito Actualizado',
      });
      expect(registrarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'usuarios.editar',
          elementoid: 'patito@uv.mx',
          usuario: 'admin@dima.local',
        }),
      );
    });

    it('returns 404 for missing user, 403 for protegido user, and 403 for self-edit', async () => {
      const { app, adminToken } = createHarness();

      const missingRes = await request(app)
        .put('/api/usuarios/nobody@uv.mx')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rol: 'Usuario' });
      expect(missingRes.status).toBe(404);

      const protectedRes = await request(app)
        .put('/api/usuarios/gvera@uv.mx')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rol: 'Usuario' });
      expect(protectedRes.status).toBe(403);

      const selfEditRes = await request(app)
        .put('/api/usuarios/admin@dima.local')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rol: 'Usuario' });
      expect(selfEditRes.status).toBe(403);
    });
  });

  describe('DELETE /api/usuarios/:email', () => {
    it('returns 204 and logs usuarios.eliminar', async () => {
      const { app, adminToken, deleteSpy, registrarMock } = createHarness();

      const res = await request(app)
        .delete('/api/usuarios/patito@uv.mx')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(deleteSpy).toHaveBeenCalledWith('patito@uv.mx');
      expect(registrarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'usuarios.eliminar',
          elementoid: 'patito@uv.mx',
          usuario: 'admin@dima.local',
        }),
      );
    });

    it('returns 404 for missing user, 403 for protegido user, and 403 for self-delete', async () => {
      const { app, adminToken } = createHarness();

      const missingRes = await request(app)
        .delete('/api/usuarios/nobody@uv.mx')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missingRes.status).toBe(404);

      const protectedRes = await request(app)
        .delete('/api/usuarios/gvera@uv.mx')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(protectedRes.status).toBe(403);

      const selfDeleteRes = await request(app)
        .delete('/api/usuarios/admin@dima.local')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(selfDeleteRes.status).toBe(403);
    });
  });

  describe('OpenAPI Registration', () => {
    it('registers all 5 Usuarios operationIds with bearerAuth', () => {
      const registry = new OpenAPIRegistry();
      registerUsuariosPaths(registry);

      const routeOps = registry.definitions
        .filter((d) => d.type === 'route')
        .map((d) => (d.type === 'route' ? d.route.operationId : undefined));

      expect(routeOps).toEqual([
        'GetUsuarios',
        'GetUsuarioByEmail',
        'CreateUsuario',
        'UpdateUsuario',
        'DeleteUsuario',
      ]);
    });
  });
});
