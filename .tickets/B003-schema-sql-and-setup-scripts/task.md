# B003 — `SCHEMA.sql` & Automated Least-Privilege Setup Scripts

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B003` | `completed` | `Gemini 4 Hydrogen (Medium)` | `Shared` | Database DDL (`SCHEMA.sql`) & environment/DB bootstrap scripts | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-002` & `DEC-012` — Authoritative pure-DDL `backendnode/db/SCHEMA.sql` allowlisted in `.gitignore` (`!backendnode/db/SCHEMA.sql`) with zero `CREATE USER`, passwords, or data dumps.
- `DEC-012` — `npm run setup:env` generates a cryptographically strong 70-char hex `JWT_SECRET` (`crypto.randomBytes(35).toString('hex')`) and never overwrites an existing `.env` without `--force`.
- `DEC-012` — `npm run setup:db` configures the local MySQL app user with **least-privilege runtime grants** (`SELECT, INSERT, UPDATE, DELETE` only, per PDF p. 9), strictly allowlist-validates SQL identifiers (`/^[a-zA-Z0-9_]{1,64}$/`), refuses `root` as the app user, and masks the one-time `root` password prompt.

## Scope

### May create or edit
- `.gitignore` (only add `!backendnode/db/SCHEMA.sql` directly beneath `*.sql`)
- `backendnode/package.json` (only add `"setup:env"` and `"setup:db"` scripts — do not change dependencies)
- `backendnode/db/SCHEMA.sql`
- `backendnode/scripts/setup-env.mjs`
- `backendnode/scripts/setup-db.mjs`
- `backendnode/README.md`
- `backendnode/tests/setup.test.ts`
- `.tickets/B003-schema-sql-and-setup-scripts/changelog.md`

### Must not touch
- `backendnode/src/**` (do not modify `B001`/`B002` source files)
- `backendnode/tests/core.test.ts`, `backendnode/tests/db.test.ts`
- `.routing/**`
- `.gemini/**`
- `frontendnet/**`
- `.tickets/B001-project-scaffold/**`, `.tickets/B002-database-schema-seed/**`, `.tickets/B004-auth-and-bitacora/**`
- `.tickets/B003-schema-sql-and-setup-scripts/task.md`, `spec.md`, or `audit.md`

## Inputs

Read these files first before writing code:
1. [.routing/CONTEXT.md](../../.routing/CONTEXT.md)
2. [.routing/DECISION.md](../../.routing/DECISION.md) (`DEC-002`, `DEC-012`)
3. [.routing/SERVICES.md](../../.routing/SERVICES.md) (Layer 0 → Layer 1 → Layer 2 dependency order)
4. [backendnode/src/db/schema.ts](../../backendnode/src/db/schema.ts) (must stay 1:1 aligned with `SCHEMA.sql`)
5. [backendnode/.env.example](../../backendnode/.env.example)

## Task

