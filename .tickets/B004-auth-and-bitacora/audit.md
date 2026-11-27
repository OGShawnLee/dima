# Security Audit — B004 (auth-and-bitacora)

| Field | Value |
| :--- | :--- |
| Ticket | `B004-auth-and-bitacora` |
| Target | `Backend` |
| Audited Commit | `73c2bb3` |
| Date | `2026-11-26` |
| Verdict | `PASS WITH NOTES` |

Evidence: `npm ci && npx tsc --noEmit && npx vitest run` at `73c2bb3` → `tsc` 0 errors, 13 test files / 172 tests passed.

Source read: `src/services/jwttoken.service.ts`, `src/middlewares/{auth,bitacora,ratelimit}.middleware.ts`, `src/controllers/{auth,bitacora}.controller.ts`, `src/services/{auth,bitacora}.service.ts`, `src/routes/{auth,bitacora}.routes.ts`, `src/schemas/{auth,bitacora,common}.schema.ts`, `src/config/claimtypes.ts`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| Auth & RBAC (`401` vs `403`) | `PASS` | Missing, non-Bearer, empty, invalid or expired token → `401`. Valid token with the wrong role → `403`. Refresh window: deleted user → `401`, role lost → `403` (DEC-003). `GET /api/bitacora` is `Administrador` only. |
| JWT Hardening | `PASS` | `jwt.verify` pins `algorithms: ['HS256']`, `issuer: 'ServidorFeiJWT'`, `audience: 'ClientesFeiJWT'`; claims are re-validated with Zod (`RoleNameSchema`). 20-minute TTL; refreshed token carries the role from the DB. |
| Login timing / enumeration | `PASS` | Same `401` message for both failure paths. A dummy hash is compared when the email is unknown; verified it is a valid cost-10 hash (`compare` takes ~44 ms). |
| Rate limiting | `PASS` | Login limiter runs before validation and the handler (tested). B011 later changed the key to `ip:email`; the resulting per-IP gap is tracked as `AUD-B011-03`. |
| Logging & Error Hygiene | `PASS` | `tiempo` returns `404` cleanly on a bad token (no double send). All handlers use `next(err)`. |
| Audit Trail (`bitacora`) | `PASS` | `usuario.login`, `usuario.login.fallido` (DEC-004, attempted email only, never the password). Fields are CRLF/tab-stripped and clamped to 255. **Note:** the IP comes from `request-ip` in `auth.controller.ts:17`, which a client can spoof. Tracked as `AUD-B011-02` (Medium); not duplicated. |
| Negative Tests Present | `PASS` | `auth.test.ts` (21): expired token, wrong `iss`/`aud`, non-HS256 alg, missing or non-Bearer header, `403` on wrong role, 429 before audit, refresh with a deleted or demoted user, stateless path when > 5m remain. `bitacora.test.ts` (7): 401/403, sanitization and clamping. |

## Findings

### AUD-B004-01 — `GET /api/bitacora` returns the entire table unpaginated
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/src/services/bitacora.service.ts:42-63`
- **CWE / OWASP:** `CWE-400 / OWASP API4:2023`
- **Issue / Exploit Scenario:** Every failed login appends a row, and the per-IP gap in `AUD-B011-03` makes it cheap to append millions. The admin endpoint then loads the whole table into memory and serializes it. That can stall or OOM the single Node process and break the BFF bitácora view.
- **Required Fix:** Add `?limit` (default 100, max 500) and `?offset` (or `?antesDe=<id>` cursor) parsed with Zod. Apply `.limit()`/`.offset()`. Register the query parameters in OpenAPI.
- **Required Regression Test:** `GET /api/bitacora?limit=1000` → `400`; `?limit=2` returns at most 2 rows.
