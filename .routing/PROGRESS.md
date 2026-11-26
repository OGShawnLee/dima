# Dima — Progress & Pending Work

## Current Status

- **Phase:** Phase 2 (`B001`–`B009` `implemented` awaiting `$security-audit`; `B011` `dispatched`, `B010` queued next for `REQ-003`)
- **Repository State:** `backendnode/` verified locally after `B009` (`11` test files, `137/137` tests passing, `tsc --noEmit` 0 errors, `tsc` build clean, `0` `any` in `src/`).
- **Decision Recorded:** Backend (`backendnode`) is the source of truth; all 17 architectural/security decisions (`DEC-001`–`DEC-017`) logged in [DECISION.md](DECISION.md).

---

## Completed

- Added initial architecture and API specifications ([BACKEND-API-SPEC.md](../BACKEND-API-SPEC.md), [FRONTEND-API-SPEC.md](../FRONTEND-API-SPEC.md), [STACK-REVIEW-COMMUNICATION.md](../STACK-REVIEW-COMMUNICATION.md)).
- Completed initial security and cross-stack contract review of the backend spec.
- Bootstrapped `.routing/CONTEXT.md` and `.routing/PROGRESS.md` with pending security and contract items tracked.
- Ingested original course guide (`PRAC - Backend (Node.js).pdf`, 70 pages including code screenshots) and cataloged all legacy vulnerabilities, runtime bugs, and exact contract discrepancies below.
- Created service routing index ([SERVICES.md](SERVICES.md)) and 7 minimal per-domain service specs in `.routing/services/` (`auth`, `bitacora`, `roles`, `usuarios`, `categorias`, `productos`, `archivos`) with SQL entities, Zod mappings, endpoints, security rules, and TypeScript interfaces.
- Added plain-language glossary and Shared Types provenance notes to [SERVICES.md](SERVICES.md); adapted `.gemini/skills/router/SKILL.md` and `.gemini/skills/ticket/SKILL.md` for Dima (`B`-prefix backend tickets, `F`-prefix reserved for frontend) and removed Pino's `site-router`.
- Added dedicated Security Auditor skill ([security-audit/SKILL.md](../.gemini/skills/security-audit/SKILL.md), recommended models: Neon Medium, Opus 5.5 Medium/High, Sol 6.2), Frontend Router skill ([frontend-router/SKILL.md](../.gemini/skills/frontend-router/SKILL.md)), updated ticket lifecycle to 5 states (`draft → dispatched → implemented → changes-requested → completed`), added single-writer outboxes ([AUDIT-HANDOFF.md](AUDIT-HANDOFF.md), [FRONT-HANDOFF.md](FRONT-HANDOFF.md)), and documented all 3 `$skill` entry points (`$router`, `$frontend-router`, `$security-audit`) + pre-commit remote reconciliation across `CONTEXT.md`, skills, and root [README.md](../README.md).
- Created [DECISION.md](DECISION.md) logging all 11 accepted architectural and security deviations (`DEC-001`–`DEC-011`), including local MySQL schema-first Drizzle (`DEC-002`), DB-checked sliding JWT refresh (`DEC-003`), and failed-login auditing `usuario.login.fallido` (`DEC-004`).

---

## Active Tickets

