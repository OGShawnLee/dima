import dotenv from 'dotenv';
import { z } from 'zod';

const DEFAULT_CORS_ORIGINS = ['http://localhost:8080', 'http://localhost:8081'];

const EnvSchema = z.object({
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_DATABASE: z.string().min(1, 'DB_DATABASE is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  SERVER_PORT: z.coerce.number().int().positive().default(3000),
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
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

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
