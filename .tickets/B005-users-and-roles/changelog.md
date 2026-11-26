# B005 — Users & Roles Services Changelog

## Files Created

- `backendnode/src/schemas/roles.schema.ts` — `RolDtoSchema`, `RolListResponseSchema`, `RolDto`, and `registerRolesPaths(registry)` (`GetRoles`, `bearerAuth`).
- `backendnode/src/services/roles.service.ts` — `IRolesService` and `RolesService` (`getAll`, `findByNombre`) with injectable `DbClient`.
- `backendnode/src/controllers/roles.controller.ts` — `createRolesController` and `rolesController` wrapping `getAll` in `try/catch` and forwarding errors via `next(err)`.
- `backendnode/src/routes/roles.routes.ts` — `createRolesRouter` and `rolesRouter` protecting `GET /` with `authorize('Administrador')`.
- `backendnode/src/schemas/usuarios.schema.ts` — `UsuarioEmailParamSchema`, `UsuarioDtoSchema`, `UsuarioListResponseSchema`, `CreateUsuarioRequestSchema`, `UpdateUsuarioRequestSchema`, types, and `registerUsuariosPaths(registry)` (`GetUsuarios`, `GetUsuarioByEmail`, `CreateUsuario`, `UpdateUsuario`, `DeleteUsuario`, all `bearerAuth`).
- `backendnode/src/services/usuarios.service.ts` — `IUsuariosRepository`, `DrizzleUsuariosRepository`, `IUsuariosService`, and `UsuariosService` with explicit column projection (no `passwordhash`), `bcrypt` cost-10 hashing, `crypto.randomUUID()`, `ER_DUP_ENTRY` → `409 Conflict`, invalid role → `400`, missing user → `404` before `protegido` (`403`) and self-edit/self-delete (`403`), zero mass assignment on `update`, and awaited `bitacora.registrar` calls (`usuarios.crear`, `usuarios.editar`, `usuarios.eliminar`).
- `backendnode/src/controllers/usuarios.controller.ts` — `createUsuariosController` and `usuariosController` with `try/catch` forwarding and `AuditContext` extraction.
- `backendnode/src/routes/usuarios.routes.ts` — `createUsuariosRouter` and `usuariosRouter` enforcing `authorize('Administrador')` and `validate(...)` on all 5 routes.
- `backendnode/tests/roles.test.ts` — 5 unit/integration tests covering RBAC (`401`/`403`/`200`), async error forwarding, and OpenAPI registration.
- `backendnode/tests/usuarios.test.ts` — 9 unit/integration tests covering RBAC across all 5 routes, `passwordhash` omission, `400`/`404`/`409` mappings, `201` `UsuarioDto` shape (`rol` instead of `rolid`), `bcrypt` cost-10 hashing, mass-assignment stripping, `protegido` & self-edit/self-delete `403` guards, audit logging, and OpenAPI registration.
- `.tickets/B005-users-and-roles/changelog.md` — This changelog.

## Security Checks Verified

- `DEC-006`: Eliminated Mass Assignment (CWE-915) on `PUT /api/usuarios/:email` via strict `UpdateUsuarioRequestSchema` and explicit `{ rolid, nombre? }` Drizzle update payload.
- `DEC-008`: Enforced backend-side `404` existence check before `403` `protegido` and `403` self-edit/self-delete guards on `PUT`/`DELETE`, plus Zod `min(6).max(128)` password policy on `POST`.
- `DEC-010`: Standardized `POST /api/usuarios` `201` response to `UsuarioDto` (`rol` instead of `rolid`), mapped invalid role → `400`, duplicate email → `409`, omitted `passwordhash`, and wrapped `GET /api/roles` in `try/catch`.
- Zero `\bany\b` occurrences in `backendnode/src/**`.

## Verification Gates

- `npx vitest run tests/roles.test.ts tests/usuarios.test.ts` — passed (`14` tests across `2` files).
- `npm run typecheck` (`tsc --noEmit`) — exited `0` with zero errors.
- `npm run build` (`tsc`) — exited `0`.
- `npm test` (`vitest run`) — passed across the entire test suite (`91` tests across `7` files) with `0` failures.
