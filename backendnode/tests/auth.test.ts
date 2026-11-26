import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { ClaimTypes } from '../src/config/claimtypes';
import { createAuthorize } from '../src/middlewares/auth.middleware';
import { createAuthRateLimiter } from '../src/middlewares/ratelimit.middleware';
import { createAuthRouter } from '../src/routes/auth.routes';
import { registerAuthPaths } from '../src/schemas/auth.schema';
import { AuthService, type IAuthService } from '../src/services/auth.service';
import type { IBitacoraService } from '../src/services/bitacora.service';
import {
  createJwtTokenService,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from '../src/services/jwttoken.service';

const TEST_JWT_SECRET = 'test-secret-key-with-at-least-32-characters-1234';

describe('B004 Auth, JWT, RBAC & DB-Checked Sliding Refresh', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempLogFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dima-b004-auth-'));
    tempDirs.push(dir);
    return path.join(dir, 'log.txt');
  }

  describe('POST /api/auth', () => {
    it('returns 200 with JWT and records usuario.login audit on valid credentials', async () => {
      const passwordHash = await bcrypt.hash('secret123', 4);
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const registrarMock = vi.fn(async () => {});
      const bitacora: IBitacoraService = {
        registrar: registrarMock,
        getAll: vi.fn(async () => []),
      };

      const authService = new AuthService({
        findUserByEmail: async (email) =>
          email === 'admin@dima.local'
            ? {
                email: 'admin@dima.local',
                nombre: 'Admin Dima',
                passwordhash: passwordHash,
                rol: 'Administrador',
              }
            : null,
        jwtService,
        bitacora,
      });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use(
            '/api/auth',
            createAuthRouter({
              service: authService,
              rateLimiter: createAuthRateLimiter({ max: 50 }),
            }),
          );
        },
      });

      const res = await request(app)
        .post('/api/auth')
        .send({ email: 'ADMIN@dima.local', password: 'secret123' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        email: 'admin@dima.local',
        nombre: 'Admin Dima',
        rol: 'Administrador',
        jwt: expect.any(String),
      });

      const decoded = jwtService.verificarToken(res.body.jwt as string);
      expect(decoded[ClaimTypes.Name]).toBe('admin@dima.local');
      expect(decoded[ClaimTypes.Role]).toBe('Administrador');

      expect(registrarMock).toHaveBeenCalledTimes(1);
      expect(registrarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'usuario.login',
          elementoid: 'admin@dima.local',
          usuario: 'admin@dima.local',
        }),
      );
    });

    it('returns 401 and records usuario.login.fallido (without password) on wrong password', async () => {
      const passwordHash = await bcrypt.hash('secret123', 4);
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const registrarMock = vi.fn(async () => {});
      const bitacora: IBitacoraService = {
        registrar: registrarMock,
        getAll: vi.fn(async () => []),
      };

      const authService = new AuthService({
        findUserByEmail: async (email) =>
          email === 'admin@dima.local'
            ? {
                email: 'admin@dima.local',
                nombre: 'Admin Dima',
                passwordhash: passwordHash,
                rol: 'Administrador',
              }
            : null,
        jwtService,
        bitacora,
      });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use(
            '/api/auth',
            createAuthRouter({
              service: authService,
              rateLimiter: createAuthRateLimiter({ max: 50 }),
            }),
          );
        },
      });

      const res = await request(app)
        .post('/api/auth')
        .send({ email: 'admin@dima.local', password: 'wrong-password-123' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ mensaje: 'Usuario o contraseña incorrectos.' });
      expect(registrarMock).toHaveBeenCalledTimes(1);
      expect(registrarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'usuario.login.fallido',
          elementoid: 'admin@dima.local',
          usuario: 'invitado',
        }),
      );
      expect(JSON.stringify(registrarMock.mock.calls)).not.toContain('wrong-password-123');
    });

    it('returns identical 401, executes dummy bcrypt.compare, and logs usuario.login.fallido on unknown email', async () => {
      const compareSpy = vi.spyOn(bcrypt, 'compare');
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const registrarMock = vi.fn(async () => {});
      const bitacora: IBitacoraService = {
        registrar: registrarMock,
        getAll: vi.fn(async () => []),
      };

      const authService = new AuthService({
        findUserByEmail: async () => null,
        jwtService,
        bitacora,
      });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use(
            '/api/auth',
            createAuthRouter({
              service: authService,
              rateLimiter: createAuthRateLimiter({ max: 50 }),
            }),
          );
        },
      });

      const res = await request(app)
        .post('/api/auth')
        .send({ email: 'nobody@dima.local', password: 'any-password' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ mensaje: 'Usuario o contraseña incorrectos.' });
      expect(compareSpy).toHaveBeenCalledTimes(1);
      expect(registrarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'usuario.login.fallido',
          elementoid: 'nobody@dima.local',
          usuario: 'invitado',
        }),
      );
      expect(JSON.stringify(registrarMock.mock.calls)).not.toContain('any-password');
    });

    it('returns 400 with detalles on malformed login body', async () => {
      const authService = new AuthService({
        findUserByEmail: async () => null,
        jwtService: createJwtTokenService(TEST_JWT_SECRET),
        bitacora: { registrar: vi.fn(async () => {}), getAll: vi.fn(async () => []) },
      });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use(
            '/api/auth',
            createAuthRouter({
              service: authService,
              rateLimiter: createAuthRateLimiter({ max: 50 }),
            }),
          );
        },
      });

      const res = await request(app)
        .post('/api/auth')
        .send({ email: 'not-an-email', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.mensaje).toBe('Datos de entrada inválidos.');
      expect(Array.isArray(res.body.detalles)).toBe(true);
      expect(res.body.detalles.length).toBeGreaterThanOrEqual(2);
    });

    it('triggers 429 rate limit before login or bitacora audit runs', async () => {
      const registrarMock = vi.fn(async () => {});
      const findUserMock = vi.fn(async () => null);
      const authService = new AuthService({
        findUserByEmail: findUserMock,
        jwtService: createJwtTokenService(TEST_JWT_SECRET),
        bitacora: { registrar: registrarMock, getAll: vi.fn(async () => []) },
      });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use(
            '/api/auth',
            createAuthRouter({
              service: authService,
              rateLimiter: createAuthRateLimiter({ windowMs: 60_000, max: 2 }),
            }),
          );
        },
      });

      const r1 = await request(app)
        .post('/api/auth')
        .send({ email: 'a@dima.local', password: 'bad' });
      const r2 = await request(app)
        .post('/api/auth')
        .send({ email: 'a@dima.local', password: 'bad' });
      const r3 = await request(app)
        .post('/api/auth')
        .send({ email: 'a@dima.local', password: 'bad' });

      expect(r1.status).toBe(401);
      expect(r2.status).toBe(401);
      expect(r3.status).toBe(429);
      expect(findUserMock).toHaveBeenCalledTimes(2);
      expect(registrarMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /api/auth/tiempo', () => {
    it('returns 200 text/plain matching 00:MM:SS for valid token', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const authService = new AuthService({
        findUserByEmail: async () => null,
        jwtService,
        bitacora: { registrar: vi.fn(async () => {}), getAll: vi.fn(async () => []) },
      });
      const token = jwtService.generaToken('user@dima.local', 'User', 'Usuario');

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use(
            '/api/auth',
            createAuthRouter({ service: authService, authorizeMiddleware: auth }),
          );
        },
      });

      const res = await request(app)
        .get('/api/auth/tiempo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toMatch(/^00:\d{2}:\d{2}$/);
    });

    it('returns 401 when Authorization header is missing', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const authService = new AuthService({
        findUserByEmail: async () => null,
        jwtService,
        bitacora: { registrar: vi.fn(async () => {}), getAll: vi.fn(async () => []) },
      });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use(
            '/api/auth',
            createAuthRouter({ service: authService, authorizeMiddleware: auth }),
          );
        },
      });

      const res = await request(app).get('/api/auth/tiempo');
      expect(res.status).toBe(401);
    });

    it('returns 404 cleanly without ERR_HTTP_HEADERS_SENT when remaining time is unavailable', async () => {
      const stubService: IAuthService = {
        login: vi.fn(),
        obtenerTiempoRestante: vi.fn(() => null),
      };

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.use(
            '/api/auth',
            createAuthRouter({
              service: stubService,
              authorizeMiddleware: () => (_req, _res, next) => next(),
            }),
          );
        },
      });

      const res = await request(app).get('/api/auth/tiempo');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ mensaje: 'Tiempo de token no disponible.' });
    });
  });

  describe('authorize(...) strict JWT & RBAC (DEC-005)', () => {
    function buildProtectedApp(auth: ReturnType<typeof createAuthorize>) {
      return createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.get('/admin-only', auth('Administrador'), (req, res) => {
            res.status(200).json({ user: req.decodedToken });
          });
        },
      });
    }

    it('returns 401 on missing or non-Bearer Authorization header without TypeError', async () => {
      const auth = createAuthorize({ jwtService: createJwtTokenService(TEST_JWT_SECRET) });
      const app = buildProtectedApp(auth);

      const missingRes = await request(app).get('/admin-only');
      expect(missingRes.status).toBe(401);

      const basicRes = await request(app)
        .get('/admin-only')
        .set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(basicRes.status).toBe(401);
    });

    it('returns 401 on expired token, wrong issuer, wrong audience, or non-HS256 alg', async () => {
      const auth = createAuthorize({ jwtService: createJwtTokenService(TEST_JWT_SECRET) });
      const app = buildProtectedApp(auth);

      const baseClaims = {
        [ClaimTypes.Name]: 'admin@dima.local',
        [ClaimTypes.GivenName]: 'Admin',
        [ClaimTypes.Role]: 'Administrador',
      };

      const expiredToken = jwt.sign(baseClaims, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: -10,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });

      const wrongIssToken = jwt.sign(baseClaims, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '20m',
        issuer: 'WrongIssuer',
        audience: JWT_AUDIENCE,
      });

      const wrongAudToken = jwt.sign(baseClaims, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '20m',
        issuer: JWT_ISSUER,
        audience: 'WrongAudience',
      });

      const wrongAlgToken = jwt.sign(baseClaims, TEST_JWT_SECRET, {
        algorithm: 'HS512',
        expiresIn: '20m',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });

      for (const badToken of [expiredToken, wrongIssToken, wrongAudToken, wrongAlgToken]) {
        const res = await request(app)
          .get('/admin-only')
          .set('Authorization', `Bearer ${badToken}`);
        expect(res.status).toBe(401);
      }
    });

    it('returns 403 (not 401) when valid Usuario token accesses Administrador route', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const auth = createAuthorize({ jwtService });
      const app = buildProtectedApp(auth);

      const userToken = jwtService.generaToken('user@dima.local', 'Normal User', 'Usuario');
      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ mensaje: 'Acceso denegado' });
    });
  });

  describe('DB-checked sliding JWT refresh (DEC-003)', () => {
    function signTokenWithRemainingSeconds(
      remainingSeconds: number,
      rol: 'Administrador' | 'Usuario' = 'Administrador',
    ): string {
      return jwt.sign(
        {
          [ClaimTypes.Name]: 'admin@dima.local',
          [ClaimTypes.GivenName]: 'Old Name',
          [ClaimTypes.Role]: rol,
        },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: remainingSeconds,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
      );
    }

    it('stays stateless (zero DB lookup, no Set-Authorization) when > 5m remain', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const findActiveUser = vi.fn();
      const auth = createAuthorize({ jwtService, findActiveUserByEmail: findActiveUser });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.get('/admin-only', auth('Administrador'), (_req, res) => {
            res.status(200).json({ ok: true });
          });
        },
      });

      const token = signTokenWithRemainingSeconds(15 * 60);
      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(findActiveUser).not.toHaveBeenCalled();
      expect(res.headers['set-authorization']).toBeUndefined();
    });

    it('queries DB when < 5m remain and issues Set-Authorization with current DB claims for active user', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const findActiveUser = vi.fn(async () => ({
        email: 'admin@dima.local',
        nombre: 'Updated DB Name',
        rol: 'Administrador' as const,
      }));
      const auth = createAuthorize({ jwtService, findActiveUserByEmail: findActiveUser });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.get('/admin-only', auth('Administrador'), (req, res) => {
            res.status(200).json({ nombre: req.decodedToken?.[ClaimTypes.GivenName] });
          });
        },
      });

      const token = signTokenWithRemainingSeconds(2 * 60);
      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ nombre: 'Updated DB Name' });
      expect(findActiveUser).toHaveBeenCalledWith('admin@dima.local');

      const refreshedHeader = res.headers['set-authorization'];
      expect(typeof refreshedHeader).toBe('string');
      const refreshedDecoded = jwtService.verificarToken(refreshedHeader as string);
      expect(refreshedDecoded[ClaimTypes.GivenName]).toBe('Updated DB Name');
      expect(refreshedDecoded[ClaimTypes.Role]).toBe('Administrador');
    });

    it('rejects with 401 and no Set-Authorization when user was deleted in DB during < 5m window', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const findActiveUser = vi.fn(async () => null);
      const auth = createAuthorize({ jwtService, findActiveUserByEmail: findActiveUser });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.get('/admin-only', auth('Administrador'), (_req, res) => {
            res.status(200).json({ ok: true });
          });
        },
      });

      const token = signTokenWithRemainingSeconds(2 * 60);
      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(findActiveUser).toHaveBeenCalledWith('admin@dima.local');
      expect(res.headers['set-authorization']).toBeUndefined();
    });

    it('rejects with 403 and no Set-Authorization when Admin was demoted in DB during < 5m window', async () => {
      const jwtService = createJwtTokenService(TEST_JWT_SECRET);
      const findActiveUser = vi.fn(async () => ({
        email: 'admin@dima.local',
        nombre: 'Demoted Admin',
        rol: 'Usuario' as const,
      }));
      const auth = createAuthorize({ jwtService, findActiveUserByEmail: findActiveUser });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (expressApp) => {
          expressApp.get('/admin-only', auth('Administrador'), (_req, res) => {
            res.status(200).json({ ok: true });
          });
        },
      });

      const token = signTokenWithRemainingSeconds(2 * 60);
      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(findActiveUser).toHaveBeenCalledWith('admin@dima.local');
      expect(res.headers['set-authorization']).toBeUndefined();
    });
  });

  describe('OpenAPI Registration', () => {
    it('registers Login and GetTokenRemainingTime with text/plain for /tiempo', () => {
      const registry = new OpenAPIRegistry();
      registerAuthPaths(registry);

      const loginRoute = registry.definitions.find(
        (d) => d.type === 'route' && d.route.path === '/api/auth',
      );
      const tiempoRoute = registry.definitions.find(
        (d) => d.type === 'route' && d.route.path === '/api/auth/tiempo',
      );

      expect(loginRoute).toBeDefined();
      if (loginRoute && loginRoute.type === 'route') {
        expect(loginRoute.route.operationId).toBe('Login');
      }

      expect(tiempoRoute).toBeDefined();
      if (tiempoRoute && tiempoRoute.type === 'route') {
        expect(tiempoRoute.route.operationId).toBe('GetTokenRemainingTime');
        expect(tiempoRoute.route.security).toEqual([{ bearerAuth: [] }]);
        expect(tiempoRoute.route.responses[200]?.content?.['text/plain']).toBeDefined();
      }
    });
  });
});
