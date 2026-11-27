# B004 — Auth, JWT, RBAC & Bitácora Services

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B004` | `completed` | `Gemini 4 Hydrogen (Medium)` | `A` | `auth`, `bitacora` | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-003` — DB-checked sliding JWT refresh (`< 5` minutes remaining re-queries `usuario` + `rol`: deleted user → `401`, revoked role → `403`, valid user → refreshed `Set-Authorization` token with current DB claims).
- `DEC-004` — Failed-login auditing: invalid credentials on `POST /api/auth` record `await req.bitacora('usuario.login.fallido', email)` (never password!) behind `express-rate-limit`.
- `DEC-005` — Strict `jwt.verify` pinning `{ algorithms: ['HS256'], issuer: 'ServidorFeiJWT', audience: 'ClientesFeiJWT' }`, safe guard for missing/non-Bearer `Authorization` header (no `TypeError`), and clean `401` (unauthenticated/expired) vs `403` (valid token, wrong role) separation.
- `DEC-009` — Timing-safe login (dummy `bcrypt.compare` on missing email), `bitacora` IP/control-char sanitization (`\r`/`\n` stripped, length clamped `<= 255`), and `await req.bitacora(...)` with async error forwarding.
- `DEC-010` — `GET /api/auth/tiempo` explicitly returns `Content-Type: text/plain; charset=utf-8` with immediate `return` on `404` (fixing PDF double-send crash).

## Scope

### May create or edit
- `backendnode/src/schemas/bitacora.schema.ts`
- `backendnode/src/services/bitacora.service.ts`
- `backendnode/src/middlewares/bitacora.middleware.ts`
- `backendnode/src/controllers/bitacora.controller.ts`
- `backendnode/src/routes/bitacora.routes.ts`
- `backendnode/src/schemas/auth.schema.ts`
- `backendnode/src/services/jwttoken.service.ts`
- `backendnode/src/services/auth.service.ts`
- `backendnode/src/middlewares/auth.middleware.ts`
- `backendnode/src/controllers/auth.controller.ts`
- `backendnode/src/routes/auth.routes.ts`
- `backendnode/tests/bitacora.test.ts`
- `backendnode/tests/auth.test.ts`
- `.tickets/B004-auth-and-bitacora/changelog.md`

### Must not touch
- `backendnode/package.json`, `backendnode/src/app.ts`, `backendnode/src/index.ts`, `backendnode/src/db/**` (final route wiring into `app.ts` happens cleanly in `B008` so parallel Track A/B/C tickets never conflict; test routes via `createApp({ registerRoutes })`)
- `.gitignore`, `backendnode/db/**`, `backendnode/scripts/**` (owned by `B003`)
- `.routing/**`, `.gemini/**`, `frontendnet/**`
- `.tickets/B001-*`, `.tickets/B002-*`, `.tickets/B003-*`
- `.tickets/B004-auth-and-bitacora/task.md`, `spec.md`, or `audit.md`

## Inputs

Read these files first before writing code:
1. [.routing/CONTEXT.md](../../.routing/CONTEXT.md)
2. [.routing/DECISION.md](../../.routing/DECISION.md) (`DEC-003`, `DEC-004`, `DEC-005`, `DEC-009`, `DEC-010`)
3. [.routing/SERVICES.md](../../.routing/SERVICES.md)
4. [.routing/services/bitacora_service.md](../../.routing/services/bitacora_service.md)
5. [.routing/services/auth_service.md](../../.routing/services/auth_service.md)
6. Existing foundation files: `backendnode/src/config/claimtypes.ts`, `backendnode/src/config/env.ts`, `backendnode/src/schemas/common.schema.ts`, `backendnode/src/utils/httpError.ts`, `backendnode/src/middlewares/validate.middleware.ts`, `backendnode/src/middlewares/ratelimit.middleware.ts`, `backendnode/src/db/schema.ts`, `backendnode/src/app.ts`

## Task

