# B002 — Changelog

## Files Created

- `backendnode/drizzle.config.ts`
- `backendnode/src/db/schema.ts`
- `backendnode/src/db/index.ts`
- `backendnode/src/db/seed.ts`
- `backendnode/tests/db.test.ts`
- `.tickets/B002-database-schema-seed/changelog.md`

## Verification Commands & Results

All commands run inside `backendnode/`:

- `npx vitest run tests/db.test.ts`: **PASS** (exit code `0`, 17 passed, 0 failed)
- `npm run typecheck` (`tsc --noEmit`): **PASS** (exit code `0`, 0 errors)
- `npm run build` (`tsc`): **PASS** (exit code `0`, emitted `dist/db/schema.js`, `dist/db/index.js`, `dist/db/seed.js`)
- `npm test` (`vitest run`): **PASS** (exit code `0`, 2 test files, 34 passed, 0 failed across `tests/core.test.ts` and `tests/db.test.ts`)

## Schema & Security Checks Verified

- **All 7 singular MySQL tables in `src/db/schema.ts`:** `rol`, `categoria`, `archivo`, `bitacora`, `usuario`, `producto`, `categoriaproducto`, each with `createdAt` and `updatedAt` timestamps and Drizzle `relations(...)`.
- **Exact column & constraint parity:**
  - `archivo.datos` maps to nullable `longblob` (`Buffer`).
  - `producto.precio` maps to `decimal(10,2)` NOT NULL.
  - `usuario.email` and `rol.nombre` have `UNIQUE` constraints.
  - `categoriaproducto` has composite primary key `(categoriaid, productoid)`.
  - Foreign keys: `usuario.rolid -> rol.id` (`cascade`/`cascade`), `producto.archivoid -> archivo.id` (`cascade`/`set null`), `categoriaproducto.categoriaid -> categoria.id` (`cascade`/`cascade`), `categoriaproducto.productoid -> producto.id` (`cascade`/`cascade`).
- **Production seed guard (`DEC-002`):** `assertSeedAllowed('production')` throws and `runSeed(db, 'production')` rejects before touching the database.
- **Idempotent seeder:** `runSeed` uses existence checks and `onDuplicateKeyUpdate` across roles, users (`bcrypt.hash('patito', 10)`, `crypto.randomUUID()`), 15 protected categories, 15 products, and 15 category-product mappings; CLI execution is guarded by `if (require.main === module)`.
- **Lazy DB pool:** Importing `src/db/index.ts` does not require `.env` or open TCP connections eagerly.
- **Strict TypeScript:** `strict: true`, zero `any` in `backendnode/src/**`.
