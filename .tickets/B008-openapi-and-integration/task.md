# B008 — OpenAPI 3.0.3 Registry, Full Route Wiring & Integration Suite

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B008` | `implemented` | `Gemini 4 Hydrogen (Medium)` | `C` | All 7 services (`auth`, `bitacora`, `roles`, `usuarios`, `categorias`, `productos`, `archivos`) + OpenAPI 3.0.3 (`/openapi.json`, `/swagger`, `/docs`) | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-001` — First-class schema-driven **OpenAPI 3.0.3** contract (`/openapi.json`) generated from Zod schemas via `@asteasolutions/zod-to-openapi`, served via Swagger UI (`/swagger`) and Scalar API Reference (`/docs`) for C# / .NET client generation.
- `DEC-009` — Full Express middleware pipeline order preserved (`helmet` + `100kb` JSON cap + CORS `Set-Authorization` → docs routes → global `bitacoraMiddleware` → all 7 `/api/*` routers → method-agnostic `404` → CRLF-safe `errorHandler` last). Keep full `helmet()` active on `/api/*` (relax CSP only for `/swagger` and `/docs` UI routes so browser docs load assets cleanly).

## Scope

### May create or edit
- `backendnode/src/config/openapi.ts`
- `backendnode/src/app.ts`
- `backendnode/tests/openapi.test.ts`
- `.tickets/B008-openapi-and-integration/changelog.md`

### Must not touch
- Any service, controller, route, middleware, or schema file from `B001`–`B007` (except reading them and wiring them into `src/config/openapi.ts` and `src/app.ts`)
- `backendnode/package.json`, `backendnode/src/db/**`, `backendnode/db/**`, `backendnode/scripts/**`
- `backendnode/tests/core.test.ts`, `db.test.ts`, `setup.test.ts`, `auth.test.ts`, `bitacora.test.ts`, `roles.test.ts`, `usuarios.test.ts`, `categorias.test.ts`, `productos.test.ts`, `archivos.test.ts`
- `.routing/**`, `.gemini/**`, `frontendnet/**`
- Any other `.tickets/**` folder, or `B008`'s `task.md`, `spec.md`, `audit.md`

## Inputs

Read these files first before writing code:
1. [.routing/CONTEXT.md](../../.routing/CONTEXT.md)
2. [.routing/DECISION.md](../../.routing/DECISION.md) (`DEC-001`, `DEC-009`, `DEC-010`)
3. [.routing/SERVICES.md](../../.routing/SERVICES.md)
4. [BACKEND-API-SPEC.md](../../BACKEND-API-SPEC.md) (Sections 7 and 9 — Middleware Pipeline & OpenAPI 3.0.3 Contract)
5. Existing files in `backendnode/src/`: `app.ts`, `schemas/*.schema.ts`, `routes/*.routes.ts`, `middlewares/bitacora.middleware.ts`

## Task

1. Create `backendnode/src/config/openapi.ts` exporting `generateOpenApiDocument()`:
   - Create an `OpenAPIRegistry` (`@asteasolutions/zod-to-openapi`).
   - Register security scheme `bearerAuth` (`type: 'http'`, `scheme: 'bearer'`, `bearerFormat: 'JWT'`).
   - Register `ErrorResponseSchema` and invoke all 7 modular registrars: `registerAuthPaths`, `registerBitacoraPaths`, `registerRolesPaths`, `registerUsuariosPaths`, `registerCategoriasPaths`, `registerProductosPaths`, `registerArchivosPaths`.
   - Generate and return an **OpenAPI `3.0.3`** document using `OpenApiGeneratorV3(registry.definitions).generateDocument({ openapi: '3.0.3', info: { title: 'Dima Backend API', version: '1.0.0', description: 'Stateless TypeScript REST API for Dima (Secure Programming)' }, servers: [{ url: 'http://localhost:3000' }] })`.
