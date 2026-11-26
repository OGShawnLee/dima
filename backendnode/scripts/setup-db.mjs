import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_BACKEND_DIR = path.resolve(__dirname, '..');

const IDENTIFIER_RE = /^[a-zA-Z0-9_]{1,64}$/;
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * Strictly validates a SQL identifier (database or username) against an allowlist.
 */
export function validateSqlIdentifier(name, label = 'identifier') {
  if (typeof name !== 'string' || !IDENTIFIER_RE.test(name)) {
    throw new Error(
      `Invalid ${label}: must match /^[a-zA-Z0-9_]{1,64}$/.`,
    );
  }
  return name;
}

/**
 * Rejects 'root' (case-insensitive) so the runtime app never uses superuser credentials.
 */
export function assertSafeAppUser(user) {
  if (typeof user !== 'string' || user.trim().toLowerCase() === 'root') {
    throw new Error('Refusing to configure "root" as the application DB_USER.');
  }
  return validateSqlIdentifier(user, 'DB_USER');
}

/**
 * Builds validated least-privilege MySQL statements for the application user.
 */
export function buildLeastPrivilegeStatements({
  dbName,
  dbUser,
  dbPassword,
  host = 'localhost',
}) {
  const safeDb = validateSqlIdentifier(dbName, 'DB_DATABASE');
  const safeUser = assertSafeAppUser(dbUser);

  if (typeof host !== 'string' || !ALLOWED_HOSTS.has(host)) {
    throw new Error(`Invalid DB host "${host}": must be "localhost" or "127.0.0.1".`);
  }
  if (typeof dbPassword !== 'string' || dbPassword.length === 0) {
    throw new Error('DB_PASSWORD must be a non-empty string.');
  }

  const escapedPassword = mysql.escape(dbPassword);
  const account = `'${safeUser}'@'${host}'`;

  return {
    createUser: `CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ${escapedPassword}`,
    alterUser: `ALTER USER ${account} IDENTIFIED BY ${escapedPassword}`,
    revokePrior: `REVOKE ALL PRIVILEGES, GRANT OPTION FROM ${account}`,
    grantDml: `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${safeDb}\`.* TO ${account}`,
    flush: 'FLUSH PRIVILEGES',
  };
}

/**
 * Prompts for a password with masked terminal output.
 */
function promptMaskedPassword(promptText) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(promptText, (answer) => {
        rl.close();
        resolve(answer);
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
        resolve(value);
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
 * Applies db/SCHEMA.sql and configures the least-privilege MySQL application user.
 */
export async function runSetupDb(options = {}) {
  const baseDir = path.resolve(options.baseDir ?? DEFAULT_BACKEND_DIR);
  const envPath = path.resolve(options.envPath ?? path.join(baseDir, '.env'));
  const schemaPath = path.resolve(
    options.schemaPath ?? path.join(baseDir, 'db', 'SCHEMA.sql'),
  );
  const nonInteractive = Boolean(options.nonInteractive);
  const shouldSeed = Boolean(options.seed);

  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${envPath}. Run "npm run setup:env" first.`);
  }
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Missing ${schemaPath}.`);
  }

  const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
  const dbHost = parsed.DB_HOST || 'localhost';
  const dbPort = Number(parsed.DB_PORT || 3306);
  const dbName = validateSqlIdentifier(parsed.DB_DATABASE, 'DB_DATABASE');
  const dbUser = assertSafeAppUser(parsed.DB_USER);
  const dbPassword = parsed.DB_PASSWORD;
  const nodeEnv = parsed.NODE_ENV || process.env.NODE_ENV || 'development';

  if (shouldSeed && nodeEnv === 'production') {
    throw new Error('Refusing to run --seed when NODE_ENV=production.');
  }

  const rootPassword = nonInteractive
    ? (process.env.MYSQL_ROOT_PASSWORD ?? '')
    : await promptMaskedPassword('MySQL root password: ');

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // 1. Apply static SCHEMA.sql with multipleStatements: true
  const ddlConnection = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: 'root',
    password: rootPassword,
    multipleStatements: true,
  });

  try {
    await ddlConnection.query(schemaSql);
  } finally {
    await ddlConnection.end();
  }

  // 2. Apply validated user and least-privilege grants with multipleStatements: false
  const statements = buildLeastPrivilegeStatements({
    dbName,
    dbUser,
    dbPassword,
    host: ALLOWED_HOSTS.has(dbHost) ? dbHost : 'localhost',
  });

  const adminConnection = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: 'root',
    password: rootPassword,
    multipleStatements: false,
  });

  try {
    await adminConnection.query(statements.createUser);
    await adminConnection.query(statements.alterUser);
    try {
      await adminConnection.query(statements.revokePrior);
    } catch (err) {
      // ER_NONEXISTING_GRANT (1141) is expected if the user has no prior grants.
      if (err?.errno !== 1141 && err?.code !== 'ER_NONEXISTING_GRANT') {
        throw err;
      }
    }
    await adminConnection.query(statements.grantDml);
    await adminConnection.query(statements.flush);
  } finally {
    await adminConnection.end();
  }

  if (shouldSeed) {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npmCmd, ['run', 'db:seed'], {
      cwd: baseDir,
      stdio: 'inherit',
      env: { ...process.env, ...parsed },
    });
    if (result.status !== 0) {
      throw new Error(`db:seed exited with status ${result.status ?? 1}.`);
    }
  }
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
  runSetupDb({
    nonInteractive: args.has('--non-interactive'),
    seed: args.has('--seed'),
  })
    .then(() => {
      console.log('Database schema and least-privilege user configured successfully.');
    })
    .catch((err) => {
      console.error(`setup:db failed: ${err.message}`);
      process.exit(1);
    });
}
