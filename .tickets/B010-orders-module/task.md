# B010 — Server-Authoritative Orders Module (`/api/pedidos`, `REQ-003`)

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B010` | `draft` | `Gemini 4 Hydrogen (Medium)` | `B` | `pedidos` (`pedido` + `pedidodetalle` schema & DDL + endpoints) | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-015` (`REQ-003`) — Add `pedido` and `pedidodetalle` tables to both `backendnode/src/db/schema.ts` and `backendnode/db/SCHEMA.sql` (maintaining 1:1 parity and pure DDL).
- `DEC-015` — Server-authoritative checkout (`POST /api/pedidos`, `Usuario`): never accept prices/totals from the client (OWASP API6 / CWE-602); merge duplicate `productoId`s, fetch `producto.precio` & `producto.titulo` from MySQL, compute totals in integer cents inside a transaction, snapshot `titulo` & `preciounitario` in `pedidodetalle`, log `pedido.crear` (`pedidoId`).
- `DEC-015` — Anti-IDOR (`GET /api/pedidos/:id`): `Administrador` can view any order; `Usuario` can view only their own orders and receives **`404`** (not `403`) for another user's order ID.

## Scope

### May create or edit
- `backendnode/src/db/schema.ts`
- `backendnode/db/SCHEMA.sql`
- `backendnode/src/schemas/pedidos.schema.ts`
- `backendnode/src/services/pedidos.service.ts`
- `backendnode/src/controllers/pedidos.controller.ts`
- `backendnode/src/routes/pedidos.routes.ts`
- `backendnode/src/config/openapi.ts`
- `backendnode/src/app.ts`
- `backendnode/tests/db.test.ts`
- `backendnode/tests/setup.test.ts`
- `backendnode/tests/pedidos.test.ts`
- `backendnode/tests/openapi.test.ts`
- `.tickets/B010-orders-module/changelog.md`

### Must not touch
- `backendnode/package.json`, `backendnode/src/db/index.ts`, `backendnode/src/db/seed.ts`, `backendnode/scripts/**`
- Any `auth`, `bitacora`, `roles`, `usuarios`, `categorias`, `productos`, or `archivos` files
- `.routing/**`, `.gemini/**`, `frontendnet/**`
- Any other `.tickets/**` folder, or `B010`'s `task.md`, `spec.md`, `audit.md`

## Inputs

Read these files first before writing code:
1. [.routing/DECISION.md](../../.routing/DECISION.md) (`DEC-015`)
2. [.routing/SERVICES.md](../../.routing/SERVICES.md)
3. [.routing/services/pedidos_service.md](../../.routing/services/pedidos_service.md)
4. Existing files: `backendnode/src/db/schema.ts`, `backendnode/db/SCHEMA.sql`, `backendnode/src/config/openapi.ts`, `backendnode/src/app.ts`, `backendnode/tests/db.test.ts`, `backendnode/tests/setup.test.ts`, `backendnode/tests/openapi.test.ts`

## Task

1. **Database Schema & Pure DDL Parity:**
   - In `backendnode/src/db/schema.ts`, add `pedido` (Layer 1: `id`, `usuarioid` FK→`usuario.id` cascade/cascade, `total` `decimal(10,2)`, `fecha` `datetime` default `CURRENT_TIMESTAMP`, `estado` `varchar(50)` default `'pendiente'`, `timestamps`) and `pedidodetalle` (Layer 2: `id`, `pedidoid` FK→`pedido.id` cascade/cascade, `productoid` nullable FK→`producto.id` cascade/set null, `titulo` `varchar(255)`, `preciounitario` `decimal(10,2)`, `cantidad` `int`, `timestamps`), Drizzle `relations(...)`, and inferred `Pedido`/`NewPedido`/`PedidoDetalle`/`NewPedidoDetalle` types.
   - In `backendnode/db/SCHEMA.sql`, add matching pure-DDL `CREATE TABLE IF NOT EXISTS \`pedido\`` and `CREATE TABLE IF NOT EXISTS \`pedidodetalle\`` statements (zero credentials/DML).
   - Update `backendnode/tests/db.test.ts` and `backendnode/tests/setup.test.ts` to verify all 9 tables, FKs, and `SCHEMA.sql` ↔ `schema.ts` parity.
