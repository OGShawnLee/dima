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
- **References:** [SERVICES.md](SERVICES.md), [PROGRESS.md](PROGRESS.md)
