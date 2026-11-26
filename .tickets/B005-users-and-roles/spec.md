# B005 — Verification Spec

Every checkbox below must pass deterministically before moving `B005` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

- [ ] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** errors.
- [ ] `npm run build` (`tsc`) exits `0`.

## 2. Automated Test Gate

- [ ] Targeted run: `npx vitest run tests/roles.test.ts tests/usuarios.test.ts` exits `0`.
- [ ] Final full suite run: `npm test` (`vitest run`) exits `0` with **0 failures**.

## 3. Security & Contract Checks

- [ ] **No `passwordhash` leakage:** `GET /api/usuarios`, `GET /api/usuarios/:email`, and `POST /api/usuarios` never include `passwordhash`.
- [ ] **No Mass Assignment (`DEC-006`):** `PUT /api/usuarios/:email` strips unknown keys and only writes `rolid` + optional `nombre`.
- [ ] **Backend-enforced guards (`DEC-008`):** `PUT` and `DELETE` return `404` on missing user, `403` on `protegido === true`, and `403` on self-edit/self-delete.
- [ ] **Password & uniqueness validation (`DEC-008`, `DEC-010`):** Password `< 6` chars → `400`; invalid role → `400`; duplicate email → `409`; `POST` returns `201` with `rol` (not `rolid`) and `bcrypt` cost 10 hash.
- [ ] **Audit trail:** `usuarios.crear`, `usuarios.editar`, `usuarios.eliminar` awaited with target `email`.
- [ ] **RBAC:** Every `/api/roles` and `/api/usuarios` endpoint enforces `authorize('Administrador')` (`401` / `403`).
- [ ] **OpenAPI 3.0.3 registrars:** `registerRolesPaths` (`GetRoles`) and `registerUsuariosPaths` (`GetUsuarios`, `GetUsuarioByEmail`, `CreateUsuario`, `UpdateUsuario`, `DeleteUsuario`) register cleanly.
- [ ] **Zero `any` in `src/`:** 0 matches for `\bany\b` in `backendnode/src/**`.

## 4. Scope & Commit Checks

- [ ] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [ ] `.tickets/B005-users-and-roles/changelog.md` is written.
- [ ] Single clean English Conventional Commit (e.g., `feat(backend): implement roles and hardened usuarios services`) with brief body overview.
