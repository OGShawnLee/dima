# Security Audit — B010 (orders-module)

| Field | Value |
| :--- | :--- |
| Ticket | `B010-orders-module` |
| Target | `Backend` |
| Audited Commit | `73c2bb3` |
| Date | `2026-11-26` |
| Verdict | `PASS WITH NOTES` |

Evidence: `npm ci && npx tsc --noEmit && npx vitest run` at `73c2bb3` → `tsc` 0 errors, 172/172 tests passed (`tests/pedidos.test.ts`: 12). Source read: `src/routes/pedidos.routes.ts`, `src/controllers/pedidos.controller.ts`, `src/services/pedidos.service.ts`, `src/schemas/pedidos.schema.ts`, `src/db/schema.ts`, `db/SCHEMA.sql`, `src/app.ts`, `src/config/openapi.ts`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| No Mass Assignment | `PASS` | `CreatePedidoRequestSchema` accepts only `items[{productoId,cantidad}]`; client `precio`/`total`/`estado`/`usuarioid` are stripped (tested). Inserts use explicit columns; `usuarioid` comes from the DB lookup of the token email; `estado` is server-forced to `pendiente`. |
| Auth & RBAC (`401` vs `403`) | `PASS` | `POST /` and `GET /mios` require `Usuario`; `GET /` requires `Administrador`; `GET /:id` allows both. `/mios` is registered before `/:id`. Tests cover 401/403. |
| Object-level authorization (anti-IDOR) | `PASS` | `getById` returns `null` → `404` when a `Usuario` requests someone else's order (case-insensitive email match). `getMine` is keyed by the token email only. |
| Server-authoritative pricing | `PASS` | Prices come from `producto` at order time and are computed in integer cents. Duplicate `productoId` lines are merged and capped at 99. Unknown products → `400` before any write. Header and lines are written in one transaction. Title and price are snapshotted in `pedidodetalle`. |
| SQL & Query Safety | `PASS` | Drizzle parameterized `eq`/`inArray` only. |
| Logging & Error Hygiene | `PASS` | All handlers forward to `next(err)`. Note: the `pedido.crear` IP comes from `request-ip` (spoofable). Tracked as `AUD-B011-02`; not duplicated here. |
| Audit Trail (`bitacora`) | `PASS` | `pedido.crear` is logged with `pedidoId` after commit. |
| Secrets & Repo Hygiene | `N/A` | — |
| Negative Tests Present | `PASS` | 401/403, IDOR 404, unknown product, qty > 99, empty items, price tampering, transaction wrapping. |

## Findings

### AUD-B010-01 — Order total can exceed `DECIMAL(10,2)`; a Usuario can trigger `500`s (or a silently truncated total in non-strict SQL mode)
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/src/services/pedidos.service.ts:285-311`; `db/SCHEMA.sql` (`pedido.total DECIMAL(10,2)`)
- **CWE / OWASP:** `CWE-190 / CWE-20`
- **Issue / Exploit Scenario:** `producto.precio` may be up to 99,999,999.99, and an order may hold 50 lines × 99 units. The total is never bounded before insert. In MySQL 8 strict mode the insert fails with "Out of range" → generic `500`, plus a log-file entry on every call. If `sql_mode` drops `STRICT_TRANS_TABLES`, the total is clamped to 99,999,999.99 while the line items keep their real values, so the stored total is wrong.
- **Required Fix:** After computing `totalCents`, `throw badRequest('El total del pedido excede el máximo permitido.')` if `totalCents > 9_999_999_999`.
- **Required Regression Test:** Mock one product at `99999999.99`, order `cantidad: 2`, and expect `400` with no repository write.

### AUD-B010-02 — Deleting a user cascades and erases their order history
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/db/SCHEMA.sql:98-101` (`fk_pedido_usuario … ON DELETE CASCADE`), mirrored in `src/db/schema.ts:93`
- **CWE / OWASP:** `CWE-404 / OWASP A09:2021` (non-repudiation)
- **Issue / Exploit Scenario:** `DELETE /api/usuarios/:email` silently removes all of that user's `pedido` and `pedidodetalle` rows. An admin, or a stolen admin token, can erase transaction records. Only the bitacora `pedido.crear` IDs remain.
- **Required Fix:** Change the FK to `ON DELETE RESTRICT` in both `SCHEMA.sql` and `schema.ts`. Map the resulting FK error (`ER_ROW_IS_REFERENCED_2`, errno 1451) in `UsuariosService.delete` to `409 Conflict` ("El usuario tiene pedidos registrados"). Alternatively, adopt soft delete for users.
- **Required Regression Test:** In `usuarios.test.ts`, mock the repository delete to throw errno 1451 and expect `409`. Update the `db.test.ts` FK parity test to expect `restrict` for `pedido.usuarioid`.
