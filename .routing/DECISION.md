# Dima — Architecture & Security Decision Log (`DECISION.md`)

> **Single-Writer Rule:** Written exclusively by the **Backend Router** (`$router`). Read by all 3 router roles, implementation workers, and course reviewers.
>
> **Purpose:** Record every deliberate deviation or security improvement over the original course guide (`PRAC - Backend (Node.js).pdf`) and baseline specs (`BACKEND-API-SPEC.md`), explaining **what changed**, **why (OWASP/CWE or engineering rationale)**, and **how it affects clients**.

## Entry Template

```markdown
## DEC-NNN — Short Title (`YYYY-MM-DD`)
- **Status:** Accepted
- **Baseline Spec / PDF:** What the original practice or spec did.
- **Decision:** What Dima implements instead.
- **Rationale:** Security (CWE/OWASP) or engineering justification.
- **Impact:** Effect on `backendnode`, `frontendnet`, or OpenAPI 3.0.3.
```

---

## DEC-001 — Modern Typed Backend as Single Source of Truth (`2026-11-25`)
- **Status:** Accepted
- **Baseline Spec / PDF:** Plain CommonJS JavaScript, Sequelize v6, `express-validator`, and `swagger-autogen` (OpenAPI 2.0).
- **Decision:** Implement `backendnode` in **TypeScript (`strict: true`) + Drizzle ORM + Zod + `@asteasolutions/zod-to-openapi` (OpenAPI 3.0.3)** with Swagger UI (`/swagger`) and Scalar (`/docs`). Treat the backend as the single source of truth for validation, authorization, and the API contract (`/openapi.json`).
- **Rationale:** Eliminates silent runtime null-dereference bugs present in the PDF, aligns type rigor with the C# `.NET` consumer, and provides compile-time + schema-driven verification gates (`tsc --noEmit`, Vitest + Supertest).
- **Impact:** Frontend consumes `/openapi.json` (or typed `HttpClient` services aligned to `.routing/SERVICES.md`).

## DEC-002 — Local MySQL 8.0 with `SCHEMA.sql` DDL Source of Truth & Drizzle Introspection (`2026-11-25`)
- **Status:** Accepted *(refined with `DEC-012`)*
- **Baseline Spec / PDF:** Local MySQL 8.0 (`mercadolibrenode`, `utf8mb4`) managed by Sequelize migrations; `BACKEND-API-SPEC.md` assumed an already-existing external schema.
- **Decision:** Use a local MySQL 8.0 instance with **`backendnode/db/SCHEMA.sql` as the authoritative pure-DDL source of truth**, applied via `npm run setup:db` (or `mysql -u root -p`), while `src/db/schema.ts` stays 1:1 aligned (verifiable via `drizzle-kit pull` introspection and automated Vitest parity tests) and `src/db/seed.ts` populates initial data idempotently (blocked when `NODE_ENV === 'production'`).
- **Rationale:** Keeps clean, auditable MySQL DDL for teammates and grading while allowing the runtime MySQL user to hold least-privilege DML grants (`SELECT, INSERT, UPDATE, DELETE` only — which still supports `drizzle-kit pull` via `INFORMATION_SCHEMA`).
- **Impact:** Teammates bootstrap local MySQL cleanly with `npm run setup:env` → `npm run setup:db` → `npm run db:seed`.

## DEC-003 — DB-Checked Sliding JWT Refresh (`2026-11-25`)
- **Status:** Accepted
- **Baseline Spec / PDF:** Purely stateless sliding refresh in `auth.middleware.ts` — whenever `< 5` minutes remain on a 20m JWT, a fresh 20m token is signed using only the old token's claims.
- **Decision:** Keep standard requests stateless, **but during the `< 5` minutes remaining refresh window**, re-query `usuario` joined with `rol` in MySQL:
  - If the user no longer exists → reject with `401 Unauthorized` (do not issue a new token).
  - If the user's role changed → re-check `allowedRoles` against the current DB role (`403 Forbidden` if access was revoked) and sign the refreshed `Set-Authorization` token with the **current** DB `nombre` and `rol`.
- **Rationale:** Closes a classic stateless JWT privilege-persistence flaw (**OWASP API2 / CWE-613**) where a deleted user or demoted Admin could keep refreshing stale `Administrador` tokens indefinitely. Minimal DB overhead (runs at most once per ~15 minutes per active user).
- **Impact:** Revoked/demoted users lose access at or before the next refresh window; `frontendnet`'s existing `401` auto-logout and `Set-Authorization` cookie refresh handlers work seamlessly.

