# B003 — Changelog (`SCHEMA.sql` & Automated Least-Privilege Setup Scripts)

## Files Created / Modified

- `.gitignore` — Added `!backendnode/db/SCHEMA.sql` directly beneath `*.sql` so only `backendnode/db/SCHEMA.sql` is tracked while all other `.sql` files remain ignored.
- `backendnode/package.json` — Added `"setup:env": "node scripts/setup-env.mjs"` and `"setup:db": "node scripts/setup-db.mjs"` scripts (dependencies unchanged).
- `backendnode/db/SCHEMA.sql` — Added authoritative MySQL 8.0 pure-DDL schema (`mercadolibrenode`, `utf8mb4_unicode_ci`) with all 7 tables (`rol`, `categoria`, `archivo`, `bitacora`, `usuario`, `producto`, `categoriaproducto`) matching `backendnode/src/db/schema.ts` 1:1.
- `backendnode/scripts/setup-env.mjs` — Added interactive/non-interactive `.env` generator with 70-char hex `JWT_SECRET` (`crypto.randomBytes(35).toString('hex')`), masked `DB_PASSWORD` prompt, `--force` overwrite guard, `root` user rejection, and `log/` + `uploads/` directory creation.
- `backendnode/scripts/setup-db.mjs` — Added database bootstrap script with strict SQL identifier allowlisting (`/^[a-zA-Z0-9_]{1,64}$/`), `root` app-user rejection, masked `root` password prompt, static `SCHEMA.sql` execution (`multipleStatements: true`), least-privilege DML-only grants (`SELECT, INSERT, UPDATE, DELETE` on `multipleStatements: false`), and optional `--seed` support (blocked in `production`).
- `backendnode/README.md` — Added concise teammate setup instructions, `drizzle-kit pull` least-privilege introspection note, and manual `mysql` fallback.
- `backendnode/tests/setup.test.ts` — Added 20 Vitest tests covering `SCHEMA.sql` ↔ `src/db/schema.ts` parity, zero credentials/DML in `SCHEMA.sql`, `setup-env.mjs` helpers, and `setup-db.mjs` security helpers.

## Verification Commands & Results

- `git check-ignore backendnode/db/SCHEMA.sql` → exited `1` (not ignored)
- `git check-ignore backendnode/dump.sql` → exited `0` (ignored: `backendnode/dump.sql`)
- `npm run typecheck` (`tsc --noEmit`) → exited `0` (0 errors)
- `npm run build` (`tsc`) → exited `0`
- `npm test` (`vitest run`) → exited `0` (`3` test files passed, `54` tests passed: `tests/setup.test.ts` 20, `tests/core.test.ts` 17, `tests/db.test.ts` 17)

## Security Checks Verified

- `SCHEMA.sql` contains pure DDL only (zero `CREATE USER`, `IDENTIFIED BY`, `GRANT`, `INSERT INTO`, or password literals).
- `setup-env.mjs` generates a 70-character lowercase hex `JWT_SECRET`, refuses to overwrite `.env` without `--force`, and rejects `DB_USER=root` or empty `DB_PASSWORD`.
- `setup-db.mjs` enforces `/^[a-zA-Z0-9_]{1,64}$/` on SQL identifiers, rejects `root` as app user, uses `multipleStatements: true` strictly for static `SCHEMA.sql`, and grants only `SELECT, INSERT, UPDATE, DELETE`.
