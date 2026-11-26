# B001 — Verification Spec

Every checkbox below must pass deterministically before moving `B001` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

Run inside `backendnode/` from PowerShell:

- [ ] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** TypeScript errors.
- [ ] `npm run build` (`tsc`) exits `0` and emits `backendnode/dist/index.js`.

## 2. Automated Test Gate

- [ ] Targeted run during iteration: `npx vitest run tests/core.test.ts` exits `0`.
- [ ] Final full suite run before commit: `npm test` (`vitest run`) exits `0` with **0 failures**.

## 3. Security & Contract Checks (Verified via `tests/core.test.ts` + Code Inspection)

- [ ] **No `X-Powered-By` & `helmet()` active:** `GET /health` returns `200 { status: "ok" }`, omits `x-powered-by`, and sets `x-content-type-options: nosniff`.
- [ ] **CORS exposed header:** Request from `http://localhost:8080` receives `access-control-expose-headers` containing `Set-Authorization`.
- [ ] **Body size limit (`DEC-009`):** `express.json({ limit: '100kb' })` rejects payloads > 100 KB with `413`.
- [ ] **Zod strict validation (`DEC-006`, `DEC-010`):** `validate(...)` strips unknown keys from `req.body` and maps `ZodError` to `400` with `detalles` (never `500`).
- [ ] **Method-agnostic `404` (`DEC-010`):** Unknown routes return `404` (`"Recurso no encontrado"`) for `GET`, `POST`, `PUT`, and `DELETE`.
- [ ] **CRLF log injection prevention (`DEC-009` / CWE-117):** Error messages/headers containing `\r` or `\n` are sanitized to single-line log entries in the log file.
- [ ] **Production error redaction (`DEC-009`):** `errorHandler` omits `stack` and raw internal error messages on `500` when `NODE_ENV !== 'development'`.
- [ ] **Rate limiter ready (`DEC-009`):** `createAuthRateLimiter` enforces request cap and responds with `429` JSON error envelope.
- [ ] **Zero `any` in `src/`:** Strict TypeScript (`strict: true`), no `any` introduced in `backendnode/src/**`.
- [ ] **Fail-fast env validation:** `parseEnv` rejects missing or `< 32`-char `JWT_SECRET` and parses `FILES_IN_BD` cleanly.

## 4. Scope & Hygiene Checks

- [ ] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [ ] `.env.example` contains placeholder values only (no real secrets or default course passwords like `M3rc@d0` or `patito`).
- [ ] No `.env`, `*.pdf`, `*.sql`, `backendnode/log/`, `backendnode/uploads/`, `backendnode/dist/`, or `backendnode/node_modules/` files are tracked in Git.
- [ ] `.tickets/B001-project-scaffold/changelog.md` is written with files touched, commands run, and security checks verified.

## 5. Commit Check

- [ ] Single clean English Conventional Commit (e.g., `feat(backend): scaffold TypeScript Express app and core security pipeline`) with a brief body overview of what changed.
