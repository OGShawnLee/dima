# B005 — Users & Roles Services (`/api/usuarios`, `/api/roles`)

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B005` | `completed` | `Gemini 4 Hydrogen (Medium)` | `A` | `roles`, `usuarios` | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-006` — Eliminate Mass Assignment (CWE-915): `PUT /api/usuarios/:email` validates with strict `UpdateUsuarioRequestSchema` and writes only allowlisted `rolid` + optional `nombre` to Drizzle (never `id`, `email`, `protegido`, or `passwordhash`).
- `DEC-008` — Backend-enforced protection on `PUT` & `DELETE /api/usuarios/:email`: check existence first (`404`), block `protegido === true` (`403`), block self-edit/self-delete (`target.email.toLowerCase() === audit.actorEmail.toLowerCase()` → `403`); enforce Zod password policy (`min(6).max(128)`) on `POST /api/usuarios`.
- `DEC-010` — Standardize `POST /api/usuarios` `201` response to `UsuarioDto` (`{ id, email, nombre, rol }` instead of legacy `rolid`), map invalid `rol` → `400`, duplicate email → `409 Conflict`, never return `passwordhash`, and wrap `GET /api/roles` in `try/catch`.

## Scope

### May create or edit
- `backendnode/src/schemas/roles.schema.ts`
- `backendnode/src/services/roles.service.ts`
- `backendnode/src/controllers/roles.controller.ts`
- `backendnode/src/routes/roles.routes.ts`
- `backendnode/src/schemas/usuarios.schema.ts`
- `backendnode/src/services/usuarios.service.ts`
- `backendnode/src/controllers/usuarios.controller.ts`
- `backendnode/src/routes/usuarios.routes.ts`
- `backendnode/tests/roles.test.ts`
- `backendnode/tests/usuarios.test.ts`
- `.tickets/B005-users-and-roles/changelog.md`

### Must not touch
- `backendnode/src/app.ts`, `backendnode/src/index.ts`, `backendnode/src/db/**`, `backendnode/package.json`
- Any `auth`, `bitacora`, `categorias`, `productos`, or `archivos` files
- `.routing/**`, `.gemini/**`, `frontendnet/**`
- Any other `.tickets/**` folder, or `B005`'s `task.md`, `spec.md`, `audit.md`

## Inputs

Read these files first before writing code:
1. [.routing/CONTEXT.md](../../.routing/CONTEXT.md)
2. [.routing/DECISION.md](../../.routing/DECISION.md) (`DEC-006`, `DEC-008`, `DEC-010`)
3. [.routing/SERVICES.md](../../.routing/SERVICES.md)
4. [.routing/services/roles_service.md](../../.routing/services/roles_service.md)
5. [.routing/services/usuarios_service.md](../../.routing/services/usuarios_service.md)
6. Existing foundation/auth files: `backendnode/src/schemas/common.schema.ts`, `backendnode/src/utils/httpError.ts`, `backendnode/src/middlewares/auth.middleware.ts`, `backendnode/src/middlewares/bitacora.middleware.ts`, `backendnode/src/middlewares/validate.middleware.ts`, `backendnode/src/services/bitacora.service.ts`, `backendnode/src/db/schema.ts`

## Task

1. **Roles (`roles_service.md`):**
   - Create `backendnode/src/schemas/roles.schema.ts` exporting `RolDtoSchema`, `RolListResponseSchema`, `RolDto`, and `registerRolesPaths(registry)` (`GetRoles`, `bearerAuth`).
   - Create `backendnode/src/services/roles.service.ts` implementing `IRolesService` (`getAll()`, `findByNombre(nombre)`) with injectable `DbClient` (defaulting to lazy `db`).
   - Create `backendnode/src/controllers/roles.controller.ts` (`getAll` with `try/catch` forwarding to `next(err)`) and `backendnode/src/routes/roles.routes.ts` (`createRolesRouter(deps?)` + default router protecting `GET /` with `authorize('Administrador')`).
