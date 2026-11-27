import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getTableConfig } from 'drizzle-orm/mysql-core';
import { afterEach, describe, expect, it } from 'vitest';
import {
  archivo,
  bitacora,
  categoria,
  categoriaproducto,
  pedido,
  pedidodetalle,
  producto,
  rol,
  usuario,
} from '../src/db/schema';
import {
  assertSafeAppUser,
  buildLeastPrivilegeStatements,
  validateAppHost,
  validateSqlIdentifier,
} from '../scripts/setup-db.mjs';
import {
  buildEnvContent,
  generateJwtSecret,
  runSetupEnv,
} from '../scripts/setup-env.mjs';

const BACKEND_ROOT = path.resolve(__dirname, '..');
const SCHEMA_SQL_PATH = path.join(BACKEND_ROOT, 'db', 'SCHEMA.sql');

function extractCreateTableBlock(sqlText: string, tableName: string): string {
  const pattern = new RegExp(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\`\\s*\\(([\\s\\S]*?)\\)\\s*ENGINE=InnoDB`,
    'i',
  );
  const match = sqlText.match(pattern);
  if (!match) {
    throw new Error(`Table ${tableName} not found in SCHEMA.sql`);
  }
  return match[1];
}

describe('B003 SCHEMA.sql & Automated Least-Privilege Setup Scripts', () => {
  describe('SCHEMA.sql <-> src/db/schema.ts parity', () => {
    const schemaSql = fs.readFileSync(SCHEMA_SQL_PATH, 'utf8');

    it.each([
      ['rol', rol],
      ['categoria', categoria],
      ['archivo', archivo],
      ['bitacora', bitacora],
      ['usuario', usuario],
      ['producto', producto],
      ['pedido', pedido],
      ['categoriaproducto', categoriaproducto],
      ['pedidodetalle', pedidodetalle],
    ])('defines table %s and every column from Drizzle schema', (tableName, table) => {
      const block = extractCreateTableBlock(schemaSql, tableName);
      const config = getTableConfig(table);

      for (const col of config.columns) {
        expect(block).toContain(`\`${col.name}\``);
      }
    });

    it('includes LONGBLOB, DECIMAL(10,2), composite PK, and exact ON DELETE rules', () => {
      const archivoBlock = extractCreateTableBlock(schemaSql, 'archivo');
      expect(archivoBlock).toMatch(/`datos`\s+LONGBLOB/i);

      const productoBlock = extractCreateTableBlock(schemaSql, 'producto');
      expect(productoBlock).toMatch(/`precio`\s+DECIMAL\(10,2\)\s+NOT NULL/i);
      expect(productoBlock).toMatch(
        /FOREIGN KEY\s+\(`archivoid`\)\s+REFERENCES\s+`archivo`\s+\(`id`\)\s+ON UPDATE CASCADE\s+ON DELETE SET NULL/i,
      );

      const usuarioBlock = extractCreateTableBlock(schemaSql, 'usuario');
      expect(usuarioBlock).toMatch(
        /FOREIGN KEY\s+\(`rolid`\)\s+REFERENCES\s+`rol`\s+\(`id`\)\s+ON UPDATE CASCADE\s+ON DELETE CASCADE/i,
      );

      const joinBlock = extractCreateTableBlock(schemaSql, 'categoriaproducto');
      expect(joinBlock).toMatch(/PRIMARY KEY\s+\(`categoriaid`,\s*`productoid`\)/i);
      expect(joinBlock).toMatch(
        /FOREIGN KEY\s+\(`categoriaid`\)\s+REFERENCES\s+`categoria`\s+\(`id`\)\s+ON UPDATE CASCADE\s+ON DELETE CASCADE/i,
      );
      expect(joinBlock).toMatch(
        /FOREIGN KEY\s+\(`productoid`\)\s+REFERENCES\s+`producto`\s+\(`id`\)\s+ON UPDATE CASCADE\s+ON DELETE CASCADE/i,
      );

      const pedidoBlock = extractCreateTableBlock(schemaSql, 'pedido');
      expect(pedidoBlock).toMatch(/`total`\s+DECIMAL\(10,2\)\s+NOT NULL/i);
      expect(pedidoBlock).toMatch(
        /FOREIGN KEY\s+\(`usuarioid`\)\s+REFERENCES\s+`usuario`\s+\(`id`\)\s+ON UPDATE CASCADE\s+ON DELETE CASCADE/i,
      );

      const detalleBlock = extractCreateTableBlock(schemaSql, 'pedidodetalle');
      expect(detalleBlock).toMatch(/`preciounitario`\s+DECIMAL\(10,2\)\s+NOT NULL/i);
      expect(detalleBlock).toMatch(
        /FOREIGN KEY\s+\(`pedidoid`\)\s+REFERENCES\s+`pedido`\s+\(`id`\)\s+ON UPDATE CASCADE\s+ON DELETE CASCADE/i,
      );
      expect(detalleBlock).toMatch(
        /FOREIGN KEY\s+\(`productoid`\)\s+REFERENCES\s+`producto`\s+\(`id`\)\s+ON UPDATE CASCADE\s+ON DELETE SET NULL/i,
      );
    });
  });

  describe('Zero credentials or DML in SCHEMA.sql', () => {
    const schemaSql = fs.readFileSync(SCHEMA_SQL_PATH, 'utf8');

    it.each([
      'CREATE USER',
      'IDENTIFIED BY',
      'GRANT',
      'INSERT INTO',
      'M3rc@d0',
      'patito',
    ])('does not contain %s', (forbidden) => {
      expect(schemaSql.toUpperCase()).not.toContain(forbidden.toUpperCase());
    });
  });

  describe('setup-env.mjs helpers', () => {
    const tempDirs: string[] = [];

    afterEach(() => {
      for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('generateJwtSecret() returns 70 lowercase hex characters', () => {
      const secret = generateJwtSecret();
      expect(secret).toMatch(/^[0-9a-f]{70}$/);
    });

    it('buildEnvContent() formats all expected environment keys', () => {
      const content = buildEnvContent({
        DB_USER: 'mercadolibre_user',
        DB_PASSWORD: 'strong_password_123',
        JWT_SECRET: 'a'.repeat(70),
      });
      expect(content).toContain('DB_USER=mercadolibre_user');
      expect(content).toContain('DB_PASSWORD=strong_password_123');
      expect(content).toContain(`JWT_SECRET=${'a'.repeat(70)}`);
    });

    it('runSetupEnv writes .env, refuses overwrite without force, overwrites with force, and rejects root', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dima-b003-'));
      tempDirs.push(tmpDir);
      const envPath = path.join(tmpDir, '.env');

      await expect(
        runSetupEnv({
          envPath,
          baseDir: tmpDir,
          nonInteractive: true,
          values: {
            DB_USER: 'root',
            DB_PASSWORD: 'some_password',
          },
        }),
      ).rejects.toThrow(/root/i);

      await runSetupEnv({
        envPath,
        baseDir: tmpDir,
        nonInteractive: true,
        values: {
          DB_USER: 'mercadolibre_user',
          DB_PASSWORD: 'initial_password',
        },
      });

      expect(fs.existsSync(envPath)).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'log'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'uploads'))).toBe(true);

      await expect(
        runSetupEnv({
          envPath,
          baseDir: tmpDir,
          nonInteractive: true,
          values: {
            DB_USER: 'mercadolibre_user',
            DB_PASSWORD: 'updated_password',
          },
        }),
      ).rejects.toThrow(/overwrite/i);

      await runSetupEnv({
        envPath,
        baseDir: tmpDir,
        force: true,
        nonInteractive: true,
        values: {
          DB_USER: 'mercadolibre_user',
          DB_PASSWORD: 'updated_password',
        },
      });

      const updated = fs.readFileSync(envPath, 'utf8');
      expect(updated).toContain('DB_PASSWORD=updated_password');
    });
  });

  describe('setup-db.mjs security helpers', () => {
    it('validateSqlIdentifier accepts valid names and rejects SQL injection attempts', () => {
      expect(validateSqlIdentifier('mercadolibrenode', 'DB_DATABASE')).toBe(
        'mercadolibrenode',
      );
      expect(validateSqlIdentifier('mercadolibre_user', 'DB_USER')).toBe(
        'mercadolibre_user',
      );

      expect(() => validateSqlIdentifier('foo; DROP TABLE rol;--')).toThrow();
      expect(() => validateSqlIdentifier("bad'user")).toThrow();
      expect(() => validateSqlIdentifier('')).toThrow();
      expect(() => validateSqlIdentifier('a'.repeat(65))).toThrow();
    });

    it('assertSafeAppUser rejects root regardless of casing', () => {
      expect(() => assertSafeAppUser('root')).toThrow(/root/i);
      expect(() => assertSafeAppUser('ROOT')).toThrow(/root/i);
      expect(assertSafeAppUser('mercadolibre_user')).toBe('mercadolibre_user');
    });

    it('buildLeastPrivilegeStatements grants only SELECT, INSERT, UPDATE, DELETE', () => {
      const stmts = buildLeastPrivilegeStatements({
        dbName: 'mercadolibrenode',
        dbUser: 'mercadolibre_user',
        dbPassword: "p@ss'word",
        host: 'localhost',
      });

      expect(stmts.createUser).toContain(
        "CREATE USER IF NOT EXISTS 'mercadolibre_user'@'localhost' IDENTIFIED BY",
      );
      expect(stmts.alterUser).toContain(
        "ALTER USER 'mercadolibre_user'@'localhost' IDENTIFIED BY",
      );
      expect(stmts.grantDml).toBe(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON `mercadolibrenode`.* TO 'mercadolibre_user'@'localhost'",
      );
      expect(stmts.grantDml.toUpperCase()).not.toContain('GRANT ALL');
      expect(stmts.flush).toBe('FLUSH PRIVILEGES');
    });

    it('validateAppHost accepts localhost, 127.0.0.1, and valid IPv4, and rejects wildcards/injection', () => {
      expect(validateAppHost('localhost')).toBe('localhost');
      expect(validateAppHost('127.0.0.1')).toBe('127.0.0.1');
      expect(validateAppHost('10.10.10.20')).toBe('10.10.10.20');

      expect(() => validateAppHost('%')).toThrow();
      expect(() => validateAppHost('999.1.1.1')).toThrow();
      expect(() => validateAppHost('10.10.10.20; DROP TABLE rol')).toThrow();

      const remoteStmts = buildLeastPrivilegeStatements({
        dbName: 'dima_db',
        dbUser: 'dima_app',
        dbPassword: 'strong_app_password',
        host: '10.10.10.20',
      });
      expect(remoteStmts.createUser).toContain("'dima_app'@'10.10.10.20'");
      expect(remoteStmts.grantDml).toBe(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON `dima_db`.* TO 'dima_app'@'10.10.10.20'",
      );
    });
  });

  describe('B011 Audit Remediation Regression Checks (AUD-B011-01, 04, 05, 06, 07)', () => {
    const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');
    const DEPLOY_DIR = path.join(BACKEND_ROOT, 'deploy');

    it('AUD-B011-01: deploy/README.md and deploy/*.sh never pass NODE_ENV=development to seed', () => {
      const filesToCheck = [
        path.join(DEPLOY_DIR, 'README.md'),
        ...fs
          .readdirSync(DEPLOY_DIR)
          .filter((name) => name.endsWith('.sh'))
          .map((name) => path.join(DEPLOY_DIR, name)),
      ];

      for (const filePath of filesToCheck) {
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).not.toMatch(/NODE_ENV=development[^\n]*seed/i);
      }
    });

    it('AUD-B011-04: SCHEMA.sql is DB-agnostic and default DB_DATABASE matches across deploy & .env.example', () => {
      const schemaSql = fs.readFileSync(SCHEMA_SQL_PATH, 'utf8');
      expect(schemaSql).not.toMatch(/^\s*CREATE\s+DATABASE\b/im);
      expect(schemaSql).not.toMatch(/^\s*USE\s+`/im);

      const installDb = fs.readFileSync(path.join(DEPLOY_DIR, 'install-db.sh'), 'utf8');
      const installApi = fs.readFileSync(path.join(DEPLOY_DIR, 'install-api.sh'), 'utf8');
      const backupSh = fs.readFileSync(path.join(DEPLOY_DIR, 'backup-db.sh'), 'utf8');
      const backupSvc = fs.readFileSync(path.join(DEPLOY_DIR, 'backup-db.service'), 'utf8');
      const envExample = fs.readFileSync(path.join(BACKEND_ROOT, '.env.example'), 'utf8');

      expect(installDb).toMatch(/mysql[^\n]*"\$DB_DATABASE"\s*<\s*"\$SCHEMA_SQL"/);
      expect(backupSh).toContain('umask 077');
      expect(installDb).toContain('wait-network.conf');

      const dbMatch = installDb.match(/DB_DATABASE="\$\{DB_DATABASE:-([^}]+)\}"/)?.[1];
      const apiMatch = installApi.match(/DB_DATABASE="\$\{DB_DATABASE:-([^}]+)\}"/)?.[1];
      const backupShMatch = backupSh.match(/DB_DATABASE="\$\{DB_DATABASE:-([^}]+)\}"/)?.[1];
      const backupSvcMatch = backupSvc.match(/Environment=DB_DATABASE=(\S+)/)?.[1];
      const envExampleMatch = envExample.match(/^DB_DATABASE=(\S+)/m)?.[1];

      expect(dbMatch).toBe('mercadolibrenode');
      expect(apiMatch).toBe(dbMatch);
      expect(backupShMatch).toBe(dbMatch);
      expect(backupSvcMatch).toBe(dbMatch);
      expect(envExampleMatch).toBe(dbMatch);
    });

    it('AUD-B011-05: backendnode/deploy/certs/ private keys are gitignored', () => {
      const status = execFileSync(
        'git',
        ['check-ignore', '-q', 'backendnode/deploy/certs/x.key'],
        { cwd: REPO_ROOT },
      );
      expect(status).toBeDefined();
    });

    it('AUD-B011-06 & AUD-B011-07: deploy scripts reject unsafe secret chars, avoid curl|bash, and scope SSH', () => {
      const installDb = fs.readFileSync(path.join(DEPLOY_DIR, 'install-db.sh'), 'utf8');
      const installApi = fs.readFileSync(path.join(DEPLOY_DIR, 'install-api.sh'), 'utf8');
      const backupSh = fs.readFileSync(path.join(DEPLOY_DIR, 'backup-db.sh'), 'utf8');

      expect(installDb).toContain('validate_secret "DB_APP_PASSWORD"');
      expect(installDb).toContain('REQUIRE SSL');
      expect(installApi).toContain('validate_secret "DB_PASSWORD"');
      expect(installApi).toContain('/usr/share/keyrings/nodesource.gpg');

      for (const script of [installDb, installApi, backupSh]) {
        expect(script).not.toMatch(/\|\s*bash\b/);
        expect(script).not.toMatch(/\bufw\s+allow\s+22\/tcp\b/);
      }
    });
  });
});
