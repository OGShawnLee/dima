# B008 — OpenAPI 3.0.3 Registry, Full Route Wiring & Integration Suite Changelog

## Files Created or Modified

- `backendnode/src/config/openapi.ts` — Created `generateOpenApiDocument()` using `OpenAPIRegistry` and `OpenApiGeneratorV3` to emit OpenAPI `3.0.3` with `bearerAuth` (`http`/`bearer`/`JWT`), `ErrorResponse`, and all 7 service path registrars (`registerAuthPaths`, `registerBitacoraPaths`, `registerRolesPaths`, `registerUsuariosPaths`, `registerCategoriasPaths`, `registerProductosPaths`, `registerArchivosPaths`).
- `backendnode/src/app.ts` — Updated `createApp(options?)` to serve `GET /openapi.json`, `/swagger` (`swagger-ui-express`), and `/docs` (`Scalar` from `@scalar/express-api-reference` pointing to `/openapi.json`) with CSP relaxed only for `/swagger` and `/docs` while keeping full `helmet()` active on `/api/*`; mounted `bitacoraMiddleware` globally before `/api/*` routes; wired all 7 API routers (`/api/auth`, `/api/bitacora`, `/api/roles`, `/api/usuarios`, `/api/categorias`, `/api/productos`, `/api/archivos`) with `mountDefaultApiRoutes` defaulting to `true`; preserved `options.registerRoutes`, method-agnostic `404` catch-all, and `createErrorHandler(...)` last.
- `backendnode/tests/openapi.test.ts` — Created Vitest + Supertest suite (10 tests) verifying OpenAPI `3.0.3` output, `bearerAuth`, all 17 named component schemas, all 27 PascalCase `operationId`s across all 7 services (`Login` and `DownloadArchivo` public; all others requiring `bearerAuth`), `text/plain` / `multipart/form-data` / `image/jpeg` content types, `GET /swagger/` and `GET /docs` `200` HTML responses, and full wired-app `401`/`400` + `helmet()` smoke checks.

## Verification

- `npx vitest run tests/openapi.test.ts`: **1 test file passed, 10 tests passed**
- `npm run typecheck` (`tsc --noEmit`): **exit 0 (0 errors)**
- `npm run build` (`tsc`): **exit 0**
- `npm test` (`vitest run`): **11 test files passed, 132 tests passed (0 failures)**
- Zero `any` in `backendnode/src/**`: **0 matches**

## Security & OpenAPI Checks Verified

- `DEC-001`: OpenAPI `3.0.3` document served at `/openapi.json` with `bearerAuth`, 17 named component schemas, and all 27 `operationId`s across all 7 services.
- `DEC-009`: Full `helmet()` remains active on all `/api/*` routes (no `x-powered-by`, `X-Content-Type-Options: nosniff`); CSP is relaxed only on `/swagger` and `/docs`.
- `DEC-009`: `bitacoraMiddleware` is mounted globally before `/api/*` routes, and `errorHandler` remains last.
