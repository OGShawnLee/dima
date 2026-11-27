# Security Audit — B008 (openapi-and-integration)

| Field | Value |
| :--- | :--- |
| Ticket | `B008-openapi-and-integration` |
| Target | `Backend` |
| Audited Commit | `73c2bb3` |
| Date | `2026-11-26` |
| Verdict | `PASS WITH NOTES` |

Evidence: `npm ci && npx tsc --noEmit && npx vitest run` at `73c2bb3` → `tsc` 0 errors, 13 test files / 172 tests passed.

Source read: `src/config/openapi.ts`, all `src/schemas/*.schema.ts` `register*Paths`, `src/app.ts` (route wiring, docs mounting), `tests/openapi.test.ts`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| Contract completeness | `PASS` | OpenAPI 3.0.3 with `bearerAuth`, named component schemas and PascalCase `operationId`s for every mounted router (auth, bitácora, roles, usuarios, categorías, productos, pedidos, archivos). `/api/auth/tiempo` is `text/plain`. |
| Auth & RBAC wiring | `PASS` | All routers are mounted after `bitacoraMiddleware` and before the catch-all `404` and `errorHandler`. The OpenAPI document marks `security: bearerAuth` on every protected operation and none on `DownloadArchivo`/`Login`/`Register`. |
| Logging & Error Hygiene | `PASS` | The `ErrorResponse` schema documents an optional `stack`, which is only emitted in development. |
| Security headers | `PASS` | Strict `helmet()` everywhere except `/swagger` and `/docs`, which have CSP disabled. |
| Negative Tests Present | `PASS` | `openapi.test.ts` (12) validates the document and that the docs UIs serve HTML. |

## Findings

### AUD-B008-01 — API docs (`/swagger`, `/docs`, `/openapi.json`) are served in production, with CSP disabled and third-party CDN scripts
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/src/app.ts:34-44,59-63`
- **CWE / OWASP:** `CWE-200 / OWASP API9:2023`
- **Issue / Exploit Scenario:** With `NODE_ENV=production`, the full contract (including admin endpoints) and two interactive consoles are reachable by anyone who can reach the API. CSP is turned off for those paths, and the Scalar reference loads its bundle from a public CDN at runtime. Exposure is reduced by the B011 firewall (443 only from `web`), but the BFF or any SSRF can still reach it.
- **Required Fix:** Mount `/swagger`, `/docs` and `/openapi.json` only when `nodeEnv !== 'production'`, or put them behind an `ENABLE_API_DOCS` env flag that defaults to `false` in production. If kept, replace `contentSecurityPolicy: false` with a CSP scoped to the required script hosts.
- **Required Regression Test:** `createApp({ nodeEnv: 'production' })` returns `404` for `/docs`, `/swagger/` and `/openapi.json`.
