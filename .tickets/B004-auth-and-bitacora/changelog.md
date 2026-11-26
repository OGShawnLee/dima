# B004 — Auth, JWT, RBAC & Bitácora Services Changelog

## Files Created

- `backendnode/src/schemas/bitacora.schema.ts` — `BitacoraDtoSchema`, `BitacoraListResponseSchema`, `BitacoraDto`, and `registerBitacoraPaths(registry)` (`GetBitacora`, `bearerAuth`).
- `backendnode/src/services/bitacora.service.ts` — `IBitacoraService`, `BitacoraService` (with injectable `DbClient`), CRLF/TAB sanitization + 255-char clamping, and `id DESC` ISO-8601 retrieval.
- `backendnode/src/middlewares/bitacora.middleware.ts` — `createBitacoraMiddleware` and `bitacoraMiddleware` extracting client IP via `request-ip` and resolving `req.decodedToken[ClaimTypes.Name] ?? 'invitado'` dynamically at call time.
- `backendnode/src/controllers/bitacora.controller.ts` — `createBitacoraController` and `bitacoraController` with `try/catch` forwarding to `next(err)`.
- `backendnode/src/routes/bitacora.routes.ts` — `createBitacoraRouter` and `bitacoraRouter` protecting `GET /` with `authorize('Administrador')`.
- `backendnode/src/schemas/auth.schema.ts` — `LoginRequestSchema`, `LoginResponseSchema`, `TokenTimeResponseSchema`, types, and `registerAuthPaths(registry)` (`Login`, `GetTokenRemainingTime` with `text/plain` response).
- `backendnode/src/services/jwttoken.service.ts` — `IJwtTokenService` and `JwtTokenService` pinning `HS256`, `iss: 'ServidorFeiJWT'`, `aud: 'ClientesFeiJWT'`, `20m` TTL, and `00:MM:SS` remaining-time formatting.
- `backendnode/src/middlewares/auth.middleware.ts` — `createAuthorize` and `authorize(...allowedRoles)` with missing/non-Bearer `401` guard, `401` vs `403` separation (`DEC-005`), and `< 5` minute DB-checked sliding refresh (`DEC-003`).
- `backendnode/src/services/auth.service.ts` — `IAuthService` and `AuthService` with normalized email lookup, dummy `bcrypt.compare` timing protection (`DEC-009`), `usuario.login` / `usuario.login.fallido` auditing (`DEC-004`), and Bearer token extraction for `/tiempo`.
- `backendnode/src/controllers/auth.controller.ts` — `createAuthController` and `authController` (`login` and `tiempo` returning `Content-Type: text/plain; charset=utf-8` with immediate `return` on `404` per `DEC-010`).
- `backendnode/src/routes/auth.routes.ts` — `createAuthRouter` and `authRouter` mounting `createAuthRateLimiter` + `validate({ body: LoginRequestSchema })` on `POST /` and `authorize('Usuario', 'Administrador')` on `GET /tiempo`.
- `backendnode/tests/bitacora.test.ts` — 7 unit/integration tests covering RBAC, `id DESC` ordering, dynamic actor resolution, CR/LF/TAB sanitization, async error forwarding, and OpenAPI registration.
- `backendnode/tests/auth.test.ts` — 16 unit/integration tests covering login success/failure auditing, dummy `bcrypt.compare`, Zod `400` validation, `429` rate limiting, `text/plain` `/tiempo` and `404` handling, strict JWT verification (`alg`/`iss`/`aud`/`exp`), `401` vs `403` separation, DB-checked sliding refresh (`>5m` stateless, `<5m` active refresh, deleted user `401`, demoted role `403`), and OpenAPI registration.
- `.tickets/B004-auth-and-bitacora/changelog.md` — This changelog.

## Security Checks Verified

- `DEC-003`: DB-checked sliding JWT refresh (`< 5` minutes remaining re-queries `usuario` + `rol`: deleted → `401`, demoted → `403`, active → refreshed `Set-Authorization` with current DB claims; `> 5` minutes remains stateless).
- `DEC-004`: Failed login auditing (`usuario.login.fallido` with email and IP, never password) behind `express-rate-limit`.
- `DEC-005`: Strict `jwt.verify` pinning `{ algorithms: ['HS256'], issuer: 'ServidorFeiJWT', audience: 'ClientesFeiJWT' }`, safe non-Bearer header guard, and `401` vs `403` separation.
- `DEC-009`: Timing-safe login via dummy `bcrypt.compare` on unknown email, CRLF/TAB sanitization + 255-char clamping in `bitacora`, and `await req.bitacora(...)` with async error forwarding.
- `DEC-010`: `GET /api/auth/tiempo` explicitly sets `Content-Type: text/plain; charset=utf-8` and returns immediately on `404`.
- Zero `\bany\b` occurrences in `backendnode/src/**`.

## Verification Gates

- `npx vitest run tests/auth.test.ts tests/bitacora.test.ts` — passed (`23` tests across `2` files).
- `npm run typecheck` (`tsc --noEmit`) — exited `0` with zero errors.
- `npm run build` (`tsc`) — exited `0`.
- `npm test` (`vitest run`) — passed across the entire test suite with `0` failures.