- **`B001-project-scaffold`** (`implemented` — Track `Shared`, Worker: `Gemini 4 Hydrogen (Medium)`, Merged to `main` @ `03928b2` / `d6b7f4d`): Router-verified (`typecheck` 0 errors, `build` OK, `17/17` Vitest/Supertest tests pass, 0 `any`, scope clean). Ready for Security Auditor review (`$security-audit`).
- **`B002-database-schema-seed`** (`implemented` — Track `Shared`, Worker: warm `B001` thread on `Gemini 4 Hydrogen (Medium)`, Merged to `main` @ `d134f19`): Router-verified (`typecheck` 0 errors, `build` OK, `34/34` tests pass across `core.test.ts` + `db.test.ts`, 0 `any`, scope clean). Ready for Security Auditor review (`$security-audit`). *(Warm worker retired after 2 tickets.)*
- **`B003-schema-sql-and-setup-scripts`** (`implemented` — Track `Shared`, Worker: `Gemini 4 Hydrogen (Medium)`, Merged to `main` @ `c05101a`): Router-verified (`typecheck` 0 errors, `build` OK, `54/54` tests pass across `core` + `db` + `setup`, `.gitignore` allowlist verified, scope clean). Ready for Security Auditor review (`$security-audit`).
- **`B004-auth-and-bitacora`** (`implemented` — Track `A`, Worker: `Gemini 4 Hydrogen (Medium)`, Merged to `main` @ `829ce2f`): Router-verified (`typecheck` 0 errors, `build` OK, `77/77` tests pass across all 5 test files, 0 `any`, scope clean). Ready for Security Auditor review (`$security-audit`).
- **`B005-users-and-roles`** (`implemented` — Track `A`, Worker: warm `B004` thread on `Gemini 4 Hydrogen (Medium)`, Merged to `main` @ `7878df3`): Router-verified (`typecheck` 0 errors, `build` OK, `91/91` tests pass across 7 test files, 0 `any`, scope clean). Ready for Security Auditor review (`$security-audit`). *(Warm worker retired after 2 tickets.)*
- **`B006-categorias-and-productos`** (`implemented` — Track `B`, Worker: `Gemini 4 Hydrogen (Medium)`, Merged to `main` @ `3ce6987`): Router-verified (`typecheck` 0 errors, `build` OK, `112/112` tests pass across 9 test files, 0 `any`, scope clean). Ready for Security Auditor review (`$security-audit`).
- **`B007-archivos-hardened`** (`implemented` — Track `C`, Worker: `Gemini 4 Hydrogen (Medium)`, Merged to `main` @ `aec25aa`): Router-verified (`typecheck` 0 errors, `build` OK, `122/122` tests pass across 10 test files, 0 `any`, scope clean). Ready for Security Auditor review (`$security-audit`).
- **`B008-openapi-and-integration`** (`implemented` — Track `C`, Worker: warm `B007` thread on `Gemini 4 Hydrogen (Medium)`, Merged to `main` @ `3c30852`): Router-verified (`typecheck` 0 errors, `build` OK, `132/132` tests pass across 11 test files, 0 `any`, OpenAPI 3.0.3 with 17 named schemas + 27 `operationId`s, `/swagger` & `/docs` 200 HTML). Ready for Security Auditor review (`$security-audit`). *(Warm worker retired after 2 tickets.)*
- **`B009-self-registration-and-password-policy`** (`implemented` — Track `A`, Worker: `Gemini 4 Hydrogen (Medium)`, Merged to `main` @ `e7a1d86`): Router-verified (`typecheck` 0 errors, `build` OK, `137/137` tests pass across 11 test files, 0 `any`, scope clean). Ready for Security Auditor review (`$security-audit`).

---

## Pending

### 1. Project Setup & Reference Ingestion

- [x] **Ingest original implementation guide PDF:** Reviewed all 70 pages (including code screenshots) of `PRAC - Backend (Node.js).pdf`; extracted exact contract quirks, seed data structure, and legacy security/runtime defects to eliminate in `backendnode`.
- [x] **Adapt `.gemini/skills/` for Dima:** Rewrote `router/SKILL.md` and `ticket/SKILL.md` for `backendnode` (`B<NNN>` backend prefix, `F<NNN>` reserved for frontend, routed via `.routing/SERVICES.md`) and removed Pino's unused `site-router`.
- [x] **Confirm Git tracking for `.routing/` & `.tickets/`:** Both `.routing/` and `.tickets/` are committed to Git with single-writer ownership so all 3 teammates stay in sync.
- [x] **Confirm DB provisioning setup (`DEC-002`):** Local MySQL 8.0 (`mercadolibrenode`) using a **schema-first** Drizzle strategy (`src/db/schema.ts` → `drizzle-kit` migrations/push + prod-guarded `seed.ts`).
- [ ] **Optional — Least-privilege DB user:** Per PDF p. 9 step 15–16, document/configure a runtime DB user with `SELECT, INSERT, UPDATE, DELETE` only (separate from schema-migration privileges).

