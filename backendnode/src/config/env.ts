import dotenv from 'dotenv';
import { z } from 'zod';

const DEFAULT_CORS_ORIGINS = ['http://localhost:8080', 'http://localhost:8081'];

export type TrustProxySetting = boolean | number | string | string[];

export function parseTrustProxy(raw: string | undefined): TrustProxySetting {
  if (!raw) {
    return false;
  }

  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'false') {
    return false;
  }
  if (trimmed.toLowerCase() === 'true') {
    return true;
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const items = trimmed
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (items.length === 0) {
    return false;
  }
  if (items.length === 1) {
    return items[0];
  }
  return items;
}

const EnvBaseSchema = z.object({
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_DATABASE: z.string().min(1, 'DB_DATABASE is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  DB_SSL_CA: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  SERVER_PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().trim().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  FILES_IN_BD: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value.trim() === '') {
        return DEFAULT_CORS_ORIGINS;
      }
      return value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
    }),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value) => parseTrustProxy(value)),
});

const EnvSchema = EnvBaseSchema.transform((data) => ({
  ...data,
  HOST:
    data.HOST && data.HOST.length > 0
      ? data.HOST
      : data.NODE_ENV === 'production'
        ? '127.0.0.1'
        : '0.0.0.0',
}));

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return EnvSchema.parse(source);
}

let cachedEnv: Env | null = null;
let dotenvLoaded = false;

export function getEnv(): Env {
  if (!dotenvLoaded) {
    dotenv.config();
    dotenvLoaded = true;
  }
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: keyof Env) {
    return getEnv()[prop];
  },
});
