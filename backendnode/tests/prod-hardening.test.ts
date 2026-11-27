import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { parseEnv, parseTrustProxy } from '../src/config/env';
import {
  createAuthRateLimiter,
  createLoginIpRateLimiter,
  createRegisterRateLimiter,
  extractClientIp,
} from '../src/middlewares/ratelimit.middleware';
import { createAuthRouter } from '../src/routes/auth.routes';
import { createCategoriasRouter } from '../src/routes/categorias.routes';
import { AuthService } from '../src/services/auth.service';
import type { IBitacoraService } from '../src/services/bitacora.service';
import type { ICategoriasService } from '../src/services/categorias.service';
import { createJwtTokenService } from '../src/services/jwttoken.service';

const BACKEND_ROOT = path.resolve(__dirname, '..');
const DEPLOY_DIR = path.join(BACKEND_ROOT, 'deploy');

const validBaseEnv: NodeJS.ProcessEnv = {
  DB_HOST: 'localhost',
  DB_DATABASE: 'dima_test',
  DB_USER: 'test_user',
  DB_PASSWORD: 'test_password_placeholder',
  DB_PORT: '3306',
  SERVER_PORT: '3000',
  NODE_ENV: 'test',
  JWT_SECRET: 'a'.repeat(32),
  FILES_IN_BD: 'false',
};