1. Update root `.gitignore` to add `!backendnode/db/SCHEMA.sql` right after `*.sql` so only `backendnode/db/SCHEMA.sql` is tracked while all other `.sql` files stay ignored.
2. Create `backendnode/db/SCHEMA.sql` containing **pure MySQL 8.0 DDL only** (no `CREATE USER`, no `GRANT`, no `IDENTIFIED BY`, no `INSERT`):
   - `CREATE DATABASE IF NOT EXISTS \`mercadolibrenode\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
   - `USE \`mercadolibrenode\`;`
   - All 7 `CREATE TABLE IF NOT EXISTS` statements in Layer order (`rol`, `categoria`, `archivo`, `bitacora`, `usuario`, `producto`, `categoriaproducto`) matching `backendnode/src/db/schema.ts` 1:1 (exact column names, types including `LONGBLOB` and `DECIMAL(10,2)`, `NOT NULL`, `DEFAULT`, `UNIQUE` on `rol.nombre` and `usuario.email`, composite PK `(categoriaid, productoid)`, `createdAt`/`updatedAt` with `CURRENT_TIMESTAMP` / `ON UPDATE CURRENT_TIMESTAMP`, and all 4 `FOREIGN KEY` constraints with exact `ON UPDATE` / `ON DELETE` rules, `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).
3. Create `backendnode/scripts/setup-env.mjs` exporting testable pure helpers (`generateJwtSecret()`, `buildEnvContent(values)`, `runSetupEnv(options)`) and a CLI entrypoint guarded with `isMainModule`:
   - Refuses to overwrite an existing `backendnode/.env` unless `--force` is passed.
   - Generates a fresh 70-char hex `JWT_SECRET` using `crypto.randomBytes(35).toString('hex')`.
   - Supports interactive prompts (with masked password input for `DB_PASSWORD`) AND non-interactive flags/options (`--non-interactive`, defaults or env overrides) for tests/automation.
   - Rejects empty `DB_PASSWORD` or `DB_USER === 'root'`.
   - Creates `backendnode/log/` and `backendnode/uploads/` (`fs.mkdirSync(..., { recursive: true })`).
4. Create `backendnode/scripts/setup-db.mjs` exporting testable pure helpers (`validateSqlIdentifier(name, label)`, `assertSafeAppUser(user)`, `buildLeastPrivilegeStatements({ dbName, dbUser, dbPassword, host })`) and a CLI entrypoint guarded with `isMainModule`:
   - `validateSqlIdentifier`: strictly allows `/^[a-zA-Z0-9_]{1,64}$/` and throws on invalid characters (quotes, semicolons, backticks, spaces, empty strings).
   - `assertSafeAppUser`: rejects `'root'` (case-insensitive) so the application never runs with superuser DB credentials.
   - `buildLeastPrivilegeStatements`: validates `dbName`, `dbUser`, and `host` (`'localhost'` or `'127.0.0.1'`), escapes password safely with `mysql.escape(dbPassword)`, and returns exact SQL statements to:
     1. `CREATE USER IF NOT EXISTS ... IDENTIFIED BY ...`
     2. `ALTER USER ... IDENTIFIED BY ...`
     3. Revoke prior privileges (safely handled when running) and `GRANT SELECT, INSERT, UPDATE, DELETE ON \`<dbName>\`.* TO '<dbUser>'@'<host>'`
     4. `FLUSH PRIVILEGES`
   - When executed as CLI: reads `backendnode/.env`, prompts with masked input for MySQL `root` password (or reads `MYSQL_ROOT_PASSWORD` env var when `--non-interactive`), connects via `mysql2/promise` (`multipleStatements: true` strictly for executing static `backendnode/db/SCHEMA.sql`), applies `SCHEMA.sql`, then runs the validated user/grant statements on a normal connection (`multipleStatements: false`), and closes cleanly.
   - Supports `--seed` flag to optionally run `npm run db:seed` afterward (blocked if `NODE_ENV === 'production'`).
5. Update `backendnode/package.json` to add scripts:
   - `"setup:env": "node scripts/setup-env.mjs"`
   - `"setup:db": "node scripts/setup-db.mjs"`
6. Create `backendnode/README.md` with concise, copy-paste teammate setup instructions:
   - `npm ci` → `npm run setup:env` → `npm run setup:db` → `npm run db:seed` → `npm run dev`
   - How Drizzle introspection works (`npm run db:pull` works even with the least-privilege `SELECT, INSERT, UPDATE, DELETE` user)
   - Manual `mysql -u root -p < db/SCHEMA.sql` fallback.
7. Create `backendnode/tests/setup.test.ts` (targeted test file for this ticket) using Vitest verifying:
   - **SCHEMA.sql ↔ `src/db/schema.ts` parity:** `SCHEMA.sql` creates all 7 exact tables (`rol`, `categoria`, `archivo`, `bitacora`, `usuario`, `producto`, `categoriaproducto`), defines every column listed in `getTableConfig(...)` for each table, includes `LONGBLOB`, `DECIMAL(10,2)`, `PRIMARY KEY (\`categoriaid\`, \`productoid\`)`, `ON DELETE SET NULL` for `producto.archivoid`, and `ON DELETE CASCADE` for `usuario.rolid` & `categoriaproducto`.
   - **Zero credentials in `SCHEMA.sql`:** asserts `SCHEMA.sql` does NOT contain `CREATE USER`, `IDENTIFIED BY`, `GRANT`, `INSERT INTO`, `M3rc@d0`, or `patito`.
   - **`setup-env.mjs` helpers:** `generateJwtSecret()` returns 70 lowercase hex chars; `runSetupEnv` writes `.env` to a temp path, refuses to overwrite without `force: true`, overwrites with `force: true`, rejects `DB_USER='root'`.
   - **`setup-db.mjs` security helpers:** `validateSqlIdentifier` accepts valid names (`mercadolibrenode`, `mercadolibre_user`) and rejects SQL injection attempts (`"foo; DROP TABLE rol;--"`, `"bad'user"`, `""`, 65-char string); `assertSafeAppUser('root')` / `'ROOT'` throws; `buildLeastPrivilegeStatements` grants only `SELECT, INSERT, UPDATE, DELETE` (never `GRANT ALL`).
8. Run `npx vitest run tests/setup.test.ts` while iterating, then run full gates once right before committing: `npm run typecheck`, `npm run build`, and `npm test`.

## Verification

Follow every check in [spec.md](spec.md).

## Change log

Write `.tickets/B003-schema-sql-and-setup-scripts/changelog.md` listing files touched, verification commands/results, and security checks verified.
