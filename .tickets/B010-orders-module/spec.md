# B010 — Verification Spec

Every checkbox below must pass deterministically before moving `B010` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

- [ ] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** errors.
- [ ] `npm run build` (`tsc`) exits `0`.

## 2. Automated Test Gate

- [ ] Targeted run: `npx vitest run tests/pedidos.test.ts tests/db.test.ts tests/setup.test.ts tests/openapi.test.ts` exits `0`.
- [ ] Final full suite run: `npm test` (`vitest run`) exits `0` with **0 failures**.

## 3. Security & Contract Checks (`DEC-015`)

- [ ] **Schema & DDL parity:** `pedido` and `pedidodetalle` defined identically in `src/db/schema.ts` and pure-DDL `db/SCHEMA.sql` (zero credentials/DML in `SCHEMA.sql`).
- [ ] **Server-side price authority (OWASP API6 / CWE-602):** Client-supplied price/total fields are stripped; totals recomputed from authoritative DB `producto.precio` in integer cents inside a transaction; unknown `productoId` → `400`; `titulo` & `preciounitario` snapshotted in `pedidodetalle`.
- [ ] **Anti-IDOR (`GET /api/pedidos/:id`):** Non-owner `Usuario` receives `404` (never `403`); owner `Usuario` and `Administrador` receive `200 PedidoDetailDto`.
- [ ] **RBAC & Route Order:** `GET /api/pedidos/mios` registered before `GET /api/pedidos/:id`; `POST /api/pedidos` & `GET /api/pedidos/mios` require `Usuario`; `GET /api/pedidos` requires `Administrador`.
- [ ] **Audit trail:** `pedido.crear` (`pedidoId`) awaited on checkout.
- [ ] **OpenAPI 3.0.3:** `CreatePedido`, `GetMyPedidos`, `GetPedidos`, `GetPedidoById` registered with `bearerAuth` and wired into `app.ts`.
- [ ] **Zero `any` in `src/`:** 0 matches for `\bany\b` in `backendnode/src/**`.

## 4. Scope & Commit Checks

- [ ] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [ ] `.tickets/B010-orders-module/changelog.md` is written.
- [ ] Single clean English Conventional Commit (e.g., `feat(backend): add server-authoritative pedidos module and schema`) with brief body overview.
