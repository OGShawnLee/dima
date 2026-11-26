# B003 — Verification Spec

Every checkbox below must pass deterministically before moving `B003` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

Run inside `backendnode/` from PowerShell:

- [ ] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** errors.
- [ ] `npm run build` (`tsc`) exits `0`.

## 2. Automated Test Gate

- [ ] Targeted run during iteration: `npx vitest run tests/setup.test.ts` exits `0`.
- [ ] Final full suite run before commit: `npm test` (`vitest run`) exits `0` with **0 failures** across `tests/core.test.ts`, `tests/db.test.ts`, and `tests/setup.test.ts`.

## 3. Security & Contract Checks

- [ ] **Allowlist hygiene:** Root `.gitignore` keeps `*.sql` ignored and allowlists only `!backendnode/db/SCHEMA.sql` (`git check-ignore backendnode/db/SCHEMA.sql` returns non-zero / unignored, while `git check-ignore backendnode/dump.sql` is ignored).
- [ ] **Pure DDL `SCHEMA.sql` (`DEC-012`):** Contains all 7 tables matching `src/db/schema.ts` 1:1 (`utf8mb4`, `LONGBLOB`, `DECIMAL(10,2)`, unique indexes, composite PK, all 4 FKs) and **zero** `CREATE USER`, `IDENTIFIED BY`, `GRANT`, `INSERT`, or password literals.
- [ ] **`setup-env.mjs` safety:** Auto-generates 70-char hex `JWT_SECRET`, never overwrites `.env` unless `--force`, rejects `root` DB user.
- [ ] **`setup-db.mjs` safety:** Strictly validates SQL identifiers (`/^[a-zA-Z0-9_]{1,64}$/`), blocks `root` as app user, uses `multipleStatements: true` strictly for static `SCHEMA.sql` (never for user/grant statements), and grants **only** `SELECT, INSERT, UPDATE, DELETE` (never `GRANT ALL`).

## 4. Scope & Hygiene Checks

- [ ] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [ ] No `.env`, other `*.sql`, `dist/`, `node_modules/`, `log/`, or `uploads/` files are tracked in Git.
- [ ] `.tickets/B003-schema-sql-and-setup-scripts/changelog.md` is written.

## 5. Commit Check

- [ ] Single clean English Conventional Commit (e.g., `feat(backend): add pure-DDL SCHEMA.sql and least-privilege setup scripts`) with a brief body overview of what changed.
