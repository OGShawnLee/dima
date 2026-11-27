# Security Audit — B005 (users-and-roles)

| Field | Value |
| :--- | :--- |
| Ticket | `B005-users-and-roles` |
| Target | `Backend` |
| Audited Commit | `73c2bb3` |
| Date | `2026-11-26` |
| Verdict | `PASS` |

Evidence: `npm ci && npx tsc --noEmit && npx vitest run` at `73c2bb3` → `tsc` 0 errors, 13 test files / 172 tests passed.

Source read: `src/routes/{usuarios,roles}.routes.ts`, `src/controllers/{usuarios,roles}.controller.ts`, `src/services/{usuarios,roles}.service.ts`, `src/schemas/{usuarios,roles,common}.schema.ts`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| No Mass Assignment | `PASS` | `UpdateUsuarioRequestSchema` = `{ nombre?, rol }`. `.set()` writes only `rolid` (+ `nombre`). `passwordhash`, `protegido`, `email`, `id` cannot be changed. Create forces `protegido: false`. |
| Auth & RBAC (`401` vs `403`) | `PASS` | All `/api/usuarios` and `/api/roles` routes require `Administrador` (401/403 tested on every route). |
| Backend-Enforced Business Guards | `PASS` | `PUT`/`DELETE` → `404` for a missing user, `403` for a `protegido` user, `403` for self-edit or self-delete (compared against the token email, case-insensitive). The role must exist (`400`). `StrongPasswordSchema` applies on create. |
| SQL & Query Safety | `PASS` | Parameterized. Duplicate email → `409` (pre-check plus an `ER_DUP_ENTRY` race guard). |
| Logging & Error Hygiene | `PASS` | No `passwordhash` in any DTO. Handlers use `next(err)`. |
| Audit Trail (`bitacora`) | `PASS` | `usuarios.crear` / `usuarios.editar` / `usuarios.eliminar` with the target email. The IP source is spoofable `request-ip` (`usuarios.controller.ts:22`). Tracked as `AUD-B011-02`. |
| Negative Tests Present | `PASS` | `usuarios.test.ts` (9) and `roles.test.ts` (5). |

## Findings

None specific to this ticket. Related cross-ticket items: `AUD-B011-02` (audit IP source) and `AUD-B010-02` (user delete cascades orders).
