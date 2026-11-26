# B010 — Changelog

## Summary

Implemented the server-authoritative Orders module (`/api/pedidos`, `REQ-003` / `DEC-015`) with 1:1 Drizzle/SQL schema parity, Zod/OpenAPI 3.0.3 contracts, transactional integer-cents checkout, anti-IDOR order lookup, RBAC route ordering, audit logging, and automated Vitest + Supertest coverage.

## Files Created

- `backendnode/src/schemas/pedidos.schema.ts` — Zod DTOs (`PedidoEstadoSchema`, `CreatePedidoItemSchema`, `CreatePedidoRequestSchema`, `PedidoCreatedDtoSchema`, `PedidoSummaryDtoSchema`, `PedidoSummaryListResponseSchema`, `PedidoAdminSummaryDtoSchema`, `PedidoAdminSummaryListResponseSchema`, `PedidoLineaDtoSchema`, `PedidoDetailDtoSchema`) and `registerPedidosPaths(registry)` for `CreatePedido`, `GetMyPedidos`, `GetPedidos`, `GetPedidoById`.
- `backendnode/src/services/pedidos.service.ts` — `IPedidosRepository`, `DrizzlePedidosRepository` (atomic `database.transaction(...)` for `pedido` + `pedidodetalle`), and `PedidosService` (`create`, `getMine`, `getAll`, `getById`).
- `backendnode/src/controllers/pedidos.controller.ts` — `createPedidosController` handlers with `ClaimTypes` actor extraction, `AuditContext`, and `notFound` / `unauthorized` error forwarding.
- `backendnode/src/routes/pedidos.routes.ts` — `createPedidosRouter` mounting `POST /`, `GET /mios` (before `GET /:id`), `GET /`, and `GET /:id`.
- `backendnode/tests/pedidos.test.ts` — 12 tests covering RBAC, `/mios` vs `/:id` route ordering, anti-IDOR `404`, server-authoritative integer-cents pricing, duplicate `productoId` merging, unknown product rejection, `pedido.crear` audit logging, DB transaction behavior, and OpenAPI registration.

## Files Modified

- `backendnode/src/db/schema.ts` — Added `pedido`, `pedidodetalle`, Drizzle relations, and inferred select/insert types.
- `backendnode/db/SCHEMA.sql` — Added pure-DDL `CREATE TABLE IF NOT EXISTS \`pedido\`` and `CREATE TABLE IF NOT EXISTS \`pedidodetalle\`` with matching FKs and `ON DELETE` rules.
- `backendnode/src/config/openapi.ts` — Registered `registerPedidosPaths(registry)` in `generateOpenApiDocument()`.
- `backendnode/src/app.ts` — Mounted `app.use('/api/pedidos', pedidosRouter)` in `createApp()`.
- `backendnode/tests/db.test.ts` — Verified all 9 tables, timestamps, and `pedido` / `pedidodetalle` foreign keys.
- `backendnode/tests/setup.test.ts` — Verified `SCHEMA.sql` ↔ `src/db/schema.ts` parity for all 9 tables.
- `backendnode/tests/openapi.test.ts` — Added Pedidos component schemas, 4 `operationId`s, and `/api/pedidos` + `/api/pedidos/mios` `401` smoke tests.

## Security Checks Verified (`DEC-015`)

- **Schema & DDL parity:** `pedido` and `pedidodetalle` match 1:1 between `src/db/schema.ts` and pure-DDL `db/SCHEMA.sql` (zero credentials/DML).
- **Server-side price authority (OWASP API6 / CWE-602):** Client-supplied price/total/status fields are stripped by Zod; duplicate `productoId`s are merged (rejecting merged `cantidad > 99` with `400`); missing product IDs return `400`; line totals and order `total` are computed in integer cents inside `database.transaction(...)`; `titulo` and `preciounitario` are snapshotted in `pedidodetalle`.
- **Anti-IDOR (`GET /api/pedidos/:id`):** Non-owner `Usuario` receives `404` (never `403`); owner `Usuario` (case-insensitive email match) and `Administrador` receive `200 PedidoDetailDto`.
- **RBAC & Route Order:** `GET /api/pedidos/mios` is registered before `GET /api/pedidos/:id`; `POST /api/pedidos` and `GET /api/pedidos/mios` require `Usuario`; `GET /api/pedidos` requires `Administrador`.
- **Audit trail:** `pedido.crear` (`elementoid: pedidoId`, `ip`, `usuario`) is awaited on checkout.
- **Zero `any` in `src/`:** Verified 0 matches for `\bany\b` in `backendnode/src/**`.

## Verification Results

- `npx vitest run tests/pedidos.test.ts tests/db.test.ts tests/setup.test.ts tests/openapi.test.ts`: 4 test files passed, 68 tests passed.
- `npm run typecheck` (`tsc --noEmit`): exited `0`.
- `npm run build` (`tsc`): exited `0`.
- `npm test` (`vitest run`): 13 test files passed, 172 tests passed (0 failures).
