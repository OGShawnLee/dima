# B002 — Verification Spec

Every checkbox below must pass deterministically before moving `B002` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

Run inside `backendnode/` from PowerShell:

- [ ] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** TypeScript errors.
- [ ] `npm run build` (`tsc`) exits `0` and emits compiled `dist/db/schema.js`, `dist/db/index.js`, `dist/db/seed.js`.

## 2. Automated Test Gate

- [ ] Targeted run during iteration: `npx vitest run tests/db.test.ts` exits `0`.
- [ ] Final full suite run before commit: `npm test` (`vitest run`) exits `0` with **0 failures** across both `tests/core.test.ts` and `tests/db.test.ts`.

## 3. Schema, Contract & Security Checks

- [ ] **All 7 singular MySQL tables defined in `src/db/schema.ts`:** `rol`, `categoria`, `archivo`, `bitacora`, `usuario`, `producto`, `categoriaproducto`, each with `createdAt` and `updatedAt`.
- [ ] **Exact column & constraint parity:**
  - `archivo.datos` maps to `longblob` (`Buffer`, nullable).
  - `producto.precio` maps to `decimal(10, 2)` NOT NULL.
  - `usuario.email` and `rol.nombre` have `UNIQUE` constraints.
  - `categoriaproducto` has composite PK `(categoriaid, productoid)`.
  - Foreign keys: `usuario.rolid → rol.id` (`cascade`/`cascade`), `producto.archivoid → archivo.id` (`cascade`/`set null`), `categoriaproducto.categoriaid → categoria.id` (`cascade`/`cascade`), `categoriaproducto.productoid → producto.id` (`cascade`/`cascade`).
- [ ] **Production seed guard (`DEC-002`):** `assertSeedAllowed('production')` throws and `runSeed(db, 'production')` refuses to execute before touching DB.
- [ ] **Idempotent seed logic:** `runSeed` safely handles re-execution without duplicating roles, users, categories, products, or category-product mappings; uses `bcrypt.hash(..., 10)` and `crypto.randomUUID()`.
- [ ] **Lazy DB initialization:** Importing `src/db/index.ts` does not fail when `.env` is absent.
- [ ] **Zero `any` in `src/`:** Strict TypeScript (`strict: true`), no `any` introduced in `backendnode/src/**`.

## 4. Scope & Hygiene Checks

- [ ] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [ ] No `*.sql`, `.env`, `dist/`, `node_modules/`, `drizzle/`, `log/`, or `uploads/` files are tracked in Git.
- [ ] `.tickets/B002-database-schema-seed/changelog.md` is written with files touched, commands run, and checks verified.

## 5. Commit Check

- [ ] Single clean English Conventional Commit (e.g., `feat(backend): add Drizzle MySQL schema, connection pool, and prod-guarded seeder`) with a brief body overview of what changed.