---

### 2. Security Review Items (Secure Programming Requirements)

All items below must be explicitly resolved in tickets and covered by automated security tests:

#### File Upload & Storage Hardening (`/api/archivos`, `upload.middleware.ts`)
- [ ] **Backend file size limit:** Configure Multer `limits: { fileSize: 100 * 1024 }` (matching or superseding frontend limit) so direct API calls cannot DoS disk or bloat MySQL `LONGBLOB`.
- [ ] **Path traversal & unsafe filename mitigation:** Stop using client-controlled `${Date.now()}-${file.originalname}` on disk. Generate UUID filenames (`${crypto.randomUUID()}.jpg`) and verify `path.resolve` stays inside `uploads/` on read/delete.
- [ ] **Magic-byte inspection:** Verify actual JPEG file signature (`FF D8 FF`) in addition to `image/jpeg` MIME type and `.jpg` extension to stop spoofed HTML/JS uploads.
- [ ] **Safe binary streaming headers:** Serve `GET /api/archivos/:id` with `Content-Type: image/jpeg` and `X-Content-Type-Options: nosniff` to prevent MIME-sniffing XSS.
- [ ] **Orphan temp-file prevention:** When `FILES_IN_BD=true`, avoid leaving orphan files in `uploads/` on DB errors/crashes (prefer `memoryStorage` under size cap or strict `try/finally` unlink).

#### Authentication, JWT & Session Hardening (`jwttoken.service.ts`, `auth.middleware.ts`)
- [ ] **Strict `jwt.verify` options:** Explicitly pass `{ algorithms: ['HS256'], issuer: 'ServidorFeiJWT', audience: 'ClientesFeiJWT' }` instead of bare `jwt.verify(token, env.JWT_SECRET)`.
- [ ] **HTTP `401` vs `403` separation:** Return `401 Unauthorized` for missing/invalid/expired JWTs and `403 Forbidden` when the token is valid but the role is not in `allowedRoles`.
- [ ] **Login timing side-channel protection:** Keep identical `401` error message (`Usuario o contraseña incorrectos.`) and perform a dummy `bcrypt.compare` when email is not found to reduce user-enumeration timing leaks.
- [ ] **DB-checked sliding refresh (`DEC-003`):** During the `< 5m` sliding refresh window, re-query `usuario` + `rol` in MySQL (reject `401` if deleted, `403` if role lost access, otherwise sign refreshed token with current DB role).

#### HTTP Pipeline & Abuse Controls (`index.ts`)
- [ ] **Security headers (`helmet`):** Register `helmet()` and disable `X-Powered-By`.
- [ ] **Rate limiting (`express-rate-limit`):** Protect `POST /api/auth` against brute-force / credential stuffing (OWASP A07) and configure a sane baseline API rate limit.
- [ ] **Request body limits:** Explicitly configure `express.json({ limit: '100kb' })` and `express.urlencoded({ extended: false, limit: '100kb' })`.

