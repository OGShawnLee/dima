# B006 — Categories & Products Services (`/api/categorias`, `/api/productos`)

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B006` | `implemented` | `Gemini 4 Hydrogen (Medium)` | `B` | `categorias`, `productos` | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-006` — Eliminate Mass Assignment (CWE-915): `PUT /api/categorias/:id` writes only `nombre` (never `protegida` or `id`); `POST`/`PUT /api/productos` writes only allowlisted `titulo`, `descripcion`, `precio`, `archivoid ?? null`.
- `DEC-009` — Safe `LIKE` search on `GET /api/productos?s=`: escape `\`, `%`, and `_` before building parameterized Drizzle `LIKE` clause.
- `DEC-010` — Consistent aliased DTOs (`categoriaId`, `productoId`) on `201 Created`, `producto.precio` coerced to JSON `number`, FK pre-validation for `archivoid` (`400` if missing), M:N duplicate link mapped to `409 Conflict`, and Zod validation mapped to `400`.

## Scope

### May create or edit
- `backendnode/src/schemas/categorias.schema.ts`
- `backendnode/src/services/categorias.service.ts`
- `backendnode/src/controllers/categorias.controller.ts`
- `backendnode/src/routes/categorias.routes.ts`
- `backendnode/src/schemas/productos.schema.ts`
- `backendnode/src/services/productos.service.ts`
- `backendnode/src/controllers/productos.controller.ts`
- `backendnode/src/routes/productos.routes.ts`
- `backendnode/tests/categorias.test.ts`
- `backendnode/tests/productos.test.ts`
- `.tickets/B006-categorias-and-productos/changelog.md`

### Must not touch
- `backendnode/src/app.ts`, `backendnode/src/index.ts`, `backendnode/src/db/**`, `backendnode/package.json`
- Any `auth`, `bitacora`, `roles`, `usuarios`, or `archivos` files
- `.routing/**`, `.gemini/**`, `frontendnet/**`
- Any other `.tickets/**` folder, or `B006`'s `task.md`, `spec.md`, `audit.md`

## Inputs

Read these files first before writing code:
1. [.routing/CONTEXT.md](../../.routing/CONTEXT.md)
2. [.routing/DECISION.md](../../.routing/DECISION.md) (`DEC-006`, `DEC-009`, `DEC-010`)
3. [.routing/SERVICES.md](../../.routing/SERVICES.md)
4. [.routing/services/categorias_service.md](../../.routing/services/categorias_service.md)
5. [.routing/services/productos_service.md](../../.routing/services/productos_service.md)
6. Existing foundation/auth files: `backendnode/src/schemas/common.schema.ts`, `backendnode/src/utils/httpError.ts`, `backendnode/src/middlewares/auth.middleware.ts`, `backendnode/src/middlewares/validate.middleware.ts`, `backendnode/src/services/bitacora.service.ts`, `backendnode/src/db/schema.ts`

## Task

1. **Categorías (`categorias_service.md`):**
   - Create `backendnode/src/schemas/categorias.schema.ts` exporting `CategoriaDtoSchema`, `CategoriaListResponseSchema`, `CreateCategoriaRequestSchema`, `UpdateCategoriaRequestSchema`, types, and `registerCategoriasPaths(registry)` (`GetCategorias`, `GetCategoriaById`, `CreateCategoria`, `UpdateCategoria`, `DeleteCategoria`, all `bearerAuth`).
   - Create `backendnode/src/services/categorias.service.ts` implementing `ICategoriasService` with injectable repository/DB + `IBitacoraService`:
     - `getAll()` / `getById(id)`: return `{ categoriaId, nombre, protegida }`.
     - `create(input, audit)`: insert `{ nombre: input.nombre, protegida: false }`, `await bitacora.registrar({ accion: 'categoria.crear', elementoid: id, ... })`, return `CategoriaDto` (`categoriaId`).
     - `update(id, input, audit)`: check existence (`404` if missing), update **only** `{ nombre: input.nombre }` (never `protegida` or `id`), `await bitacora.registrar({ accion: 'categoria.editar', elementoid: id, ... })`.
     - `delete(id, audit)`: find category (`404` if missing); if `protegida === true` → throw `badRequest('No se puede eliminar una categoría protegida.')` (`400`); delete row; `await bitacora.registrar({ accion: 'categoria.eliminar', elementoid: id, ... })`.
   - Create `backendnode/src/controllers/categorias.controller.ts` and `backendnode/src/routes/categorias.routes.ts` (`createCategoriasRouter(deps?)` + default router: `GET` & `GET /:id` → `authorize('Usuario', 'Administrador')`; `POST`/`PUT`/`DELETE` → `authorize('Administrador')` + `validate(...)`).
2. **Productos (`productos_service.md`):**
   - Create `backendnode/src/schemas/productos.schema.ts` exporting `ProductoSearchQuerySchema`, `ProductoCategoriaParamsSchema`, `AssignCategoriaBodySchema`, `ProductoDtoSchema`, `ProductoListResponseSchema`, `CreateProductoRequestSchema`, `UpdateProductoRequestSchema`, types, and `registerProductosPaths(registry)` (`GetProductos`, `GetProductoById`, `CreateProducto`, `UpdateProducto`, `DeleteProducto`, `AssignProductoCategoria`, `RemoveProductoCategoria`, all `bearerAuth`).
   - Create `backendnode/src/services/productos.service.ts` exporting `escapeLikePattern(input: string): string` (escapes `\`, `%`, `_`) and implementing `IProductosService` with injectable repository/DB + `IBitacoraService`:
     - `getAll(search?)`: if `search` is non-empty, filter `titulo` using escaped `LIKE` (`%${escapeLikePattern(search)}%`); return `ProductoDto[]` with nested `categorias: CategoriaDto[]` and `precio: Number(row.precio)`.
     - `getById(id)`: return `ProductoDto` with nested `categorias` or `null`.
     - `create(input, audit)`: if `input.archivoid != null`, verify `archivo` exists (`400` if missing); insert allowlisted fields (`precio: input.precio.toFixed(2)`, `archivoid: input.archivoid ?? null`); `await bitacora.registrar({ accion: 'producto.crear', elementoid: id, ... })`; return `ProductoDto` (`productoId`, `precio: Number(...)`, `categorias: []`).
     - `update(id, input, audit)`: verify product exists (`404`); if `input.archivoid != null`, verify `archivo` exists (`400`); update only allowlisted fields; `await bitacora.registrar({ accion: 'producto.editar', elementoid: id, ... })`.
     - `delete(id, audit)`: verify product exists (`404`); delete; `await bitacora.registrar({ accion: 'producto.eliminar', elementoid: id, ... })`.
     - `assignCategoria(productoId, categoriaId, audit)`: verify both `producto` and `categoria` exist (`404` if either missing); if link already exists (or `ER_DUP_ENTRY`) → `409 Conflict`; insert into `categoriaproducto`; `await bitacora.registrar({ accion: 'productocategoria.agregar', elementoid: `${productoId}:${categoriaId}`, ... })`.
     - `removeCategoria(productoId, categoriaId, audit)`: verify both `producto` and `categoria` exist (`404` if either missing); delete link (`404` if link did not exist); `await bitacora.registrar({ accion: 'productocategoria.remover', elementoid: `${productoId}:${categoriaId}`, ... })`.
   - Create `backendnode/src/controllers/productos.controller.ts` and `backendnode/src/routes/productos.routes.ts` (`createProductosRouter(deps?)` + default router: `GET` & `GET /:id` → `authorize('Usuario', 'Administrador')`; mutating & category link routes → `authorize('Administrador')` + `validate(...)`).
3. **Automated Tests:**
   - Create `backendnode/tests/categorias.test.ts` testing RBAC (`Usuario` can read, blocked with `403` on writes; unauthenticated → `401`), `POST` returns `201` with `categoriaId`, `PUT` strips `protegida: false` (mass-assignment defense), `DELETE` returns `400` on protected category and `204` on unprotected, `404` on missing ID, `400` on non-numeric ID, audit actions logged, and OpenAPI registration.
   - Create `backendnode/tests/productos.test.ts` testing RBAC, `escapeLikePattern` (`%`, `_`, `\`), `precio` serialized as JSON `number`, `POST`/`PUT` `archivoid` FK pre-validation (`400`), `POST` returns `201` with `productoId` + `categorias: []`, mass-assignment stripping on `PUT`, M:N `assignCategoria` (`204`, `404` missing product/category, `409` duplicate) and `removeCategoria` (`204`, `404`), exact `productId:categoriaId` audit strings, and OpenAPI registration.
4. Run `npx vitest run tests/categorias.test.ts tests/productos.test.ts` while iterating, then run full gates once before committing: `npm run typecheck`, `npm run build`, and `npm test`.

## Verification

Follow every check in [spec.md](spec.md).

## Change log

Write `.tickets/B006-categorias-and-productos/changelog.md` listing files touched, verification commands/results, and security checks verified.