2. Update `backendnode/src/app.ts` (preserving full backwards compatibility with existing `CreateAppOptions` and `tests/core.test.ts`!):
   - Keep `x-powered-by` disabled, `trust proxy`, `helmet()`, `express.json({ limit: '100kb' })`, `express.urlencoded({ extended: false, limit: '100kb' })`, and `cors({ origin, methods: 'GET,PUT,POST,DELETE', exposedHeaders: ['Set-Authorization'] })`.
   - Mount documentation endpoints cleanly (relax `Content-Security-Policy` only on `/swagger` and `/docs` so Swagger UI and Scalar scripts/styles load without weakening CSP on `/api/*`):
     - `GET /openapi.json` → `res.status(200).json(openApiDocument)`
     - `/swagger` → `swaggerUi.serve, swaggerUi.setup(openApiDocument)`
     - `/docs` → Scalar Express API Reference (`apiReference` from `@scalar/express-api-reference`, inspect its installed TypeScript types in `node_modules/@scalar/express-api-reference` so the config compiles cleanly with zero `any`) pointing to `/openapi.json`.
   - Mount `bitacoraMiddleware` globally before `/api/*` routes.
   - Mount all 7 API routers (allowing optional `mountDefaultApiRoutes?: boolean` defaulting to `true` and optional router overrides in `CreateAppOptions` if needed):
     - `app.use('/api/auth', authRouter)`
     - `app.use('/api/bitacora', bitacoraRouter)`
     - `app.use('/api/roles', rolesRouter)`
     - `app.use('/api/usuarios', usuariosRouter)`
     - `app.use('/api/categorias', categoriasRouter)`
     - `app.use('/api/productos', productosRouter)`
     - `app.use('/api/archivos', archivosRouter)`
   - Keep `GET /health`, optional `registerRoutes(app)`, method-agnostic `404` catch-all (`app.use`), and `createErrorHandler(...)` **last**.
3. Create `backendnode/tests/openapi.test.ts` (targeted test file for this ticket) using Vitest + Supertest verifying:
   - `GET /openapi.json` returns `200` JSON with `openapi: '3.0.3'`, `components.securitySchemes.bearerAuth` (`http`/`bearer`/`JWT`), and all 17 named component schemas (`LoginRequest`, `LoginResponse`, `TokenTimeResponse`, `BitacoraDto`, `RolDto`, `UsuarioDto`, `CreateUsuarioRequest`, `UpdateUsuarioRequest`, `CategoriaDto`, `CreateCategoriaRequest`, `UpdateCategoriaRequest`, `ProductoDto`, `CreateProductoRequest`, `UpdateProductoRequest`, `AssignCategoriaRequest`, `ArchivoMetadataDto`, `ErrorResponse`).
   - All 24 exact PascalCase `operationId`s across all 7 services are present in `paths`:
     - Auth: `Login`, `GetTokenRemainingTime` (`text/plain`)
     - Bitácora: `GetBitacora`
     - Roles: `GetRoles`
     - Usuarios: `GetUsuarios`, `GetUsuarioByEmail`, `CreateUsuario`, `UpdateUsuario`, `DeleteUsuario`
     - Categorías: `GetCategorias`, `GetCategoriaById`, `CreateCategoria`, `UpdateCategoria`, `DeleteCategoria`
     - Productos: `GetProductos`, `GetProductoById`, `CreateProducto`, `UpdateProducto`, `DeleteProducto`, `AssignProductoCategoria`, `RemoveProductoCategoria`
     - Archivos: `GetArchivos`, `DownloadArchivo` (`image/jpeg`, public), `GetArchivoDetalle`, `UploadArchivo` (`multipart/form-data`), `ReplaceArchivo` (`multipart/form-data`), `DeleteArchivo`
   - Public vs protected security declarations: `Login` and `DownloadArchivo` have no `bearerAuth` requirement; all other 22 operations require `bearerAuth`.
   - `GET /swagger/` and `GET /docs` respond with `200` HTML.
   - Full wired-app security smoke tests: unauthenticated requests to `/api/bitacora`, `/api/roles`, `/api/usuarios`, `/api/categorias`, `/api/productos`, `/api/archivos`, and `/api/auth/tiempo` all return `401` and omit `x-powered-by`; `POST /api/auth` with invalid body returns `400` with `detalles`.
4. Run `npx vitest run tests/openapi.test.ts` while iterating, then run full gates once right before committing: `npm run typecheck`, `npm run build`, and `npm test`.

## Verification

Follow every check in [spec.md](spec.md).

## Change log

Write `.tickets/B008-openapi-and-integration/changelog.md` listing files touched, verification commands/results, and security/OpenAPI checks verified.
