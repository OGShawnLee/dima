# Security Audit — B001 (project-scaffold)

| Field | Value |
| :--- | :--- |
| Ticket | `B001-project-scaffold` |
| Target | `Backend` |
| Audited Commit | `73c2bb3` |
| Date | `2026-11-26` |
| Verdict | `PASS WITH NOTES` |

Evidence: `npm ci && npx tsc --noEmit && npx vitest run` at `73c2bb3` → `tsc` 0 errors, 13 test files / 172 tests passed.

Source read: `src/app.ts`, `src/index.ts`, `src/config/env.ts`, `src/middlewares/{errorhandler,validate}.middleware.ts`, `src/utils/httpError.ts`, `src/types/express.d.ts`, `tsconfig.json`, `package.json`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| No Mass Assignment | `PASS` | `validate()` replaces `req.body`/`params`/`query` with Zod-parsed output; non-strict objects strip unknown keys. |
| Auth & RBAC (`401` vs `403`) | `N/A` | Delivered in B004. |
| JWT Hardening | `N/A` | Delivered in B004. |
| Backend-Enforced Business Guards | `N/A` | — |
| SQL & Query Safety | `N/A` | — |
| File Upload Hardening | `N/A` | — |
| Logging & Error Hygiene (CWE-117) | `PASS` | `sanitizeLogField` strips `\r\n\t` from IP, email and message. A stack trace is returned only when `nodeEnv === 'development'`; an unset env falls back to `'production'`. Zod → `400`, body too large → `413`, malformed JSON → `400`, Multer → `400`. `helmet()` is on and `x-powered-by` disabled. Body limits are 100kb. The catch-all `404` uses `app.use`. `errorHandler` is registered last. |
| CORS | `PASS` | Explicit origin allowlist from `CORS_ORIGINS`, no `credentials`, `Set-Authorization` exposed. |
| Audit Trail (`bitacora`) | `N/A` | — |
| Secrets & Repo Hygiene | `PASS` | `JWT_SECRET` requires ≥ 32 chars. `.env`, `*.pdf`, `*.sql` (except `SCHEMA.sql`), `uploads/`, `log/`, `restclient/` are gitignored; none tracked. |
| Negative Tests Present | `PASS` | `core.test.ts` (17) covers the `JWT_SECRET` fail-fast, CORS allow/deny, `nosniff` and no `x-powered-by`, 413, unknown-key stripping, Zod → 400, stack only in development, CRLF log sanitization, 429. Not covered: malformed JSON → 400 and catch-all 404 for non-GET methods. The code paths exist; adding these tests is recommended. |

## Findings

### AUD-B001-01 — No baseline API rate limit
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/src/app.ts:45-65`
- **CWE / OWASP:** `CWE-770 / OWASP API4:2023`
- **Issue / Exploit Scenario:** Only `/api/auth` and `/api/auth/registro` are throttled. `PROGRESS.md` §2 asks for "a sane baseline API rate limit". Authenticated endpoints such as `GET /api/productos?s=` (a `LIKE` scan) and `POST /api/pedidos` (a transaction), plus the public `GET /api/archivos/:id`, can be hammered without limit by any registered user. Public self-registration (B009) makes such accounts free.
- **Required Fix:** Register a global `rateLimit({ windowMs: 60_000, max: 300, keyGenerator: extractClientIp })` on `/api` in `createApp` (injectable or disable-able via `CreateAppOptions` for tests).
- **Required Regression Test:** With `max: 2` injected, the 3rd `/api/*` request from one IP returns `429`, and `/health` stays unthrottled.