2. **Schemas & OpenAPI (`src/schemas/pedidos.schema.ts`):**
   - Implement `PedidoEstadoSchema`, `CreatePedidoItemSchema`, `CreatePedidoRequestSchema`, `PedidoCreatedDtoSchema`, `PedidoSummaryDtoSchema`, `PedidoAdminSummaryDtoSchema`, `PedidoLineaDtoSchema`, `PedidoDetailDtoSchema`, list schemas, types, and `registerPedidosPaths(registry)` declaring `CreatePedido`, `GetMyPedidos`, `GetPedidos`, `GetPedidoById` (all `bearerAuth`).
3. **Service (`src/services/pedidos.service.ts`):**
   - Implement `IPedidosRepository`, `DrizzlePedidosRepository` (wrapping `pedido` + `pedidodetalle` creation inside `database.transaction(...)`), and `PedidosService` implementing `IPedidosService` (`create`, `getMine`, `getAll`, `getById`):
     - `create(input, actorEmail, audit)`: resolve `usuario` by `actorEmail` (`401` if missing); merge duplicate `productoId`s in `input.items` (reject with `400` if merged `cantidad > 99`); fetch all requested products by IDs; if any product ID is missing throw `badRequest('Uno o más productos no existen.')` (`400`); compute line totals and order total using integer cents (`Math.round(Number(precio) * 100)`) and format `total` as `DECIMAL(10,2)`; create `pedido` + `pedidodetalle` snapshot lines atomically; `await bitacora.registrar({ accion: 'pedido.crear', elementoid: pedidoId, ip: audit.ip, usuario: audit.actorEmail })`; return `PedidoCreatedDto` (`total` as JSON `number`, `fecha` ISO string).
     - `getMine(actorEmail)`: return caller's orders ordered `id DESC` with `itemCount` (sum of quantities or line count — use sum of line quantities consistently and document it) and numeric `total`.
     - `getAll()`: return all orders joined with `usuario` (`usuarioEmail`, `usuarioNombre`) ordered `id DESC`.
     - `getById(id, actor)`: fetch order + lines; if not found return `null`; if `actor.rol === 'Usuario'` and `order.usuarioEmail.toLowerCase() !== actor.email.toLowerCase()`, return `null` (so controller returns `404` — anti-IDOR!).
4. **Controller & Routes (`src/controllers/pedidos.controller.ts`, `src/routes/pedidos.routes.ts`):**
   - Register routes in strict order:
     - `POST /` → `[authorize('Usuario'), validate({ body: CreatePedidoRequestSchema }), controller.create]`
     - `GET /mios` → `[authorize('Usuario'), controller.getMine]` (**MUST come before `GET /:id`!**)
     - `GET /` → `[authorize('Administrador'), controller.getAll]`
     - `GET /:id` → `[authorize('Usuario', 'Administrador'), validate({ params: NumericIdParamSchema }), controller.getById]`
5. **Wire into `src/config/openapi.ts` & `src/app.ts`:**
   - Call `registerPedidosPaths(registry)` in `generateOpenApiDocument()`.
   - Mount `app.use('/api/pedidos', pedidosRouter)` in `createApp()`.
6. **Tests (`tests/pedidos.test.ts` + update `tests/openapi.test.ts`):**
   - Verify RBAC: `POST /api/pedidos` & `GET /api/pedidos/mios` allow `Usuario` and reject `Administrador` (`403`) & unauthenticated (`401`); `GET /api/pedidos` allows `Administrador` and rejects `Usuario` (`403`); `GET /api/pedidos/:id` allows owner `Usuario` and `Administrador`, returns **`404`** when another `Usuario` requests someone else's order (anti-IDOR!).
   - Verify server-side price authority: sending extra `precio: 0.01` / `total: 0` fields in `POST /api/pedidos` is stripped and `total` equals authoritative DB prices; duplicate `productoId` items merge cleanly; unknown `productoId` returns `400`; empty items or `cantidad > 99` returns `400`; `pedido.crear` audit logged.
   - Update `tests/openapi.test.ts` with the new Pedidos schemas, 4 `operationId`s, and `/api/pedidos` `401` smoke check.
7. Run `npx vitest run tests/pedidos.test.ts tests/db.test.ts tests/setup.test.ts tests/openapi.test.ts` while iterating, then run full gates once before committing: `npm run typecheck`, `npm run build`, `npm test`.

## Verification

Follow every check in [spec.md](spec.md).

## Change log

Write `.tickets/B010-orders-module/changelog.md` listing files touched, verification results, and security checks verified.
