import fs from 'node:fs';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql, { type Pool, type PoolOptions } from 'mysql2/promise';
import { getEnv } from '../config/env';
import * as schema from './schema';

export function createDbPool(config?: PoolOptions): Pool {
  if (config) {
    return mysql.createPool({
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      ...config,
    });
  }

  const env = getEnv();
  const poolOptions: PoolOptions = {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
  };

  if (env.DB_SSL) {
    poolOptions.ssl = env.DB_SSL_CA
      ? { ca: fs.readFileSync(env.DB_SSL_CA, 'utf8'), rejectUnauthorized: true }
      : { rejectUnauthorized: true };
  }

  return mysql.createPool(poolOptions);
}

export function createDb(pool?: Pool) {
  const activePool = pool ?? createDbPool();
  return drizzle(activePool, { schema, mode: 'default' });
}

export type DbClient = ReturnType<typeof createDb>;

let cachedPool: Pool | null = null;
let cachedDb: DbClient | null = null;

export function getDb(): DbClient {
  if (!cachedDb) {
    cachedPool = createDbPool();
    cachedDb = createDb(cachedPool);
  }
  return cachedDb;
}

export async function closeDb(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
    cachedDb = null;
  }
}

export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop: keyof DbClient) {
    const instance = getDb();
    const value = instance[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
