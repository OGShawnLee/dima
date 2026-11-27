# Security Audit — B006 (categorias-and-productos)

| Field | Value |
| :--- | :--- |
| Ticket | `B006-categorias-and-productos` |
| Target | `Backend` |
| Audited Commit | `73c2bb3` |
| Date | `2026-11-26` |
| Verdict | `PASS WITH NOTES` |

Evidence: `npm ci && npx tsc --noEmit && npx vitest run` at `73c2bb3` → `tsc` 0 errors, 13 test files / 172 tests passed.

Source read: `src/routes/{categorias,productos}.routes.ts`, `src/controllers/{categorias,productos}.controller.ts`, `src/services/{categorias,productos}.service.ts`, `src/schemas/{categorias,productos}.schema.ts`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| No Mass Assignment | `PASS` | Categoría update writes only `nombre`; create forces `protegida: false`. Producto create and update write only `titulo`, `descripcion`, `precio`, `archivoid` (DEC-006, tested). |
| Auth & RBAC (`401` vs `403`) | `PASS` | `GET` allows Usuario and Administrador; every mutation requires `Administrador` (tested). |
| Backend-Enforced Business Guards | `PASS` | Deleting a `protegida` category → `400` (tested). |
| SQL & Query Safety | `PASS` | `escapeLikePattern` escapes `\`, `%`, `_` (MySQL's default `LIKE` escape is `\`); `?s` is capped at 255. Missing `archivoid` → `400`, missing product or category → `404`, duplicate link → `409`. |
| Logging & Error Hygiene | `PASS` | Handlers use `next(err)`. `precio` is serialized as a number. |
| Audit Trail (`bitacora`) | `PASS` | `categoria.*`, `producto.*`, `productocategoria.agregar/remover`. The IP source is `request-ip`; tracked as `AUD-B011-02`. |
| Negative Tests Present | `PASS` | `categorias.test.ts` (8) and `productos.test.ts` (13). |

## Findings

### AUD-B006-01 — `precio` uses `z.coerce.number()`, so `null`, `""`, `[]` and `false` become `0`
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/src/schemas/productos.schema.ts:40`
- **CWE / OWASP:** `CWE-20 / CWE-1287`
- **Issue / Exploit Scenario:** `Number(null) === 0`, `Number("") === 0`, `Number(true) === 1`. A buggy or malicious admin client, or a BFF form posting an empty field, can silently set a product to `$0.00`. Because B010 trusts DB prices, customers can then order it for free. This is admin-only, hence Low.
- **Required Fix:** Use `z.union([z.number(), z.string().trim().regex(/^\d{1,8}(\.\d{1,2})?$/).transform(Number)])` followed by `.pipe(z.number().finite().nonnegative().max(99999999.99))`. That is, accept a number or a strict decimal string only. Consider also `.positive()` if zero-price products are not a business requirement.
- **Required Regression Test:** `POST /api/productos` with `precio: null`, `precio: ""` and `precio: true` each returns `400`.