## DEC-004 — Failed Login Auditing in `bitacora` (`2026-11-25`)
- **Status:** Accepted
- **Baseline Spec / PDF:** `POST /api/auth` only calls `req.bitacora("usuario.login", data.email)` on successful authentication; failed attempts leave no audit trail.
- **Decision:** On failed login (`401`), also record `await req.bitacora("usuario.login.fallido", email)` capturing the attempted email and client IP (**never** the submitted password). Place `express-rate-limit` in front of `POST /api/auth` to prevent audit-table flooding.
- **Rationale:** Addresses **OWASP A09 (Security Logging and Monitoring Failures)** by making brute-force and credential-stuffing attempts visible to admins in `/api/bitacora`.
- **Impact:** `/api/bitacora` will include `usuario.login.fallido` entries alongside `usuario.login`; successful login action string remains unchanged.

## DEC-005 — Strict JWT Verification & `401` vs `403` Separation (`2026-11-25`)
- **Status:** Accepted
- **Baseline Spec / PDF:** Bare `jwt.verify(token, jwtSecret)` without pinning algorithm/issuer/audience; returned `401 Unauthorized` for both missing/invalid tokens and valid tokens with insufficient roles.
- **Decision:**
  - Pin `jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'ServidorFeiJWT', audience: 'ClientesFeiJWT' })`.
  - Guard missing/non-Bearer `Authorization` headers cleanly (`401`, no `TypeError` crash).
  - Return **`401 Unauthorized`** for missing/invalid/expired tokens and **`403 Forbidden`** for valid tokens whose role is not in `allowedRoles`.
- **Rationale:** Prevents JWT algorithm confusion (**CWE-327 / CWE-347**) and prevents valid `Usuario` sessions from being logged out by `frontendnet`'s `401 → /Auth/Salir` handler when accessing an admin-only route.
- **Impact:** Frontend distinguishes expired sessions (`401`) from forbidden role access (`403`).

## DEC-006 — Mass Assignment Elimination (`2026-11-25`)
- **Status:** Accepted
- **Baseline Spec / PDF:** `categorias.update`, `productos.update`, and `usuarios.update` pass raw `req.body` into `.update(req.body, ...)`, allowing callers to overwrite `protegida`, `protegido`, `passwordhash`, `id`, or `email`.
- **Decision:** Validate every request with strict Zod DTOs (stripping unknown fields) and pass only explicitly allowlisted columns into Drizzle `.insert()` / `.set()`.
- **Rationale:** Eliminates Mass Assignment (**OWASP API3 / CWE-915**), protecting `protegida`, `protegido`, and `passwordhash` from tampering.
- **Impact:** Extra/unexpected JSON properties are ignored or rejected; legitimate request payloads are unaffected.

## DEC-007 — Hardened File Upload & Binary Streaming (`/api/archivos`) (`2026-11-25`)
- **Status:** Accepted
- **Baseline Spec / PDF:** `upload.single("file")` ran *before* `Authorize('Administrador')`; no Multer size cap; stored disk files under `${Date.now()}-${file.originalname}`; checked only client MIME + case-sensitive `.jpg`; served files with blocking `fs.readFileSync` and no `nosniff`.
- **Decision:**
  - Always place `authorize('Administrador')` **before** `upload.single('file')`.
  - Use Multer `memoryStorage()` with `limits: { fileSize: 100 * 1024, files: 1 }` (no orphan disk files on error).
  - Validate MIME (`image/jpeg`), extension (`.jpg`/`.jpeg`, case-insensitive), **and JPEG magic bytes (`0xFF 0xD8 0xFF`)**.
  - Generate server-side UUID filenames (`${crypto.randomUUID()}.jpg`) and enforce `path.resolve` containment on disk reads/deletes.
  - Serve `GET /api/archivos/:id` asynchronously (`fs/promises`) with `Content-Type: image/jpeg` and `X-Content-Type-Options: nosniff`.