1. **Bitácora (`bitacora_service.md`):**
   - Create `backendnode/src/schemas/bitacora.schema.ts` exporting `BitacoraDtoSchema`, `BitacoraListResponseSchema`, and `BitacoraDto` (plus `registerBitacoraPaths(registry)` helper for modular OpenAPI registration in `B008`).
   - Create `backendnode/src/services/bitacora.service.ts` implementing `IBitacoraService` with dependency-injectable `DbClient` (defaulting to lazy `db`):
     - `registrar(input)`: sanitizes `\r`/`\n`/`\t` and clamps strings to `<= 255` chars, converts numeric `elementoid` to `string`, inserts into `bitacora`.
     - `getAll()`: selects `{ bitacoraId: bitacora.id, accion, elementoid, ip, usuario, fecha }` ordered by `desc(bitacora.id)` and formats `fecha` as ISO-8601 string.
   - Create `backendnode/src/middlewares/bitacora.middleware.ts` exporting `createBitacoraMiddleware(service?)` + default `bitacoraMiddleware`: extracts IP via `requestIp.getClientIp(req) ?? 'unknown'` and attaches `req.bitacora = async (accion, elementoid) => ...` resolving `req.decodedToken?.[ClaimTypes.Name] ?? 'invitado'` **at call time** (so it picks up `decodedToken` set later by `authorize`).
   - Create `backendnode/src/controllers/bitacora.controller.ts` (`getAll` wrapped in `try/catch` forwarding to `next(err)`) and `backendnode/src/routes/bitacora.routes.ts` (`createBitacoraRouter(deps?)` + default router protecting `GET /` with `authorize('Administrador')`).
2. **JWT Token Service (`auth_service.md`):**
   - Create `backendnode/src/services/jwttoken.service.ts` implementing `IJwtTokenService` (accepting optional secret override for tests, defaulting to `env.JWT_SECRET`):
     - `generaToken(email, nombre, rol)`: signs WS-Federation claims (`ClaimTypes.Name`, `GivenName`, `Role`) + `iss: 'ServidorFeiJWT'`, `aud: 'ClientesFeiJWT'` using `algorithm: 'HS256'`, `expiresIn: '20m'`.
     - `verificarToken(token)`: verifies with strict `{ algorithms: ['HS256'], issuer: 'ServidorFeiJWT', audience: 'ClientesFeiJWT' }` and validates required claim shape (including `RoleNameSchema`).
     - `tiempoRestanteDesdeToken(token)`: verifies token and formats remaining time as `"00:MM:SS"` (clamped `>= 0`), returning `null` if invalid/expired.
3. **Auth Middleware (`DEC-003`, `DEC-005`):**
   - Create `backendnode/src/middlewares/auth.middleware.ts` exporting `createAuthorize(deps?)` + default `authorize(...allowedRoles: RoleName[])`:
     - Missing or non-`Bearer ` `Authorization` header → `next(unauthorized('Acceso denegado'))` (`401`).
     - Invalid/expired/wrong-alg/wrong-iss/wrong-aud JWT → `next(unauthorized('Acceso denegado'))` (`401`).
     - Valid JWT whose role is not in `allowedRoles` → `next(forbidden('Acceso denegado'))` (`403`).
     - Computes `minutosRestantes = (decoded.exp - Date.now() / 1000) / 60`.
     - If `minutosRestantes < 5` (`DEC-003`): calls injectable `findActiveUserByEmail(email)` (default queries `usuario` inner-joined with `rol` via Drizzle):
       - User not found (deleted) → `next(unauthorized('Acceso denegado'))` (`401`, no refresh header).
       - User's current DB role not in `allowedRoles` (demoted) → `next(forbidden('Acceso denegado'))` (`403`, no refresh header).
       - Otherwise updates `req.decodedToken` with current DB `nombre` & `rol`, generates fresh 20m JWT, sets `res.setHeader('Set-Authorization', newToken)`.
     - Assigns `req.decodedToken` and calls `next()`.