#### Backend-Enforced Authorization & Validation (`/api/usuarios`, `/api/productos`, `/api/categorias`)
- [ ] **Eliminate Mass Assignment (OWASP API3 / CWE-915):** Original PDF passes raw `req.body` into `categoria.update(body, ...)`, `producto.update(body, ...)`, and `usuario.update(req.body, ...)`—allowing callers to overwrite `protegida`, `protegido`, `passwordhash`, `id`, or `email`. Always validate via strict Zod DTOs and pass explicit allowlisted columns to Drizzle `.set(...)`.
- [ ] **Protect `PUT /api/usuarios/:email`:** Enforce backend checks preventing modification/demotion of `protegido === true` users and preventing an admin from self-demoting or self-deleting (do not rely on frontend `ViewBag.PuedeEditar`).
- [ ] **Backend password validation:** Enforce password rules (minimum length / policy) in `usuarios.schema.ts` via Zod on `POST /api/usuarios`, not just in the frontend form.
- [ ] **Eliminate legacy runtime/DoS bugs from PDF:**
  - Ensure `authorize(...)` runs **before** `upload.single("file")` (PDF p. 59 had them reversed, allowing unauthenticated disk uploads).
  - Guard missing `Authorization` header before `.startsWith('Bearer ')` (PDF p. 56 crashed with `TypeError`).
  - Guard `null` user/role lookups in `usuarios.create`/`update`/`delete` (PDF p. 49–50 crashed on `rolusuario.id` / `data.protegido` and returned `403` instead of `404` on missing user).
  - Fix double-send `ERR_HTTP_HEADERS_SENT` crash in `GET /api/auth/tiempo` when token is invalid (PDF p. 55 missing `return`).
  - Wrap all async handlers (`roles`, `bitacora`, etc.) in `try/catch` / async error wrapper so rejected promises cannot crash Express 4.
  - Map Zod validation errors to `400 Bad Request` (PDF p. 38/41 threw untyped `Error` → `500`).
  - Use `app.use(...)` for catch-all `404` across all HTTP methods (PDF p. 61 used `app.get('/*splat', ...)`, Express 5 syntax + GET-only).
  - Fix `PUT /api/archivos/:id` audit logging order and ID (PDF p. 46 logged `data.id` = `undefined` before checking `404`), and use async `fs/promises` + existence check on `GET /api/archivos/:id`.
  - Always `await req.bitacora(...)` and handle failures safely without unhandled promise rejections.

#### Logging, Query & Environment Hygiene
- [ ] **CRLF log injection prevention (CWE-117):** Strip `\r` and `\n` from `ip`, `email`, and `err.message` before appending to `log/log.txt` in `errorhandler.middleware.ts`.
- [ ] **Trusted IP extraction:** Define `trust proxy` / `X-Forwarded-For` policy for `request-ip` so audit logs (`bitacora`) and `log/log.txt` cannot be trivially spoofed by untrusted clients while still supporting local BFF forwarding if desired.
- [ ] **SQL `LIKE` wildcard escaping:** Escape `%` and `_` in `GET /api/productos?s=` search input before building `LIKE %s%`.
- [ ] **Production seed & secret hygiene:** Guard `src/db/seed.ts` so default credentials (`patito`) cannot be seeded when `NODE_ENV === 'production'`; keep `.env.example` placeholder-only (no hardcoded sample passwords).

---

### 3. Contract & Spec Issues (Backend Source of Truth Alignment)

Resolve and lock these into the backend Zod schemas & OpenAPI 3.0.3 spec before implementation:

- [ ] **`POST /api/usuarios` response key (`rolid` vs `rol`):** `BACKEND-API-SPEC.md` line 373 specifies `{ id, email, nombre, rolid: rolusuario.nombre }`, whereas `GET /api/usuarios` and `frontendnet` use `rol`. Standardize on `rol` (or document if legacy compatibility requires `rolid`).
- [ ] **`POST /api/archivos` response shape (`id` vs `archivoId`, missing `size`):** `POST` returns `{ id, mime, indb, nombre }` while `GET` returns `{ archivoId, mime, indb, nombre, size }`. Unify DTO shape in OpenAPI.
- [ ] **Consistent aliased IDs on `201 Created`:** Ensure `POST /api/categorias` and `POST /api/productos` return `categoriaId` / `productoId` (matching `GET` DTOs), not raw Drizzle `id`.
- [ ] **`producto.archivoid` casing:** Standardize canonical field name (`archivoid` vs `archivoId`) in OpenAPI 3.0.3 so generated C# / web clients agree without silent drops.
- [ ] **`producto.precio` JSON serialization:** Explicitly serialize MySQL `DECIMAL(10,2)` as JSON `number` (not string) and match OpenAPI `type: number`.
- [ ] **Explicit DB constraint error mapping:**
  - Duplicate `email` on `POST /api/usuarios` → `409 Conflict` (instead of raw MySQL `ER_DUP_ENTRY` `500`).
  - Duplicate `(categoriaid, productoid)` on `POST /api/productos/:id/categoria` → `409 Conflict` or idempotent `204`.
  - Non-existent `archivoid` FK on `POST`/`PUT /api/productos` → `400`/`404` instead of `500`.