- **Rationale:** Mitigates unauthenticated DoS, path traversal (**CWE-22**), unrestricted file upload (**CWE-434**), and MIME-sniffing XSS.
- **Impact:** Direct API clients must send genuine JPEGs `<= 100 KB` (already matching `frontendnet`'s 100 KB check).

## DEC-008 — Backend-Enforced User Protection & Password Validation (`2026-11-25`)
- **Status:** Accepted
- **Baseline Spec / PDF:** Frontend hid self-edit/self-delete (`ViewBag.PuedeEditar`) and enforced `[MinLength(6)]` passwords, while the backend had no password validation, no `protegido` check on `PUT /api/usuarios/:email`, and crashed when deleting non-existent users.
- **Decision:** Enforce server-side in `usuarios.service.ts` / `usuarios.schema.ts`:
  - `POST /api/usuarios`: enforce Zod password length (`min(6).max(128)`), normalized email, valid role (`400`), and duplicate email (`409`).
  - `PUT` & `DELETE /api/usuarios/:email`: check existence first (`404`), then block modifications/deletions of `protegido === true` users (`403`) and block an admin from editing/deleting their own account (`403`).
- **Rationale:** Never rely on client-side UI controls for authorization or input validation (**OWASP API1 / API5 / CWE-602**).
- **Impact:** Consistent enforcement across web UI, Swagger, and direct API clients.

## DEC-009 — HTTP Hardening, Rate Limiting, Safe Queries & CRLF-Safe Logs (`2026-11-25`)
- **Status:** Accepted
- **Baseline Spec / PDF:** No `helmet()`, exposed `X-Powered-By: Express`, no rate limiting on login, raw unsanitized log lines in `log/log.txt`, unescaped `LIKE %s%` wildcards, no timing mitigation on login, and unawaited `req.bitacora(...)`.
- **Decision:**
  - Enable `helmet()` (hides `X-Powered-By`, sets standard security headers) and explicit `express.json({ limit: '100kb' })`.
  - Apply `express-rate-limit` on `POST /api/auth` (**OWASP A07**).
  - Run a dummy `bcrypt.compare` on missing email during login to reduce timing-based user enumeration.
  - Strip `\r` and `\n` before appending to `log/log.txt` (**CWE-117** CRLF log injection).
  - Escape `\`, `%`, and `_` in `GET /api/productos?s=` `LIKE` queries.
  - Always `await req.bitacora(...)` and forward all async controller errors via `next(err)`.
- **Rationale:** Defense-in-depth hardening expected in Secure Programming.
- **Impact:** Transparent to valid clients; `429 Too Many Requests` returned on brute-force floods.

## DEC-010 — Standardized REST DTOs, Plain-Text `/tiempo` & Clean Error Mapping (`2026-11-25`)
- **Status:** Accepted
- **Baseline Spec / PDF:** `POST /api/usuarios` returned `rolid: rolusuario.nombre` instead of `rol`; `POST /api/archivos` returned `{ id, mime, indb, nombre }` instead of `archivoId` + `size`; `POST` categorias/productos returned raw `id`; `GET /api/auth/tiempo` sent `text/html` and double-sent on `404`; validation errors returned `500`; catch-all 404 used Express 5 `app.get('/*splat')`.
- **Decision:**
  - Unify `201 Created` DTOs with `GET` DTOs: `rol` on `POST /api/usuarios`, `archivoId` + `size` on `POST /api/archivos`, `categoriaId` / `productoId` on `POST` categorias/productos.
  - Serialize `producto.precio` as JSON `number` matching OpenAPI `type: number`.
  - Set `Content-Type: text/plain; charset=utf-8` on `GET /api/auth/tiempo` (with immediate `return` on `404`).
  - Map Zod errors → `400`, missing entities → `404`, duplicate email or M:N link → `409`, invalid FK (`archivoid`/`rol`) → `400`, and use `app.use(...)` for catch-all `404` across all HTTP methods.
- **Rationale:** Clean, predictable OpenAPI 3.0.3 contract for C# SDK/HttpClient consumers and elimination of Express 4 runtime crashes.
- **Impact:** Documented in [.routing/FRONT-HANDOFF.md](FRONT-HANDOFF.md) and `.routing/services/*_service.md`.

## DEC-011 — 3-Router Single-Writer Governance & Security Audit Gate (`2026-11-25`)
- **Status:** Accepted
- **Baseline Spec / PDF:** Individual practice with no multi-developer workflow.
- **Decision:** Operate with 3 dedicated router roles (`$router`, `$frontend-router`, `$security-audit`), committed `.routing/` and `.tickets/` (`B*`/`F*` prefixes), single-writer file ownership + one-way handoff outboxes, a 5-state ticket lifecycle (`draft → dispatched → implemented → changes-requested → completed`), Conventional Commits with body overviews, and mandatory pre-commit remote reconciliation.
- **Rationale:** Enables 3 teammates to work concurrently without GitHub merge conflicts while ensuring every implemented ticket passes an independent adversarial security audit before completion.
- **Impact:** Documented in [README.md](../README.md), [CONTEXT.md](CONTEXT.md), and all skills in `.gemini/skills/`.

## DEC-012 — Allowlisted Pure-DDL `SCHEMA.sql` & Automated Least-Privilege Setup Scripts (`2026-11-25`)
- **Status:** Accepted
- **Baseline Spec / PDF:** `.gitignore` excluded all `*.sql`; PDF p. 9 instructed students to create `bd.sql` with DB creation and manually run `CREATE USER` / `GRANT` commands (and showed hardcoded `M3rc@d0` and a leaked `JWT_SECRET`).
- **Decision:**
  - Keep `*.sql` ignored in root `.gitignore` by default, adding one explicit allowlist exception `!backendnode/db/SCHEMA.sql`.
  - Keep `backendnode/db/SCHEMA.sql` strictly **pure DDL** (database + 7 `CREATE TABLE IF NOT EXISTS` statements, zero `CREATE USER`, zero passwords, zero data).
  - Provide cross-platform Node scripts: `npm run setup:env` (`scripts/setup-env.mjs`, generates `.env` with a fresh 70-char hex `JWT_SECRET` without overwriting existing `.env`) and `npm run setup:db` (`scripts/setup-db.mjs`, prompts for masked MySQL `root` password, applies `SCHEMA.sql`, strictly regex-validates `DB_USER`/`DB_DATABASE`, rejects `root` as app user, and grants least-privilege `SELECT, INSERT, UPDATE, DELETE` only).
- **Rationale:** Zero hardcoded secrets in Git, eliminates weak/copied PDF secrets, enforces least-privilege MySQL runtime accounts (**OWASP / PDF p. 9**), and avoids Windows PowerShell `ExecutionPolicy` blocks across all 3 teammates.
- **Impact:** Teammates run `npm run setup:env` and `npm run setup:db`; Vitest enforces `SCHEMA.sql` ↔ `src/db/schema.ts` parity and bans credential statements in `SCHEMA.sql`.

## DEC-013 — Public Self-Registration Endpoint (`2026-11-26`)
- **Status:** Accepted *(responds to `BACK-HANDOFF` `REQ-001`)*
- **Baseline Spec / PDF:** Only `POST /api/usuarios` (`Administrador` only) existed; customer self-registration was a placeholder stub.
- **Decision:** Add anonymous `POST /api/auth/registro` (`operationId: Register`) behind `createAuthRateLimiter` accepting `{ email, nombre, password }`. Role is **hardcoded server-side** to `'Usuario'` and `protegido: false` (strict Zod DTO strips any `rol`/`protegido` fields). Returns `201 UsuarioDto` (`{ id, email, nombre, rol: 'Usuario' }`), `400` on validation failure, `409` on duplicate email, and logs `usuario.registro` (`email`) to `bitacora`.
- **Rationale:** Satisfies the required customer registration module while preventing privilege escalation via mass assignment (**OWASP API3 / CWE-915**) and automated account-creation spam (**OWASP A07**).
- **Impact:** Unblocks frontend `F007`; exposed in OpenAPI 3.0.3 as a public endpoint.

## DEC-014 — Strong Password Policy (12+ Chars + Complexity) (`2026-11-26`)
- **Status:** Accepted *(responds to `BACK-HANDOFF` `REQ-002`)*
- **Baseline Spec / PDF:** Frontend enforced `[MinLength(6)]`; backend previously enforced `min(6).max(128)`.
- **Decision:** Introduce shared `StrongPasswordSchema` in `src/schemas/common.schema.ts` requiring **12–128 characters** with at least **1 uppercase letter, 1 lowercase letter, 1 digit, and 1 symbol**. Apply it to both `POST /api/usuarios` and `POST /api/auth/registro` (keep `POST /api/auth` login `min(1).max(128)` so legacy seeded accounts `gvera@uv.mx`/`patito@uv.mx` continue working in dev/test; document seeded `'patito'` as dev/test fixture only).
- **Rationale:** Meets course rubric for strong password enforcement (**OWASP ASVS V2.1 / CWE-521**) with backend as single source of truth.
- **Impact:** `POST /api/usuarios` and `POST /api/auth/registro` reject weak passwords with `400` and descriptive `detalles`; frontend mirrors the rule in `PasswordPolicyAttribute`.

## DEC-015 — Server-Authoritative Orders Module (`/api/pedidos`) (`2026-11-26`)
- **Status:** Accepted *(responds to `BACK-HANDOFF` `REQ-003` & `FDEC-004`)*
- **Baseline Spec / PDF:** Shopping cart and admin orders were unimplemented stubs.
- **Decision:** Keep the active cart in the BFF session (`FDEC-004`) and add `pedido` + `pedidodetalle` tables (in `db/SCHEMA.sql` and `src/db/schema.ts`) plus 4 endpoints under `/api/pedidos`:
  - `POST /api/pedidos` (`Usuario`): accepts `{ items: [{ productoId, cantidad (1..99) }] }` (1..50 items), fetches authoritative `producto.precio` and `producto.titulo` from MySQL inside a transaction, rejects missing product IDs with `400`, snapshots `titulo` & `preciounitario` in `pedidodetalle`, persists computed `total`, logs `pedido.crear`, returns `201 { pedidoId, total, fecha, estado }`.
  - `GET /api/pedidos/mios` (`Usuario`): returns caller's own orders ordered by `id DESC`.
  - `GET /api/pedidos` (`Administrador`): returns all orders with customer email & name ordered by `id DESC`.
  - `GET /api/pedidos/:id` (`Usuario`, `Administrador`): returns order + snapshot line items; non-owner `Usuario` receives **`404`** (anti-IDOR enumeration).
- **Rationale:** Prevents client-side price tampering (**OWASP API6 / CWE-602**) and broken object-level authorization (**OWASP API1 / IDOR**); snapshotting title/price preserves historical accuracy even if a product changes or is deleted (`pedidodetalle.productoid ON DELETE SET NULL`).
- **Impact:** Unblocks frontend `F007` checkout and admin orders view; documented in [.routing/services/pedidos_service.md](services/pedidos_service.md).

## DEC-016 — Trusted Proxy List, Composite Login Rate-Limit Key & Loopback Bind (`2026-11-26`)
- **Status:** Accepted *(responds to `BACK-HANDOFF` `REQ-004` & `REQ-005`, `FDEC-006`)*
- **Baseline Spec / PDF:** `TRUST_PROXY` was boolean-only; login rate limiter keyed solely by IP; `index.ts` bound `app.listen(SERVER_PORT)` on `0.0.0.0`.
- **Decision:**
  - Upgrade `TRUST_PROXY` env parsing to accept `'false'`, `'true'`, a non-negative hop count, or a comma-separated Express trust list (e.g., `'loopback,10.10.10.10'`) so `req.ip` resolves the browser IP from `X-Forwarded-For` **only** when arriving via trusted `api` nginx + `web` BFF hops.
  - Use `req.ip` consistently in `bitacora`, `errorHandler`, and `createAuthRateLimiter`, and key the auth rate limiter by **`${req.ip}:${normalizedEmail}`** (falling back to `req.ip` when email is absent) so one user's typos behind a shared NAT/proxy cannot lock out other users while still stopping per-account brute force.
  - Add `HOST` env var (default `'127.0.0.1'` when `NODE_ENV === 'production'`, `'0.0.0.0'` or `'localhost'` configurable in dev) and call `app.listen(env.SERVER_PORT, env.HOST)`.
- **Rationale:** Prevents login DoS behind the BFF, fixes audit trail IP accuracy (**OWASP A09**), and closes port `3000` to external interfaces in production (**OWASP A05** / rubric Test 7).
- **Impact:** Production `.env` on `api` sets `HOST=127.0.0.1` and `TRUST_PROXY=loopback,10.10.10.10`.

## DEC-017 — Remote DB Host & Production Deployment Templates (`2026-11-26`)
- **Status:** Accepted *(responds to `BACK-HANDOFF` `REQ-006` & `REQ-007`)*
- **Baseline Spec / PDF:** `setup-db.mjs` only permitted `localhost`/`127.0.0.1`; no `api`/`db` deployment unit files existed.
- **Decision:**
  - Extend `scripts/setup-db.mjs` with validated `DB_APP_HOST` (supporting `localhost`, `127.0.0.1`, or private IPv4 like `10.10.10.20`, still blocking `root` and granting DML-only `SELECT, INSERT, UPDATE, DELETE`) and optional `DB_SSL` (`'true'|'false'`, optional `DB_SSL_CA` path) in `env.ts` + `src/db/index.ts`.
  - Add hardened deployment templates under `backendnode/deploy/` (`backendnode.service`, `nginx-api.conf`, `install-api.sh`, `install-db.sh`, `backup-db.sh`, `backup-db.timer`) matching `frontendnet/deploy/DEPLOY-PLAN.md` Phases 2–3.
- **Rationale:** Supports 3-server production topology (`web` → `api` → `db`) with least-privilege remote DB access, systemd sandboxing, TLS on 443, ufw firewalling, and automated nightly `mysqldump` backups.
- **Impact:** Ready for Friday 3-server deployment (`REQ-007`); local dev workflow remains unchanged.
