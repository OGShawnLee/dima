import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { parseEnv, parseTrustProxy } from '../src/config/env';
import { createAuthRateLimiter, extractClientIp } from '../src/middlewares/ratelimit.middleware';

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
});
