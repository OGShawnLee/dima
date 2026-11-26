import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app';
import { parseEnv } from '../src/config/env';
import { createAuthRateLimiter } from '../src/middlewares/ratelimit.middleware';
import { validate } from '../src/middlewares/validate.middleware';
import { HttpError } from '../src/utils/httpError';

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

describe('B001 Core Security Pipeline & Scaffold', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempLogFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dima-b001-'));
    tempDirs.push(dir);
    return path.join(dir, 'log.txt');
  }

  describe('parseEnv', () => {
    it('fails fast when JWT_SECRET is missing', () => {
      const { JWT_SECRET: _omitted, ...envWithoutSecret } = validBaseEnv;
      expect(() => parseEnv(envWithoutSecret)).toThrow();
    });

    it('fails fast when JWT_SECRET is shorter than 32 characters', () => {
      expect(() =>
        parseEnv({
          ...validBaseEnv,
          JWT_SECRET: 'too-short-secret',
        }),
      ).toThrow();
    });

    it('parses FILES_IN_BD true/false strings into booleans and applies defaults', () => {
      const parsedTrue = parseEnv({ ...validBaseEnv, FILES_IN_BD: 'true' });
      const parsedFalse = parseEnv({ ...validBaseEnv, FILES_IN_BD: 'false' });

      expect(parsedTrue.FILES_IN_BD).toBe(true);
      expect(parsedFalse.FILES_IN_BD).toBe(false);
      expect(parsedFalse.DB_PORT).toBe(3306);
      expect(parsedFalse.SERVER_PORT).toBe(3000);
      expect(parsedFalse.CORS_ORIGINS).toEqual([
        'http://localhost:8080',
        'http://localhost:8081',
      ]);
      expect(parsedFalse.TRUST_PROXY).toBe(false);
    });
  });

  describe('Security Headers & Health', () => {
    it('returns 200 { status: "ok" }, omits x-powered-by, and sets x-content-type-options: nosniff', async () => {
      const app = createApp({ logFilePath: createTempLogFile(), nodeEnv: 'test' });
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('CORS Policy', () => {
    it('exposes Set-Authorization for allowed origins', async () => {
      const app = createApp({ logFilePath: createTempLogFile(), nodeEnv: 'test' });
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:8080');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:8080');
      expect(res.headers['access-control-expose-headers']).toContain('Set-Authorization');
    });

    it('does not set Access-Control-Allow-Origin for disallowed origins', async () => {
      const app = createApp({ logFilePath: createTempLogFile(), nodeEnv: 'test' });
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://evil.example.com');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Body Size Limit (100kb)', () => {
    it('rejects JSON payloads larger than 100kb with 413', async () => {
      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (instance) => {
          instance.post('/test-limit', (req, res) => {
            res.status(200).json({ size: JSON.stringify(req.body).length });
          });
        },
      });

      const oversizedPayload = { data: 'x'.repeat(110 * 1024) };
      const res = await request(app).post('/test-limit').send(oversizedPayload);

      expect(res.status).toBe(413);
    });
  });

  describe('validate middleware', () => {
    const TestBodySchema = z.object({
      nombre: z.string().min(1),
    });

    it('strips unknown keys from req.body (mass-assignment defense)', async () => {
      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (instance) => {
          instance.post('/test-validate', validate({ body: TestBodySchema }), (req, res) => {
            res.status(200).json(req.body);
          });
        },
      });

      const res = await request(app)
        .post('/test-validate')
        .send({ nombre: 'Laptops', protegida: true, extra: 'malicious' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ nombre: 'Laptops' });
      expect(res.body.protegida).toBeUndefined();
      expect(res.body.extra).toBeUndefined();
    });

    it('maps ZodError to 400 with detalles (never 500)', async () => {
      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (instance) => {
          instance.post('/test-validate', validate({ body: TestBodySchema }), (req, res) => {
            res.status(200).json(req.body);
          });
        },
      });

      const res = await request(app).post('/test-validate').send({ nombre: '' });

      expect(res.status).toBe(400);
      expect(res.body.mensaje).toBe('Datos de entrada inválidos.');
      expect(Array.isArray(res.body.detalles)).toBe(true);
      expect(res.body.detalles[0]).toMatchObject({ path: 'nombre' });
    });
  });

  describe('Catch-all 404 handler', () => {
    it.each(['get', 'post', 'put', 'delete'] as const)(
      'returns 404 "Recurso no encontrado" for %s on unknown route',
      async (method) => {
        const app = createApp({ logFilePath: createTempLogFile(), nodeEnv: 'test' });
        const res = await request(app)[method]('/api/nonexistent-route');

        expect(res.status).toBe(404);
        expect(res.text).toBe('Recurso no encontrado');
      },
    );
  });

  describe('errorHandler & CRLF log injection prevention', () => {
    it('includes stack in development mode', async () => {
      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'development',
        registerRoutes: (instance) => {
          instance.get('/boom', () => {
            throw new HttpError(400, 'Error controlado');
          });
        },
      });

      const res = await request(app).get('/boom');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(400);
      expect(res.body.mensaje).toBe('Error controlado');
      expect(typeof res.body.stack).toBe('string');
    });

    it('omits stack and raw internal error details on 500 in production mode', async () => {
      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'production',
        registerRoutes: (instance) => {
          instance.get('/boom', () => {
            throw new Error('ECONNREFUSED mysql://secret-internal-host');
          });
        },
      });

      const res = await request(app).get('/boom');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        mensaje: 'No se ha podido procesar la petición. Inténtelo nuevamente más tarde.',
      });
      expect(res.body.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    });

    it('sanitizes CRLF characters in error messages to prevent CWE-117 log injection', async () => {
      const logFilePath = createTempLogFile();
      const app = createApp({
        logFilePath,
        nodeEnv: 'production',
        registerRoutes: (instance) => {
          instance.get('/crlf', () => {
            throw new Error('Bad input\r\nFAKE LOG LINE\nANOTHER LINE');
          });
        },
      });

      const res = await request(app).get('/crlf');
      expect(res.status).toBe(500);

      const content = fs.readFileSync(logFilePath, 'utf8');
      const lines = content.trimEnd().split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).not.toContain('\r');
      expect(lines[0]).toContain('Bad inputFAKE LOG LINEANOTHER LINE');
    });
  });

  describe('createAuthRateLimiter', () => {
    it('returns 429 after exceeding configured max requests', async () => {
      const app = createApp({
        logFilePath: createTempLogFile(),
        nodeEnv: 'test',
        registerRoutes: (instance) => {
          instance.post('/api/auth', createAuthRateLimiter({ windowMs: 60_000, max: 2 }), (_req, res) => {
            res.status(200).json({ ok: true });
          });
        },
      });

      const first = await request(app).post('/api/auth').send({});
      const second = await request(app).post('/api/auth').send({});
      const third = await request(app).post('/api/auth').send({});

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(429);
      expect(third.body).toEqual({
        mensaje: 'Demasiados intentos de inicio de sesión. Inténtelo nuevamente más tarde.',
      });
    });
  });
});
