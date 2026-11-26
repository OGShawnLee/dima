# B001 — Changelog

## Files Created

- `backendnode/package.json`
- `backendnode/package-lock.json`
- `backendnode/tsconfig.json`
- `backendnode/vitest.config.ts`
- `backendnode/.env.example`
- `backendnode/src/config/env.ts`
- `backendnode/src/config/claimtypes.ts`
- `backendnode/src/types/express.d.ts`
- `backendnode/src/utils/httpError.ts`
- `backendnode/src/schemas/common.schema.ts`
- `backendnode/src/middlewares/validate.middleware.ts`
- `backendnode/src/middlewares/errorhandler.middleware.ts`
- `backendnode/src/middlewares/ratelimit.middleware.ts`
- `backendnode/src/app.ts`
- `backendnode/src/index.ts`
- `backendnode/tests/core.test.ts`
- `.tickets/B001-project-scaffold/changelog.md`

## Verification Commands & Results

All commands run inside `backendnode/`:

- `npm run typecheck` (`tsc --noEmit`): **PASS** (exit code `0`, 0 errors)
- `npm run build` (`tsc`): **PASS** (exit code `0`, emitted `backendnode/dist/index.js`)
- `npm test` (`vitest run`): **PASS** (exit code `0`, `tests/core.test.ts`: 17 passed, 0 failed)

## Security Checks Verified

- **`helmet()` & `x-powered-by`:** `GET /health` returns `200 { status: "ok" }`, omits `x-powered-by`, and sets `x-content-type-options: nosniff`.
- **CORS:** Allowed origin (`http://localhost:8080`) receives `access-control-expose-headers: Set-Authorization`; disallowed origins do not receive `access-control-allow-origin`.
- **100 KB Body Cap (`DEC-009`):** `express.json({ limit: '100kb' })` rejects oversized JSON payloads with `413` via `errorHandler`.
- **`validate` Middleware (`DEC-006`, `DEC-010`):** Strips unknown fields from `req.body` (mass-assignment defense) and maps `ZodError` to `400` with `detalles`.
- **Method-Agnostic `404` (`DEC-010`):** Catch-all `app.use(...)` returns `404` (`"Recurso no encontrado"`) for `GET`, `POST`, `PUT`, and `DELETE`.
- **CRLF Log Sanitization (`DEC-009` / CWE-117):** `sanitizeLogField` strips `\r`, `\n`, and `\t` before appending to `log/log.txt`, verified with a single-line log assertion.
- **Production Error Redaction (`DEC-009`):** `errorHandler` includes `stack` in `development` and omits `stack` and raw internal error messages on `500` in `production`.
- **Rate Limiter (`DEC-009`):** `createAuthRateLimiter` enforces request caps and responds with `429` JSON error envelope.
- **Strict TypeScript:** `strict: true`, zero `any` in `backendnode/src/**`.
- **Fail-Fast Env Validation:** `parseEnv` rejects missing or `< 32`-char `JWT_SECRET` and parses `FILES_IN_BD`, `CORS_ORIGINS`, and `TRUST_PROXY`.

## Notes

- Added `@types/request-ip` to `devDependencies` so `tsc --noEmit` resolves `request-ip` without implicit `any`.
- Installed `@scalar/express-api-reference@^0.10.42` (latest published version on npm) and `supertest@^7.0.0`.
