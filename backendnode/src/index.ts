import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { getEnv } from './config/env';

const appEnv = getEnv();

fs.mkdirSync(path.resolve(process.cwd(), 'log'), { recursive: true });
fs.mkdirSync(path.resolve(process.cwd(), 'uploads'), { recursive: true });

const app = createApp({
  corsOrigins: appEnv.CORS_ORIGINS,
  trustProxy: appEnv.TRUST_PROXY,
  nodeEnv: appEnv.NODE_ENV,
});

app.listen(appEnv.SERVER_PORT, () => {
  console.log(`Server listening on port ${appEnv.SERVER_PORT} (${appEnv.NODE_ENV})`);
});
