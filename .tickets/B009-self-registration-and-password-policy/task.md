# B009 — Public Self-Registration & Strong Password Policy (`REQ-001`, `REQ-002`)

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B009` | `implemented` | `Gemini 4 Hydrogen (Medium)` | `A` | `auth`, `usuarios` | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-013` (`REQ-001`) — Public self-registration `POST /api/auth/registro` (`operationId: Register`) behind `createAuthRateLimiter`, forcing `rol = 'Usuario'` and `protegido = false` server-side (strips any `rol`/`protegido` in body — CWE-915 mass assignment defense), returning `201 UsuarioDto`, `400` validation, `409` duplicate email, `429` rate limit, and logging `usuario.registro` (`email`) in `bitacora`.
- `DEC-014` (`REQ-002`) — Shared `StrongPasswordSchema` (`min(12)`, `max(128)`, ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 symbol) enforced on **both** `POST /api/usuarios` and `POST /api/auth/registro` (keeping `POST /api/auth` login `min(1).max(128)` so dev/test seeded accounts continue working).

## Scope

### May create or edit
- `backendnode/src/schemas/common.schema.ts`
- `backendnode/src/schemas/usuarios.schema.ts`
- `backendnode/src/schemas/auth.schema.ts`
- `backendnode/src/services/auth.service.ts`
- `backendnode/src/controllers/auth.controller.ts`
- `backendnode/src/routes/auth.routes.ts`
- `backendnode/tests/auth.test.ts`
- `backendnode/tests/usuarios.test.ts`
- `backendnode/tests/openapi.test.ts`
- `.tickets/B009-self-registration-and-password-policy/changelog.md`

### Must not touch
- `backendnode/src/app.ts`, `backendnode/src/index.ts`, `backendnode/src/db/**`, `backendnode/db/**`, `backendnode/scripts/**`, `backendnode/package.json`
- Any `categorias`, `productos`, `archivos`, `roles`, `bitacora`, or `pedidos` files
- `.routing/**`, `.gemini/**`, `frontendnet/**`
- Any other `.tickets/**` folder, or `B009`'s `task.md`, `spec.md`, `audit.md`

## Inputs

Read these files first before writing code:
1. [.routing/DECISION.md](../../.routing/DECISION.md) (`DEC-013`, `DEC-014`)
2. [.routing/SERVICES.md](../../.routing/SERVICES.md)
3. [.routing/services/auth_service.md](../../.routing/services/auth_service.md)
4. [.routing/services/usuarios_service.md](../../.routing/services/usuarios_service.md)
5. Existing files: `backendnode/src/schemas/common.schema.ts`, `usuarios.schema.ts`, `auth.schema.ts`, `src/services/auth.service.ts`, `src/controllers/auth.controller.ts`, `src/routes/auth.routes.ts`, `src/services/usuarios.service.ts`, `src/services/roles.service.ts`

## Task

1. In `backendnode/src/schemas/common.schema.ts`, export `StrongPasswordSchema`:
   - `z.string().min(12, 'La contraseña debe tener al menos 12 caracteres.').max(128, 'La contraseña no puede exceder 128 caracteres.').regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula.').regex(/[a-z]/, 'La contraseña debe incluir al menos una letra minúscula.').regex(/[0-9]/, 'La contraseña debe incluir al menos un dígito.').regex(/[^A-Za-z0-9]/, 'La contraseña debe incluir al menos un símbolo.')`.
2. In `backendnode/src/schemas/usuarios.schema.ts`, replace `password: z.string().min(6).max(128)` in `CreateUsuarioRequestSchema` with `password: StrongPasswordSchema`.
3. In `backendnode/src/schemas/auth.schema.ts`:
   - Export `RegisterRequestSchema` (`z.object({ email: z.string().trim().toLowerCase().email().max(255), nombre: z.string().trim().min(1).max(255), password: StrongPasswordSchema }).openapi('RegisterRequest')`) and `RegisterRequest` type.
   - Register `RegisterRequest` and `POST /api/auth/registro` (`operationId: 'Register'`, public — no `security`, responses `201 UsuarioDto`, `400`, `409`, `429`) in `registerAuthPaths(registry)`.
4. In `backendnode/src/services/auth.service.ts`:
   - Add `register(input: RegisterRequest, audit: AuditContext): Promise<UsuarioDto>` to `IAuthService` and `AuthService` (injecting optional `rolesService` and `insertRegisteredUser` / `findUserByEmail` helpers defaulting to Drizzle so tests run cleanly without live MySQL):
     - Normalize email (`trim().toLowerCase()`).
     - Look up `'Usuario'` role via `rolesService.findByNombre('Usuario')` (never accept role from client input!).
     - Check duplicate email (and handle `ER_DUP_ENTRY` / `1062`) → throw `conflict('El correo electrónico ya está registrado.')` (`409`).
     - Hash password with `bcrypt.hash(input.password, 10)` and generate `crypto.randomUUID()`.
     - Insert `{ id, email: normalizedEmail, passwordhash, nombre: input.nombre, protegido: false, rolid: usuarioRole.id }`.
     - `await this.bitacora.registrar({ accion: 'usuario.registro', elementoid: normalizedEmail, ip: audit.ip, usuario: normalizedEmail })`.
     - Return `{ id, email: normalizedEmail, nombre: input.nombre, rol: 'Usuario' }`.
5. In `backendnode/src/controllers/auth.controller.ts`, add `register` handler returning `201` JSON `UsuarioDto` (forwarding errors via `next(err)`).
6. In `backendnode/src/routes/auth.routes.ts`, mount `router.post('/registro', registerRateLimiter, validate({ body: RegisterRequestSchema }), controller.register)` (sharing or using a dedicated `createAuthRateLimiter` injectable in `AuthRouterDeps`).
7. Update tests:
   - `backendnode/tests/usuarios.test.ts`: update valid test passwords to satisfy `StrongPasswordSchema` (e.g., `'Segura2026!Ab'`) and add negative test cases rejecting short (`'Ab1!short'`), missing uppercase, missing lowercase, missing digit, and missing symbol passwords with `400`.
   - `backendnode/tests/auth.test.ts`: add comprehensive tests for `POST /api/auth/registro` (happy path `201` with `rol: 'Usuario'`, mass-assignment attempt sending `rol: 'Administrador'` & `protegido: true` still creates `'Usuario'` / `protegido: false`, weak password → `400`, duplicate email → `409`, rate limit → `429`, `usuario.registro` audit called, password never leaked).
   - `backendnode/tests/openapi.test.ts`: add `'RegisterRequest'` to `EXPECTED_SCHEMAS` and `'Register'` to `EXPECTED_OPERATION_IDS` & `PUBLIC_OPERATION_IDS`.
8. Run `npx vitest run tests/auth.test.ts tests/usuarios.test.ts tests/openapi.test.ts` while iterating, then run full gates once before committing: `npm run typecheck`, `npm run build`, `npm test`.

## Verification

Follow every check in [spec.md](spec.md).

## Change log

Write `.tickets/B009-self-registration-and-password-policy/changelog.md` listing files touched, verification results, and security checks verified.