2. **Usuarios (`usuarios_service.md`):**
   - Create `backendnode/src/schemas/usuarios.schema.ts` exporting `UsuarioEmailParamSchema`, `UsuarioDtoSchema`, `UsuarioListResponseSchema`, `CreateUsuarioRequestSchema`, `UpdateUsuarioRequestSchema`, types, and `registerUsuariosPaths(registry)` (`GetUsuarios`, `GetUsuarioByEmail`, `CreateUsuario`, `UpdateUsuario`, `DeleteUsuario`, all `bearerAuth`).
   - Create `backendnode/src/services/usuarios.service.ts` implementing `IUsuariosService` with injectable repository/DB + `IRolesService` + `IBitacoraService` so unit/Supertest suites run cleanly without live MySQL:
     - `getAll()` / `getByEmail(email)`: join `usuario` + `rol`, return explicit `{ id, email, nombre, rol }` (NEVER include `passwordhash`).
     - `create(input, audit)`: normalize email (`trim().toLowerCase()`); resolve role via `rolesService.findByNombre(input.rol)` (`400` if missing); check existing user by email (and catch MySQL `ER_DUP_ENTRY`) → `409 Conflict`; hash password with `bcrypt.hash(input.password, 10)`; generate `crypto.randomUUID()`; insert explicitly allowlisted columns (`protegido: false`); `await bitacora.registrar({ accion: 'usuarios.crear', elementoid: normalizedEmail, ip: audit.ip, usuario: audit.actorEmail })`; return `UsuarioDto` (`{ id, email, nombre, rol }`).
     - `update(email, input, audit)`: normalize email; find target user (`404` if missing); if `target.protegido === true` → `403`; if `target.email.toLowerCase() === audit.actorEmail.toLowerCase()` → `403`; resolve `rolid` via `rolesService.findByNombre(input.rol)` (`400` if missing); update **only** `rolid` and optional `nombre` (zero mass assignment!); `await bitacora.registrar({ accion: 'usuarios.editar', elementoid: target.email, ... })`.
     - `delete(email, audit)`: normalize email; find target user (`404` if missing — before checking `protegido`!); if `target.protegido === true` → `403`; if `target.email.toLowerCase() === audit.actorEmail.toLowerCase()` → `403`; delete row; `await bitacora.registrar({ accion: 'usuarios.eliminar', elementoid: target.email, ... })`.
   - Create `backendnode/src/controllers/usuarios.controller.ts` (all handlers `try/catch` → `next(err)`, building `AuditContext` from `requestIp` + `req.decodedToken[ClaimTypes.Name]`, returning `200`, `201`, `204` or `404` on `getByEmail`) and `backendnode/src/routes/usuarios.routes.ts` (`createUsuariosRouter(deps?)` + default router protecting every route with `authorize('Administrador')` and `validate(...)`).
3. **Automated Tests:**
   - Create `backendnode/tests/roles.test.ts` verifying RBAC (`401` unauthenticated, `403` `Usuario`, `200` `Administrador`), async error forwarding, and `registerRolesPaths`.
   - Create `backendnode/tests/usuarios.test.ts` verifying:
     - RBAC on all 5 routes (`401`/`403` for non-Admin).
     - `GET` & `GET /:email` never expose `passwordhash`; `404` for missing user; `400` for invalid email param.
     - `POST`: returns `201` with `rol` (NOT `rolid`) and no `passwordhash`, hashes password with `bcrypt`, logs `usuarios.crear`; rejects `< 6` char password (`400`), invalid role (`400`), duplicate email (`409`).
     - `PUT /:email`: strips unknown mass-assignment fields (`protegido: false`, `passwordhash: "hack"`, `id: "x"`), returns `204` and logs `usuarios.editar`; returns `404` for missing user, `403` for `protegido` user, `403` for self-edit.
     - `DELETE /:email`: returns `204` and logs `usuarios.eliminar`; returns `404` for missing user, `403` for `protegido` user, `403` for self-delete.
     - `registerUsuariosPaths` registers all 5 `operationId`s.
4. Run `npx vitest run tests/roles.test.ts tests/usuarios.test.ts` while iterating, then run full gates once before committing: `npm run typecheck`, `npm run build`, and `npm test`.

## Verification

Follow every check in [spec.md](spec.md).

## Change log

Write `.tickets/B005-users-and-roles/changelog.md` listing files touched, verification commands/results, and security checks verified.
