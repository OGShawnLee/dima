# B006 — Categorías & Productos Services Changelog

## Files Created

- `backendnode/src/schemas/categorias.schema.ts` — Zod DTOs (`CategoriaDtoSchema`, `CategoriaListResponseSchema`, `CreateCategoriaRequestSchema`, `UpdateCategoriaRequestSchema`) and `registerCategoriasPaths(registry)` for all 5 `/api/categorias` endpoints.
- `backendnode/src/services/categorias.service.ts` — `CategoriasService` (`ICategoriasService`) with Drizzle CRUD, protected-category deletion guard (`400`), mass-assignment-safe `update`, and `IBitacoraService` audit logging.
- `backendnode/src/controllers/categorias.controller.ts` — `createCategoriasController` mapping HTTP requests/params/audit context to `ICategoriasService`.
- `backendnode/src/routes/categorias.routes.ts` — `createCategoriasRouter` with RBAC (`Usuario`, `Administrador` for reads; `Administrador` for writes) and Zod `validate` middleware.
- `backendnode/src/schemas/productos.schema.ts` — Zod DTOs (`ProductoSearchQuerySchema`, `ProductoCategoriaParamsSchema`, `AssignCategoriaBodySchema`, `ProductoDtoSchema`, `ProductoListResponseSchema`, `CreateProductoRequestSchema`, `UpdateProductoRequestSchema`) and `registerProductosPaths(registry)` for all 7 `/api/productos` endpoints.
- `backendnode/src/services/productos.service.ts` — `escapeLikePattern` helper and `ProductosService` (`IProductosService`) with safe `LIKE` search, numeric `precio` serialization, `archivoid` FK pre-validation (`400`), M:N `categoriaproducto` management (`404`/`409`), and `IBitacoraService` audit logging.
- `backendnode/src/controllers/productos.controller.ts` — `createProductosController` handling CRUD, `?s=` search, and M:N category assignment/removal.
- `backendnode/src/routes/productos.routes.ts` — `createProductosRouter` with RBAC and Zod `validate` middleware.
- `backendnode/tests/categorias.test.ts` — 8 unit/integration/OpenAPI tests for `/api/categorias`.
- `backendnode/tests/productos.test.ts` — 13 unit/integration/OpenAPI tests for `/api/productos`.
- `.tickets/B006-categorias-and-productos/changelog.md` — This changelog.

## Security & Contract Checks Verified

- **No Mass Assignment (`DEC-006`):** `PUT /api/categorias/:id` writes only `{ nombre }`; `POST`/`PUT /api/productos` writes only allowlisted `titulo`, `descripcion`, `precio`, `archivoid ?? null`.
- **Protected Category Rule:** `DELETE /api/categorias/:id` returns `404` when missing and `400` when `protegida === true`.
- **Safe `LIKE` Escaping (`DEC-009`):** `escapeLikePattern` escapes `\`, `%`, and `_` before parameterized Drizzle `like(...)` queries.
- **Contract Parity (`DEC-010`):** `POST` returns `categoriaId` / `productoId`; `producto.precio` is serialized as JSON `number`; missing `archivoid` returns `400`; duplicate M:N category assignment returns `409 Conflict`.
- **RBAC:** `GET` endpoints allow `Usuario` and `Administrador`; mutating and M:N endpoints require `Administrador` (`401`/`403`).
- **Audit Trail:** Awaits `bitacora.registrar` with `categoria.crear`, `categoria.editar`, `categoria.eliminar`, `producto.crear`, `producto.editar`, `producto.eliminar`, `productocategoria.agregar` (`productId:categoriaId`), and `productocategoria.remover` (`productId:categoriaId`).
- **OpenAPI 3.0.3:** `registerCategoriasPaths` (5 `operationId`s) and `registerProductosPaths` (7 `operationId`s) registered with `bearerAuth`.
- **Zero `any`:** 0 matches for `\bany\b` in `backendnode/src/**`.

## Verification Results

- `npx vitest run tests/categorias.test.ts tests/productos.test.ts` — **2 passed (21 tests)**
- `npm run typecheck` (`tsc --noEmit`) — **exited 0**
- `npm run build` (`tsc`) — **exited 0**
- `npm test` (`vitest run`) — **7 test files passed (98 tests, 0 failures)**
