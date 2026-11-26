# Dima — Backend-to-Frontend Handoff Log

> **Single-Writer Rule:** This file is **append-only** and written **exclusively by the Backend Router**. The Frontend Router and Security Auditor read this file for API contract updates, new endpoints, and `/openapi.json` notices.
>
> To send requests or integration bugs back to the Backend, the Frontend Router writes in **`frontendnet/.routing/BACK-HANDOFF.md`** (never in this file) so GitHub merges stay conflict-free.

## Entry Format

```markdown
## YYYY-MM-DD — <Short Title> (`<Ticket ID or Contract Notice>`)
- **Summary:** What changed on the backend or OpenAPI 3.0.3 contract.
- **Frontend Impact:** Exact DTO, endpoint, header, or status code impact (or `None`).
- **References:** Links to `.routing/services/{name}_service.md` or `/openapi.json`.
```

---

## Handoff Log

## 2026-11-25 — Backend Source-of-Truth Contract Initialized (`Setup`)
- **Summary:** The backend (`backendnode`) OpenAPI 3.0.3 contract is now mapped across [.routing/SERVICES.md](SERVICES.md) and `.routing/services/*_service.md`. All endpoints will be served at `http://localhost:3000` with `/openapi.json`, `/swagger`, and `/docs`.
- **Frontend Impact (Standardizations vs. Original Course PDF):**
  - `POST /api/usuarios` returns `{ id, email, nombre, rol }` (standardized from legacy `rolid`).
  - `POST /api/archivos` returns `{ archivoId, mime, indb, nombre, size }` (standardized from legacy `{ id, mime, indb, nombre }`).
  - `POST /api/categorias` and `POST /api/productos` return aliased IDs (`categoriaId`, `productoId`) matching `GET`.
  - `producto.precio` is serialized as a JSON `number`; `producto.archivoid` remains lowercase `archivoid`.
  - Valid JWT with wrong role returns `403 Forbidden` (reserving `401 Unauthorized` for missing/invalid/expired tokens so valid users aren't auto-logged out).
  - `GET /api/auth/tiempo` explicitly returns `text/plain; charset=utf-8`.
  - Backend enforces `<= 100 KB` + JPEG magic-byte validation on `/api/archivos`, plus backend guards preventing `protegido` edits and admin self-edit/self-delete on `/api/usuarios`.
- **References:** [SERVICES.md](SERVICES.md), [PROGRESS.md](PROGRESS.md), [DECISION.md](DECISION.md)

## 2026-11-25 — Security Decisions Logged (`DEC-002`, `DEC-003`, `DEC-004`)
- **Summary:** Created [.routing/DECISION.md](DECISION.md) to track all intentional security and contract improvements over the original course specs.
- **Frontend Impact:**
  - **DB-checked sliding refresh (`DEC-003`):** During the `< 5 min` refresh window, if a user was deleted or demoted in MySQL, the backend will reject with `401` (deleted → triggers `/Auth/Salir`) or `403` (role revoked) instead of refreshing stale claims.
  - **Failed-login audit rows (`DEC-004`):** `GET /api/bitacora` will now include `usuario.login.fallido` entries alongside `usuario.login` so admins can see failed login attempts in `/Bitacora`.
- **References:** [DECISION.md](DECISION.md), [auth_service.md](services/auth_service.md)

## 2026-11-25 — Complete Backend API & OpenAPI 3.0.3 Contract Live on `main` (`B008`)
- **Summary:** All 8 backend implementation tickets (`B001`–`B008`) are implemented, router-verified (`132/132` tests passing, `0` TS errors, `0` `any`), and pushed to `origin/main`. All 7 services (27 operations across `/api/auth`, `/api/bitacora`, `/api/roles`, `/api/usuarios`, `/api/categorias`, `/api/productos`, `/api/archivos`) plus `/health`, `/openapi.json` (OpenAPI 3.0.3), `/swagger`, and `/docs` (Scalar) are wired and ready.
- **Frontend Impact:**
  - Start the backend locally (`cd backendnode && npm ci && npm run setup:env && npm run setup:db -- --seed && npm run dev`) to consume `http://localhost:3000/openapi.json` for Kiota/Refitter C# client generation or direct `HttpClient` integration.
  - All 17 named DTO schemas and 27 PascalCase `operationId`s match `.routing/SERVICES.md` and `DEC-001`–`DEC-012`.
  - Tickets `B001`–`B008` are currently in status `implemented` awaiting `$security-audit`; any audit-driven fixes will be logged here if they affect the contract.
- **References:** [SERVICES.md](SERVICES.md), [DECISION.md](DECISION.md), [backendnode/README.md](../backendnode/README.md)
