# B009 — Change Log

## Summary
Implemented public customer self-registration (`POST /api/auth/registro`, `DEC-013`) and the shared strong password policy (`StrongPasswordSchema`, `DEC-014`) across both `POST /api/auth/registro` and `POST /api/usuarios`, while preserving existing `POST /api/auth` login compatibility.

## Files Created / Modified
- `backendnode/src/schemas/common.schema.ts` — Exported `StrongPasswordSchema` (12–128 chars, ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 symbol).
- `backendnode/src/schemas/usuarios.schema.ts` — Enforced `StrongPasswordSchema` on `CreateUsuarioRequestSchema.password`.
- `backendnode/src/schemas/auth.schema.ts` — Added `RegisterRequestSchema` (`RegisterRequest`) and registered public `Register` (`POST /api/auth/registro`) in `registerAuthPaths`.
- `backendnode/src/services/auth.service.ts` — Added `register(input, audit)` to `IAuthService` and `AuthService` with email normalization, server-side `'Usuario'` role lookup, `protegido: false`, duplicate email (`409`) handling (including `ER_DUP_ENTRY` / `1062`), `bcrypt(10)` hashing, and `usuario.registro` `bitacora` auditing.
- `backendnode/src/controllers/auth.controller.ts` — Added `register` handler returning `201 UsuarioDto` and forwarding errors via `next(err)`.
- `backendnode/src/routes/auth.routes.ts` — Mounted `POST /api/auth/registro` behind `createAuthRateLimiter` and `validate({ body: RegisterRequestSchema })`.
- `backendnode/tests/auth.test.ts` — Added unit/route/OpenAPI tests for `POST /api/auth/registro` (happy path `201`, CWE-915 mass-assignment stripping, weak password `400`, duplicate email `409`, rate limit `429`, audit log, no password leak).
- `backendnode/tests/usuarios.test.ts` — Updated `POST /api/usuarios` tests to use strong passwords and added negative tests for short, missing uppercase, missing lowercase, missing digit, and missing symbol passwords (`400`).
- `backendnode/tests/openapi.test.ts` — Added `'RegisterRequest'` to `EXPECTED_SCHEMAS` and `'Register'` to `EXPECTED_OPERATION_IDS` & `PUBLIC_OPERATION_IDS`.
- `.tickets/B009-self-registration-and-password-policy/changelog.md` — Recorded implementation details and verification results.

## Verification Results
- `npm run typecheck` (`tsc --noEmit`): **PASS** (exit `0`, 0 errors)
- `npm run build` (`tsc`): **PASS** (exit `0`)
- `npx vitest run tests/auth.test.ts tests/usuarios.test.ts tests/openapi.test.ts`: **PASS** (3 files, 40/40 tests passed)
- `npm test` (`vitest run`): **PASS** (11 files, 137/137 tests passed, 0 failures)
- Zero `any` check in `backendnode/src/**`: **PASS** (0 matches for `\bany\b`)

## Security Checks Verified (`DEC-013`, `DEC-014`)
- `POST /api/auth/registro` is public, rate-limited (`429`), hashes passwords with `bcrypt` cost `10`, returns `201 UsuarioDto` without leaking `passwordhash` or `rolid`, returns `409` on duplicate email, and logs `usuario.registro` in `bitacora`.
- CWE-915 mass-assignment defense: client-supplied `rol` / `protegido` fields are stripped by `RegisterRequestSchema` and hardcoded server-side to `'Usuario'` (`protegido: false`).
- `StrongPasswordSchema` enforced on both `POST /api/usuarios` and `POST /api/auth/registro`; `POST /api/auth` login retains `min(1).max(128)`.
- OpenAPI 3.0.3 `/openapi.json` includes `RegisterRequest` and public `Register` (`POST /api/auth/registro`).
