# B004 — Verification Spec

Every checkbox below must pass deterministically before moving `B004` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

Run inside `backendnode/` from PowerShell:

- [ ] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** errors.
- [ ] `npm run build` (`tsc`) exits `0`.

## 2. Automated Test Gate

- [ ] Targeted run during iteration: `npx vitest run tests/auth.test.ts tests/bitacora.test.ts` exits `0`.
- [ ] Final full suite run before commit: `npm test` (`vitest run`) exits `0` with **0 failures** across all test files.

## 3. Security & Contract Checks

- [ ] **Strict JWT verification (`DEC-005`):** `jwt.verify` pins `{ algorithms: ['HS256'], issuer: 'ServidorFeiJWT', audience: 'ClientesFeiJWT' }`; tokens signed with wrong `iss`/`aud`/`alg` are rejected with `401`.
- [ ] **`401` vs `403` separation (`DEC-005`):** Missing/malformed/expired token → `401`; valid token with wrong role → `403`.
- [ ] **DB-checked sliding refresh (`DEC-003`):** Tokens with `> 5m` left do not query DB; tokens with `< 5m` left query DB and return `401` if deleted, `403` if demoted out of `allowedRoles`, or issue refreshed `Set-Authorization` token with current DB claims.
- [ ] **Failed-login auditing (`DEC-004`):** Both wrong password and unknown email record `usuario.login.fallido` (with email + IP, never password) and return identical `401 { mensaje: 'Usuario o contraseña incorrectos.' }`.
- [ ] **Rate limiting (`DEC-009`):** `POST /api/auth` mounts `createAuthRateLimiter` before validation/controller and rejects floods with `429`.
- [ ] **Plain-text `/tiempo` (`DEC-010`):** `GET /api/auth/tiempo` sends `text/plain` (`00:MM:SS`) and returns immediately on `404` (no double-send crash).
- [ ] **Audit trail & async safety:** `GET /api/bitacora` requires `Administrador`, wraps async calls in `try/catch`, and `bitacora.service.ts` sanitizes `\r`/`\n` and awaits persistence.
- [ ] **Modular OpenAPI registration:** `registerAuthPaths(registry)` and `registerBitacoraPaths(registry)` declare exact PascalCase `operationId`s (`Login`, `GetTokenRemainingTime`, `GetBitacora`), named schemas, `text/plain` for `/tiempo`, and `bearerAuth` where protected.
- [ ] **Zero `any` in `src/`:** Strict TypeScript (`strict: true`), 0 matches for `\bany\b` in `backendnode/src/**`.

## 4. Scope & Hygiene Checks

- [ ] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [ ] `.tickets/B004-auth-and-bitacora/changelog.md` is written.

## 5. Commit Check

- [ ] Single clean English Conventional Commit (e.g., `feat(backend): implement auth, DB-checked JWT refresh, RBAC, and bitacora services`) with a brief body overview of what changed.
