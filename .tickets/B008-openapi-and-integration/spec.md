# B008 — Verification Spec

Every checkbox below must pass deterministically before moving `B008` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

- [ ] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** errors.
- [ ] `npm run build` (`tsc`) exits `0`.

## 2. Automated Test Gate

- [ ] Targeted run: `npx vitest run tests/openapi.test.ts` exits `0`.
- [ ] Final full suite run: `npm test` (`vitest run`) exits `0` with **0 failures** across all 11 test files (`core`, `db`, `setup`, `bitacora`, `auth`, `roles`, `usuarios`, `categorias`, `productos`, `archivos`, `openapi`).

## 3. OpenAPI 3.0.3 & Security Integration Checks

- [ ] `GET /openapi.json` returns valid OpenAPI `3.0.3` with `bearerAuth` security scheme, all 17 named schemas, and all 24 exact PascalCase `operationId`s across all 7 services.
- [ ] `GET /api/auth/tiempo` declares `text/plain`; `POST /api/archivos` & `PUT /api/archivos/{id}` declare `multipart/form-data` binary `file`; `GET /api/archivos/{id}` is public with `image/jpeg` binary response; `POST /api/auth` is public; all other 22 operations require `bearerAuth`.
- [ ] `GET /swagger/` and `GET /docs` render `200` HTML cleanly.
- [ ] Full wired app enforces `401` on unauthenticated calls to all protected `/api/*` routes, keeps `helmet()` active on `/api/*` (no `x-powered-by`), mounts `bitacoraMiddleware` before `/api/*`, and keeps `errorHandler` last.
- [ ] **Zero `any` in `src/`:** 0 matches for `\bany\b` in `backendnode/src/**`.

## 4. Scope & Commit Checks

- [ ] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [ ] `.tickets/B008-openapi-and-integration/changelog.md` is written.
- [ ] Single clean English Conventional Commit (e.g., `feat(backend): wire all API routes and OpenAPI 3.0.3 docs endpoints`) with brief body overview.