- [ ] **`GET /api/auth/tiempo` OpenAPI content type:** Register `200` response explicitly as `text/plain` (not `application/json`).
- [ ] **Failed-login audit logging (`DEC-004`):** Record `usuario.login.fallido` in `bitacora` (attempted email + IP, never password) on invalid `POST /api/auth` credentials, protected behind rate limiting.

---

### 4. Planned Backend Implementation Roadmap (High-Level)

1. **Ticket B001 — Project Scaffold & Core Pipeline (`implemented`):** `package.json`, `tsconfig.json`, `env.ts`, Express app, `helmet`, `cors`, rate-limit, `validate.middleware.ts`, `errorhandler.middleware.ts` (CRLF-safe), Vitest + Supertest setup.
2. **Ticket B002 — Database Layer & Seeding (`implemented`):** `drizzle.config.ts`, `src/db/index.ts`, `src/db/schema.ts`, `src/db/seed.ts` (prod-guarded), `tests/db.test.ts`.
3. **Ticket B003 — `SCHEMA.sql` & Automated Least-Privilege Setup Scripts (`implemented`):** Pure-DDL `backendnode/db/SCHEMA.sql` (`DEC-012`), `scripts/setup-env.mjs`, `scripts/setup-db.mjs` (least-privilege MySQL user), `backendnode/README.md`, parity & security tests.
4. **Ticket B004 — Auth, JWT, RBAC & Bitácora (`implemented`):** `jwttoken.service.ts`, `auth.middleware.ts` (`DEC-003` DB-checked refresh, `DEC-005` strict verify + `401`/`403`), `bitacora.middleware.ts`, `/api/auth` (`DEC-004` failed-login audit), `/api/bitacora`.
5. **Ticket B005 — Users & Roles (`implemented`):** `/api/usuarios` (backend `protegido` & self-edit/delete guards, password policy, duplicate email `409`), `/api/roles`.
6. **Ticket B006 — Categories & Products (`implemented`):** `/api/categorias` (`protegida` delete guard), `/api/productos` (safe `LIKE` search, FK validation, M:N category assignment/removal).
7. **Ticket B007 — Hardened File Storage (`implemented`):** `upload.middleware.ts` (size cap, UUID filenames, magic bytes), `/api/archivos` (disk & `LONGBLOB` modes, `nosniff`, safe unlink).
8. **Ticket B008 — OpenAPI 3.0.3 & Full Verification (`implemented`):** Complete `src/config/openapi.ts` registry (`/openapi.json`, `/swagger`, `/docs`), wire all routes in `app.ts`, end-to-end contract & security test suite (`132/132` passing).
9. **Ticket B009 — Public Self-Registration & Strong Password Policy (`implemented`):** `REQ-001` (`POST /api/auth/registro`, rate-limited, server-forced `Usuario`, bitácora `usuario.registro`) + `REQ-002` (`StrongPasswordSchema` 12–128 chars + upper/lower/digit/symbol on `/api/usuarios` & `/api/auth/registro`).
10. **Ticket B010 — Server-Authoritative Orders Module (`draft`):** `REQ-003` (`pedido` + `pedidodetalle` in `schema.ts` & `db/SCHEMA.sql`, `/api/pedidos` + `/api/pedidos/mios` + `/api/pedidos/:id`, server-side price recomputation, anti-IDOR `404`, OpenAPI + route wiring).
11. **Ticket B011 — Production Hardening, Remote DB Setup & Deploy Templates (`dispatched`):** `REQ-004` (`TRUST_PROXY` list + `ip:email` auth rate-limit key), `REQ-005` (`HOST` bind `127.0.0.1` in prod), `REQ-006` (`DB_APP_HOST` + `DB_SSL`), and `REQ-007` (`backendnode/deploy/` non-interactive Debian 12 + Ubuntu 24.04 systemd/nginx/backup/install scripts + lightweight `vagrant up db` dev guide).