describe('B011 Production Hardening, Proxy-Aware Rate Limit & Deploy Templates', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempLogFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dima-b011-'));
    tempDirs.push(dir);
    return path.join(dir, 'log.txt');
  }

  describe('env.ts HOST, TRUST_PROXY, and DB_SSL parsing', () => {
    it('defaults HOST to 127.0.0.1 in production and 0.0.0.0 in development/test', () => {
      expect(parseEnv({ ...validBaseEnv, NODE_ENV: 'production' }).HOST).toBe('127.0.0.1');
      expect(parseEnv({ ...validBaseEnv, NODE_ENV: 'development' }).HOST).toBe('0.0.0.0');
      expect(parseEnv({ ...validBaseEnv, NODE_ENV: 'test' }).HOST).toBe('0.0.0.0');
      expect(
        parseEnv({ ...validBaseEnv, NODE_ENV: 'production', HOST: '10.10.10.20' }).HOST,
      ).toBe('10.10.10.20');
    });

    it('parses TRUST_PROXY booleans, hop counts, single strings, and comma-separated lists', () => {
      expect(parseTrustProxy(undefined)).toBe(false);
      expect(parseTrustProxy('')).toBe(false);
      expect(parseTrustProxy('false')).toBe(false);
      expect(parseTrustProxy('true')).toBe(true);
      expect(parseTrustProxy('1')).toBe(1);
      expect(parseTrustProxy('2')).toBe(2);
      expect(parseTrustProxy('loopback')).toBe('loopback');
      expect(parseTrustProxy('loopback, 10.10.10.10')).toEqual(['loopback', '10.10.10.10']);

      const parsed = parseEnv({
        ...validBaseEnv,
        TRUST_PROXY: 'loopback,10.10.10.10',
        DB_SSL: 'true',
        DB_SSL_CA: '/etc/ssl/dima/dima-lab-ca.crt',
      });
      expect(parsed.TRUST_PROXY).toEqual(['loopback', '10.10.10.10']);
      expect(parsed.DB_SSL).toBe(true);
      expect(parsed.DB_SSL_CA).toBe('/etc/ssl/dima/dima-lab-ca.crt');
    });
  });

  describe('Express trust proxy & extractClientIp', () => {
    it('resolves browser IP from X-Forwarded-For when trustProxy includes loopback and 10.10.10.10', async () => {
      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'production',
        trustProxy: ['loopback', '10.10.10.10'],
        mountDefaultApiRoutes: false,
        registerRoutes: (instance) => {
          instance.get('/ip', (req, res) => {
            res.status(200).json({ ip: extractClientIp(req) });
          });
        },
      });

      const res = await request(app)
        .get('/ip')
        .set('X-Forwarded-For', '203.0.113.50, 10.10.10.10');

      expect(res.status).toBe(200);
      expect(res.body.ip).toBe('203.0.113.50');
    });

    it('ignores spoofed X-Forwarded-For when trustProxy is false', async () => {
      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'production',
        trustProxy: false,
        mountDefaultApiRoutes: false,
        registerRoutes: (instance) => {
          instance.get('/ip', (req, res) => {
            res.status(200).json({ ip: extractClientIp(req) });
          });
        },
      });

      const res = await request(app)
        .get('/ip')
        .set('X-Forwarded-For', '203.0.113.50');

      expect(res.status).toBe(200);
      expect(res.body.ip).not.toBe('203.0.113.50');
    });
  });

  describe('Composite ${ip}:${normalizedEmail} login rate limiter', () => {
    it('locks out alice@uv.mx after max attempts without locking out bob@uv.mx from the same proxy IP', async () => {
      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'production',
        trustProxy: ['loopback', '10.10.10.10'],
        mountDefaultApiRoutes: false,
        registerRoutes: (instance) => {
          instance.post(
            '/api/auth',
            createAuthRateLimiter({ windowMs: 60_000, max: 2 }),
            (_req, res) => {
              res.status(200).json({ ok: true });
            },
          );
        },
      });

      const a1 = await request(app)
        .post('/api/auth')
        .set('X-Forwarded-For', '198.51.100.10, 10.10.10.10')
        .send({ email: 'Alice@uv.mx', password: 'wrong' });
      const a2 = await request(app)
        .post('/api/auth')
        .set('X-Forwarded-For', '198.51.100.10, 10.10.10.10')
        .send({ email: 'alice@uv.mx', password: 'wrong' });
      const a3 = await request(app)
        .post('/api/auth')
        .set('X-Forwarded-For', '198.51.100.10, 10.10.10.10')
        .send({ email: 'alice@uv.mx', password: 'wrong' });

      const b1 = await request(app)
        .post('/api/auth')
        .set('X-Forwarded-For', '198.51.100.10, 10.10.10.10')
        .send({ email: 'bob@uv.mx', password: 'wrong' });

      expect(a1.status).toBe(200);
      expect(a2.status).toBe(200);
      expect(a3.status).toBe(429);
      expect(b1.status).toBe(200);
    });
  });

  describe('backendnode/deploy/ templates', () => {
    const expectedFiles = [
      'backendnode.service',
      'nginx-api.conf',
      'install-api.sh',
      'install-db.sh',
      'backup-db.sh',
      'backup-db.service',
      'backup-db.timer',
      'README.md',
    ];

    it.each(expectedFiles)('includes %s without hardcoded secrets', (fileName) => {
      const fullPath = path.join(DEPLOY_DIR, fileName);
      expect(fs.existsSync(fullPath)).toBe(true);

      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content).not.toContain('M3rc@d0');
      expect(content).not.toContain('patito');
      expect(content).not.toMatch(/IDENTIFIED\s+BY\s+['"][^$]/i);
      expect(content).not.toMatch(/\bmysql(?:dump)?\b[^\n]*\s-p[^\s]/i);
    });

    it('configures nginx-api.conf on port 443 only (no port 80 listener)', () => {
      const nginxConf = fs.readFileSync(path.join(DEPLOY_DIR, 'nginx-api.conf'), 'utf8');
      expect(nginxConf).toContain('listen 443 ssl');
      expect(nginxConf).not.toMatch(/listen\s+80\b/);
      expect(nginxConf).toContain('proxy_pass http://127.0.0.1:3000');
      expect(nginxConf).toContain('$proxy_add_x_forwarded_for');
    });
  });

  describe('AUD-B011-02: Controller audit IP ignores spoofed headers when trustProxy is false', () => {
    function collectTsFiles(dir: string): string[] {
      const results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...collectTsFiles(fullPath));
        } else if (entry.name.endsWith('.ts')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    it('contains zero occurrences of request-ip anywhere in backendnode/src/', () => {
      const srcFiles = collectTsFiles(path.join(BACKEND_ROOT, 'src'));
      expect(srcFiles.length).toBeGreaterThan(0);
      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        expect(content).not.toContain('request-ip');
      }
    });

    it('records socket IP (ignoring X-Client-IP and X-Forwarded-For) on failed login and admin mutation', async () => {
      const passwordHash = await bcrypt.hash('ValidPass123!', 4);
      const registrarMock = vi.fn(async () => {});
      const bitacora: IBitacoraService = {
        registrar: registrarMock,
        getAll: vi.fn(async () => []),
      };
      const jwtService = createJwtTokenService('a'.repeat(32));

      const authService = new AuthService({
        findUserByEmail: async (email) =>
          email === 'admin@dima.local'
            ? {
                email: 'admin@dima.local',
                nombre: 'Admin',
                passwordhash: passwordHash,
                rol: 'Administrador',
              }
            : null,
        jwtService,
        bitacora,
      });

      const categoriasService: ICategoriasService = {
        getAll: async () => [],
        getById: async () => null,
        create: async (input, audit) => {
          await bitacora.registrar({
            accion: 'categoria.crear',
            elementoid: '1',
            ip: audit.ip,
            usuario: audit.actorEmail,
          });
          return { id: 1, nombre: input.nombre, protegida: false };
        },
        update: async () => {},
        delete: async () => {},
      };

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'production',
        trustProxy: false,
        mountDefaultApiRoutes: false,
        registerRoutes: (instance) => {
          instance.use(
            '/api/auth',
            createAuthRouter({
              service: authService,
              loginIpRateLimiter: createLoginIpRateLimiter({ max: 50 }),
              rateLimiter: createAuthRateLimiter({ max: 50 }),
            }),
          );
          instance.use(
            '/api/categorias',
            createCategoriasRouter({
              service: categoriasService,
              authorizeMiddleware: () => (req, _res, next) => {
                req.decodedToken = {
                  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'admin@dima.local',
                };
                next();
              },
            }),
          );
        },
      });

      const loginRes = await request(app)
        .post('/api/auth')
        .set('X-Client-IP', '6.6.6.6')
        .set('X-Forwarded-For', '7.7.7.7')
        .send({ email: 'admin@dima.local', password: 'wrong-password' });
      expect(loginRes.status).toBe(401);

      const catRes = await request(app)
        .post('/api/categorias')
        .set('X-Client-IP', '6.6.6.6')
        .set('X-Forwarded-For', '7.7.7.7')
        .send({ nombre: 'Audited Cat' });
      expect(catRes.status).toBe(201);

      expect(registrarMock).toHaveBeenCalledTimes(2);
      for (const call of registrarMock.mock.calls as Array<[{ ip: string }]>) {
        expect(call[0].ip).not.toBe('6.6.6.6');
        expect(call[0].ip).not.toBe('7.7.7.7');
        expect(call[0].ip).toMatch(/127\.0\.0\.1|::1/);
      }
    });
  });

  describe('AUD-B011-03: Dual-layer login rate limit & IP-only registration limit', () => {
    it('blocks distinct-email password spraying with 429 once per-IP ceiling is reached', async () => {
      const authService = new AuthService({
        findUserByEmail: async () => null,
        jwtService: createJwtTokenService('a'.repeat(32)),
        bitacora: { registrar: vi.fn(async () => {}), getAll: vi.fn(async () => []) },
      });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'production',
        trustProxy: ['loopback', '10.10.10.10'],
        mountDefaultApiRoutes: false,
        registerRoutes: (instance) => {
          instance.use(
            '/api/auth',
            createAuthRouter({
              service: authService,
              loginIpRateLimiter: createLoginIpRateLimiter({ windowMs: 60_000, max: 3 }),
              rateLimiter: createAuthRateLimiter({ windowMs: 60_000, max: 10 }),
            }),
          );
        },
      });

      for (let i = 1; i <= 3; i += 1) {
        const res = await request(app)
          .post('/api/auth')
          .set('X-Forwarded-For', '198.51.100.77, 10.10.10.10')
          .send({ email: `spray${i}@uv.mx`, password: 'wrong' });
        expect(res.status).toBe(401);
      }

      const blocked = await request(app)
        .post('/api/auth')
        .set('X-Forwarded-For', '198.51.100.77, 10.10.10.10')
        .send({ email: 'spray4@uv.mx', password: 'wrong' });
      expect(blocked.status).toBe(429);
    });

    it('blocks mass registration across distinct emails on the 6th attempt from the same IP', async () => {
      const authService = new AuthService({
        findUserByEmail: async () => null,
        insertRegisteredUser: vi.fn(async () => {}),
        rolesService: {
          getAll: async () => [{ id: '22222222-2222-4222-8222-222222222222', nombre: 'Usuario' }],
          findByNombre: async () => ({
            id: '22222222-2222-4222-8222-222222222222',
            nombre: 'Usuario',
          }),
        },
        jwtService: createJwtTokenService('a'.repeat(32)),
        bitacora: { registrar: vi.fn(async () => {}), getAll: vi.fn(async () => []) },
      });

      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'production',
        trustProxy: ['loopback', '10.10.10.10'],
        mountDefaultApiRoutes: false,
        registerRoutes: (instance) => {
          instance.use(
            '/api/auth',
            createAuthRouter({
              service: authService,
              registerRateLimiter: createRegisterRateLimiter({ windowMs: 60_000, max: 5 }),
            }),
          );
        },
      });

      for (let i = 1; i <= 5; i += 1) {
        const res = await request(app)
          .post('/api/auth/registro')
          .set('X-Forwarded-For', '198.51.100.88, 10.10.10.10')
          .send({
            email: `bot${i}@dima.local`,
            nombre: `Bot ${i}`,
            password: 'Segura2026!Ab',
          });
        expect(res.status).toBe(201);
      }

      const sixth = await request(app)
        .post('/api/auth/registro')
        .set('X-Forwarded-For', '198.51.100.88, 10.10.10.10')
        .send({
          email: 'bot6@dima.local',
          nombre: 'Bot 6',
          password: 'Segura2026!Ab',
        });
      expect(sixth.status).toBe(429);
    });
  });
});
