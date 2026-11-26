# B009 — Verification Spec

Every checkbox below must pass deterministically before moving `B009` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

- [ ] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** errors.
- [ ] `npm run build` (`tsc`) exits `0`.

## 2. Automated Test Gate

- [ ] Targeted run: `npx vitest run tests/auth.test.ts tests/usuarios.test.ts tests/openapi.test.ts` exits `0`.
- [ ] Final full suite run: `npm test` (`vitest run`) exits `0` with **0 failures**.

## 3. Security & Contract Checks (`DEC-013`, `DEC-014`)

- [ ] **Public `POST /api/auth/registro`:** Accepts `{ email, nombre, password }`, returns `201 UsuarioDto` (`{ id, email, nombre, rol: 'Usuario' }`), hashes with `bcrypt(10)`, returns `409` on duplicate email, logs `usuario.registro`.
- [ ] **No privilege escalation (CWE-915):** Sending `{ rol: 'Administrador', protegido: true }` to `POST /api/auth/registro` is stripped/ignored and always creates `'Usuario'` with `protegido: false`.
- [ ] **Rate limited:** `POST /api/auth/registro` enforces `createAuthRateLimiter` (`429`).
- [ ] **Strong password policy (`DEC-014`):** Both `POST /api/usuarios` and `POST /api/auth/registro` enforce 12–128 chars, ≥1 upper, ≥1 lower, ≥1 digit, ≥1 symbol (`400` on violation); `POST /api/auth` login still accepts existing seeded accounts.
- [ ] **OpenAPI 3.0.3:** `RegisterRequest` schema and public `Register` operation (`POST /api/auth/registro`) appear in `/openapi.json`.
- [ ] **Zero `any` in `src/`:** 0 matches for `\bany\b` in `backendnode/src/**`.

## 4. Scope & Commit Checks

- [ ] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [ ] `.tickets/B009-self-registration-and-password-policy/changelog.md` is written.
- [ ] Single clean English Conventional Commit (e.g., `feat(backend): add public self-registration and 12-char password policy`) with brief body overview.
