# B010 — Verification Spec

Every checkbox below must pass deterministically before moving `B010` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

- [x] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** errors.
- [x] `npm run build` (`tsc`) exits `0`.

## 2. Automated Test Gate

- [x] Targeted run: `npx vitest run tests/pedidos.test.ts tests/db.test.ts tests/setup.test.ts tests/openapi.test.ts` exits `0`.
- [x] Final full suite run: `npm test` (`vitest run`) exits `0` with **0 failures**.

## 3. Security & Contract Checks (`DEC-015`)

- [x] **Schema & DDL parity:** `pedido` and `pedidodetalle` defined identically in `src/db/schema.ts` and pure-DDL `db/SCHEMA.sql` (zero credentials/DML in `SCHEMA.sql`).
- [x] **Server-side price authority (OWASP API6 / CWE-602):** Client-supplied price/total fields are stripped; totals recomputed from authoritative DB `producto.precio` in integer cents inside a transaction; unknown `productoId` → `400`; `titulo` & `preciounitario` snapshotted in `pedidodetalle`.
- [x] **Anti-IDOR (`GET /api/pedidos/:id`):** Non-owner `Usuario` receives `404` (never `403`); owner `Usuario` and `Administrador` receive `200 PedidoDetailDto`.
- [x] **RBAC & Route Order:** `GET /api/pedidos/mios` registered before `GET /api/pedidos/:id`; `POST /api/pedidos` & `GET /api/pedidos/mios` require `Usuario`; `GET /api/pedidos` requires `Administrador`.
- [x] **Audit trail:** `pedido.crear` (`pedidoId`) awaited on checkout.
- [x] **OpenAPI 3.0.3:** `CreatePedido`, `GetMyPedidos`, `GetPedidos`, `GetPedidoById` registered with `bearerAuth` and wired into `app.ts`.
- [x] **Zero `any` in `src/`:** 0 matches for `\bany\b` in `backendnode/src/**`.

## 4. Scope & Commit Checks

- [x] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [x] `.tickets/B010-orders-module/changelog.md` is written.
- [x] Single clean English Conventional Commit (e.g., `feat(backend): add server-authoritative pedidos module and schema`) with brief body overview.
