import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_BACKEND_DIR = path.resolve(__dirname, '..');

/**
 * Generates a cryptographically strong 70-character lowercase hex JWT secret.
 */
export function generateJwtSecret() {
  return crypto.randomBytes(35).toString('hex');
}

/**
 * Validates environment values before writing .env.
 */
export function validateEnvValues(values) {
  const dbUser = String(values.DB_USER ?? '').trim();
  const dbPassword = String(values.DB_PASSWORD ?? '');

  if (!dbUser) {
    throw new Error('DB_USER must not be empty.');
  }
  if (dbUser.toLowerCase() === 'root') {
    throw new Error('DB_USER cannot be "root". Use a dedicated least-privilege MySQL user.');
  }
  if (!dbPassword) {
    throw new Error('DB_PASSWORD must not be empty.');
  }
}

/**
 * Formats key-value pairs into a .env file string matching .env.example.
 */
export function buildEnvContent(values) {
  const merged = {
    DB_HOST: values.DB_HOST ?? 'localhost',
    DB_DATABASE: values.DB_DATABASE ?? 'mercadolibrenode',
    DB_USER: values.DB_USER ?? 'mercadolibre_user',
    DB_PASSWORD: values.DB_PASSWORD ?? '',
    DB_PORT: String(values.DB_PORT ?? '3306'),
    SERVER_PORT: String(values.SERVER_PORT ?? '3000'),
    NODE_ENV: values.NODE_ENV ?? 'development',
    JWT_SECRET: values.JWT_SECRET ?? generateJwtSecret(),
    FILES_IN_BD: String(values.FILES_IN_BD ?? 'false'),
    CORS_ORIGINS: values.CORS_ORIGINS ?? 'http://localhost:8080,http://localhost:8081',
    TRUST_PROXY: String(values.TRUST_PROXY ?? 'false'),
  };

  return [
    `DB_HOST=${merged.DB_HOST}`,
    `DB_DATABASE=${merged.DB_DATABASE}`,
    `DB_USER=${merged.DB_USER}`,
    `DB_PASSWORD=${merged.DB_PASSWORD}`,
    `DB_PORT=${merged.DB_PORT}`,
    `SERVER_PORT=${merged.SERVER_PORT}`,
    `NODE_ENV=${merged.NODE_ENV}`,
    `JWT_SECRET=${merged.JWT_SECRET}`,
    `FILES_IN_BD=${merged.FILES_IN_BD}`,
    `CORS_ORIGINS=${merged.CORS_ORIGINS}`,
    `TRUST_PROXY=${merged.TRUST_PROXY}`,
    '',
  ].join('\n');
}

/**
 * Prompts the user for a single line, optionally masking input for secrets.
 */
function promptLine(question, { defaultValue = '', mask = false } = {}) {
  return new Promise((resolve) => {
    const suffix = defaultValue && !mask ? ` (${defaultValue})` : '';
    const promptText = `${question}${suffix}: `;

    if (!mask || !process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(promptText, (answer) => {
        rl.close();
        const trimmed = answer.trim();
        resolve(trimmed || defaultValue);
      });
      return;
    }

    process.stdout.write(promptText);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const onData = (char) => {
      if (char === '\r' || char === '\n' || char === '\u0004') {
        stdin.setRawMode(Boolean(wasRaw));
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value || defaultValue);
      } else if (char === '\u0003') {
        stdin.setRawMode(Boolean(wasRaw));
        process.stdout.write('\n');
        process.exit(1);
      } else if (char === '\u007f' || char === '\b') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        value += char;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

/**
 * Generates backendnode/.env and ensures runtime directories log/ and uploads/ exist.
 */
export async function runSetupEnv(options = {}) {
  const envPath = path.resolve(
    options.envPath ?? path.join(options.baseDir ?? DEFAULT_BACKEND_DIR, '.env'),
  );
  const baseDir = path.resolve(options.baseDir ?? path.dirname(envPath));
  const force = Boolean(options.force);
  const nonInteractive = Boolean(options.nonInteractive);

  if (fs.existsSync(envPath) && !force) {
    throw new Error(
      `Refusing to overwrite existing ${envPath}. Pass --force to regenerate it.`,
    );
  }

  let values = { ...(options.values ?? {}) };

  if (!nonInteractive && !options.values) {
    const dbHost = await promptLine('DB_HOST', { defaultValue: 'localhost' });
    const dbDatabase = await promptLine('DB_DATABASE', {
      defaultValue: 'mercadolibrenode',
    });
    const dbUser = await promptLine('DB_USER (non-root app user)', {
      defaultValue: 'mercadolibre_user',
    });
    const dbPassword = await promptLine('DB_PASSWORD (required)', {
      mask: true,
    });
    const dbPort = await promptLine('DB_PORT', { defaultValue: '3306' });
    const serverPort = await promptLine('SERVER_PORT', { defaultValue: '3000' });
    const nodeEnv = await promptLine('NODE_ENV', { defaultValue: 'development' });
    const filesInDb = await promptLine('FILES_IN_BD', { defaultValue: 'false' });
    const corsOrigins = await promptLine('CORS_ORIGINS', {
      defaultValue: 'http://localhost:8080,http://localhost:8081',
    });
    const trustProxy = await promptLine('TRUST_PROXY', { defaultValue: 'false' });

    values = {
      DB_HOST: dbHost,
      DB_DATABASE: dbDatabase,
      DB_USER: dbUser,
      DB_PASSWORD: dbPassword,
      DB_PORT: dbPort,
      SERVER_PORT: serverPort,
      NODE_ENV: nodeEnv,
      FILES_IN_BD: filesInDb,
      CORS_ORIGINS: corsOrigins,
      TRUST_PROXY: trustProxy,
    };
  } else if (nonInteractive && !options.values) {
    values = {
      DB_HOST: process.env.DB_HOST ?? 'localhost',
      DB_DATABASE: process.env.DB_DATABASE ?? 'mercadolibrenode',
      DB_USER: process.env.DB_USER ?? 'mercadolibre_user',
      DB_PASSWORD: process.env.DB_PASSWORD ?? '',
      DB_PORT: process.env.DB_PORT ?? '3306',
      SERVER_PORT: process.env.SERVER_PORT ?? '3000',
      NODE_ENV: process.env.NODE_ENV ?? 'development',
      JWT_SECRET: process.env.JWT_SECRET || generateJwtSecret(),
      FILES_IN_BD: process.env.FILES_IN_BD ?? 'false',
      CORS_ORIGINS:
        process.env.CORS_ORIGINS ?? 'http://localhost:8080,http://localhost:8081',
      TRUST_PROXY: process.env.TRUST_PROXY ?? 'false',
    };
  }

  if (!values.JWT_SECRET) {
    values.JWT_SECRET = generateJwtSecret();
  }

  validateEnvValues(values);

  const content = buildEnvContent(values);
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, content, { encoding: 'utf8', mode: 0o600 });

  const logDir = path.join(baseDir, 'log');
  const uploadsDir = path.join(baseDir, 'uploads');
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });

  return { envPath, logDir, uploadsDir };
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename);
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(__filename);
  }
}

if (isMainModule()) {
  const args = new Set(process.argv.slice(2));
  runSetupEnv({
    force: args.has('--force'),
    nonInteractive: args.has('--non-interactive'),
  })
    .then(({ envPath, logDir, uploadsDir }) => {
      console.log(`Created ${envPath}`);
      console.log(`Ensured runtime directories: ${logDir}, ${uploadsDir}`);
    })
    .catch((err) => {
      console.error(`setup:env failed: ${err.message}`);
      process.exit(1);
    });
}