4. **Auth Schema, Service, Controller & Routes (`DEC-004`, `DEC-009`, `DEC-010`):**
   - Create `backendnode/src/schemas/auth.schema.ts` exporting `LoginRequestSchema`, `LoginResponseSchema`, `TokenTimeResponseSchema`, types, and `registerAuthPaths(registry)` helper (registering `GET /api/auth/tiempo` response explicitly as `text/plain`).
   - Create `backendnode/src/services/auth.service.ts` implementing `IAuthService` (injectable user lookup, `IJwtTokenService`, and `IBitacoraService`):
     - `login(input, audit)`: normalizes email; looks up user + role; if missing runs a dummy `bcrypt.compare(input.password, DUMMY_BCRYPT_HASH)` (`DEC-009`), logs `await bitacora.registrar({ accion: 'usuario.login.fallido', elementoid: input.email, ... })` (`DEC-004`), and throws `unauthorized('Usuario o contraseña incorrectos.')`.
     - If password mismatch: logs `usuario.login.fallido` and throws `unauthorized('Usuario o contraseña incorrectos.')`.
     - On success: generates JWT, logs `await bitacora.registrar({ accion: 'usuario.login', elementoid: user.email, ... })`, returns `{ email, nombre, rol, jwt }`.
     - `obtenerTiempoRestante(bearerHeader)`: extracts Bearer token safely and delegates to `jwtTokenService.tiempoRestanteDesdeToken(token)`.
   - Create `backendnode/src/controllers/auth.controller.ts` (`login` and `tiempo` — `tiempo` sets `Content-Type: text/plain; charset=utf-8` and returns immediately on `404`!).
   - Create `backendnode/src/routes/auth.routes.ts` (`createAuthRouter(deps?)` + default router):
     - `POST /`: `[rateLimiter, validate({ body: LoginRequestSchema }), controller.login]`
     - `GET /tiempo`: `[authorize('Usuario', 'Administrador'), controller.tiempo]`
5. **Automated Security & Contract Tests:**
   - Create `backendnode/tests/bitacora.test.ts` testing:
     - `GET /api/bitacora` requires `Administrador` (`401` unauthenticated, `403` for `Usuario`, `200` array ordered `id DESC` for `Administrador`).
     - `bitacoraMiddleware` resolves `req.decodedToken` dynamically at call time (even when registered before `authorize`), defaults to `'invitado'`, and sanitizes `\r`/`\n` before persisting.
   - Create `backendnode/tests/auth.test.ts` testing:
     - `POST /api/auth`: valid credentials → `200 { email, nombre, rol, jwt }` + `usuario.login` audit call; wrong password → `401` + `usuario.login.fallido` audit call (no password logged); unknown email → `401` with identical message + `usuario.login.fallido` + dummy bcrypt executed; malformed body → `400` with `detalles`; rate limiter triggers `429` before login/audit runs.
     - `GET /api/auth/tiempo`: valid token → `200` `text/plain` matching `/^00:\d{2}:\d{2}$/`; missing token → `401`; unavailable/invalid token path returns `404` cleanly without `ERR_HTTP_HEADERS_SENT`.
     - `authorize(...)`: missing header → `401` (no `TypeError`), expired token → `401`, wrong issuer/audience or non-HS256 token → `401`, `Usuario` hitting `Administrador` route → `403` (not `401`).
     - **DB-checked sliding refresh (`DEC-003`):** token with `< 5m` remaining triggers DB check: active user gets `Set-Authorization` header with current DB role; deleted user gets `401` (no `Set-Authorization`); demoted Admin gets `403` (no `Set-Authorization`); token with `> 5m` remaining stays stateless (zero DB lookup, no `Set-Authorization`).
6. Run `npx vitest run tests/auth.test.ts tests/bitacora.test.ts` while iterating, then run full gates once right before committing: `npm run typecheck`, `npm run build`, and `npm test`.

## Verification

Follow every check in [spec.md](spec.md).

## Change log

Write `.tickets/B004-auth-and-bitacora/changelog.md` listing files touched, verification commands/results, and security checks verified.
