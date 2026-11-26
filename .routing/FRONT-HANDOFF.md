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

## 2026-11-26 — Accepted Frontend Requests `REQ-001`–`REQ-007` + Vagrant/Bookworm Notes (`B009`–`B011`)
- **Summary:** Reviewed [frontendnet/.routing/BACK-HANDOFF.md](../frontendnet/.routing/BACK-HANDOFF.md) and accepted all 7 requests (`DEC-013`–`DEC-017`). Final contracts are locked below so `F007` and `F008` can build against them immediately while `B009`–`B011` implement and merge tonight.
- **Finalized Contracts & Confirmations:**
  - **`REQ-001` (`POST /api/auth/registro`, `operationId: Register`, Public, rate-limited):**
    - Body: `{ email, nombre, password }` (strict Zod; any `rol` or `protegido` field is stripped; role forced server-side to `'Usuario'`, `protegido: false`).
    - Responses: `201 UsuarioDto` (`{ id, email, nombre, rol: "Usuario" }`), `400` validation (`detalles`), `409` duplicate email, `429` rate limit.
    - Bitácora action: `usuario.registro` (`email`).
  - **`REQ-002` (Strong Password Policy — `DEC-014`):**
    - Shared `StrongPasswordSchema` applied to both `POST /api/usuarios` and `POST /api/auth/registro`: **min 12, max 128**, ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 symbol.
    - `POST /api/auth` login keeps `min(1).max(128)` so dev/test seeded accounts (`gvera@uv.mx`, `patito@uv.mx`) remain usable for local testing.
  - **`REQ-003` (Orders Module — `/api/pedidos`, `DEC-015`):**
    - Accepted `FDEC-004` (cart stays in BFF session; backend persists orders in `pedido` + `pedidodetalle` with snapshotted `titulo` & `preciounitario`, `pedidodetalle.productoid` nullable `ON DELETE SET NULL`).
    - `POST /api/pedidos` (`CreatePedido`, `Usuario`): body `{ items: [{ productoId: int >= 1, cantidad: int 1..99 }] }` (1..50 items; duplicate `productoId` entries merged server-side). Recomputes prices/total from `producto.precio` in a transaction; unknown product → `400`. Returns `201 { pedidoId, total, fecha, estado }`. Audit: `pedido.crear`.
    - `GET /api/pedidos/mios` (`GetMyPedidos`, `Usuario`): returns `200 [{ pedidoId, total, fecha, estado, itemCount }]` (`id DESC`).
    - `GET /api/pedidos` (`GetPedidos`, `Administrador`): returns `200 [{ pedidoId, usuarioEmail, usuarioNombre, total, fecha, estado, itemCount }]` (`id DESC`).
    - `GET /api/pedidos/:id` (`GetPedidoById`, `Usuario` | `Administrador`): returns `200 { pedidoId, usuarioEmail, usuarioNombre, total, fecha, estado, items: [{ productoId, titulo, precioUnitario, cantidad }] }`. Non-owner `Usuario` → `404` (anti-IDOR).
  - **`REQ-004` (`TRUST_PROXY` + login limiter — `DEC-016`):** `TRUST_PROXY` will accept `'false'`, `'true'`, hop count, or comma-separated list (e.g., `loopback,10.10.10.10`). Auth rate limiter uses `req.ip` + normalized email key so users behind the BFF never lock each other out.
  - **`REQ-005` (`HOST` bind — `DEC-016`):** Adding `HOST` env var (defaults to `127.0.0.1` in `NODE_ENV=production`) passed to `app.listen(port, host)`.
  - **`REQ-006` (Remote DB setup — `DEC-017`):** Extending `scripts/setup-db.mjs` with `DB_APP_HOST` (e.g., `10.10.10.20`, still non-root + DML-only) and optional `DB_SSL` in `mysql2` pool.
  - **`REQ-007` (Deploy & anonymous endpoints):** Confirmed `GET /health` and `GET /api/archivos/:id` stay anonymous. Adding `backendnode/deploy/` templates (`backendnode.service`, `nginx-api.conf`, `install-api.sh`, `install-db.sh`, `backup-db.sh` + timer) in `B011`.
- **Feedback on Frontend Deploy & Tooling (Advisory — Frontend Owns These Files):**
  - **`Vagrantfile`, `debian/bookworm64` & 1-Command Automation:** Backend owner has a lighter Windows laptop and requests supporting **`debian/bookworm64`** with a **`virtualbox` provider block** and trimmed VM sizing (`api`: 512–768 MB / 1 vCPU, `web`: 768–1024 MB / 1 vCPU, `db`: 1024 MB / 1 vCPU). Please also keep `db` cleanly bootable standalone (`vagrant up db`, reachable at `10.10.10.30` from host `10.10.10.1`) so developers can run Node/`.NET` natively on Windows against a single ~1 GB `db` VM day-to-day and boot all 3 VMs only for full integration/grading.
  - **Fully Automated Debian 12 + Ubuntu 24.04 Provisioning:** Because `/vagrant` synced folders are cleanly disabled, `Vagrantfile` can use one-way `node.vm.provision "file"` uploads to push `backendnode/deploy/install-db.sh`, `install-api.sh`, and `backendnode/db/SCHEMA.sql` into `db`/`api` at boot and run them non-interactively (reading secrets from env vars or a gitignored `.env.deploy` — zero hardcoded secrets). `B011`'s `install-db.sh` and `install-api.sh` will auto-detect Debian 12 vs. Ubuntu 24.04 and handle Oracle MySQL 8.0 (`mysql-apt-config`, non-interactive) + Node 22 LTS (NodeSource) automatically; for `Vagrantfile`'s `apt-get upgrade`, please add `-o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"` so Debian 12 never hangs on config prompts.
  - **`t3.json`:** `runOnWorktreeCreate` uses Bash (`if [ -f ... ]`), which may fail under PowerShell on Windows — consider making it shell-portable or OS-guarded if needed.
- **References:** [DECISION.md](DECISION.md), [SERVICES.md](SERVICES.md), [pedidos_service.md](services/pedidos_service.md), [auth_service.md](services/auth_service.md)

## 2026-11-26 — All Frontend Requests `REQ-001`–`REQ-007` Implemented (`B009`, `B010`, `B011`)
- **Summary:** Tickets `B009` (Self-Registration + 12-char Password Policy), `B010` (Server-Authoritative `/api/pedidos` + 9-table `SCHEMA.sql` / Drizzle schema), and `B011` (`TRUST_PROXY` list + `${ip}:${email}` auth rate limiter + `HOST=127.0.0.1` + remote `DB_APP_HOST`/`DB_SSL` + non-interactive Debian 12 & Ubuntu 24.04 `backendnode/deploy/` scripts) are all implemented, router-verified (**13 test files, 172/172 tests passing**, `0` TS errors, `0` `any`), and merged onto `main` awaiting `$security-audit`.
- **Frontend Impact:**
  - `/openapi.json` now exports **32 operations** (including `Register`, `CreatePedido`, `GetMyPedidos`, `GetPedidos`, `GetPedidoById`) and all Pedidos/Register DTO schemas matching `DEC-013`–`DEC-015`.
  - `backendnode/deploy/` is ready to plug into `frontendnet/deploy/Vagrantfile` (`install-db.sh`, `install-api.sh`, `backendnode.service`, `nginx-api.conf`, `backup-db.{sh,service,timer}`, and `backendnode/deploy/README.md`).
  - Note: Existing local DBs should re-apply `backendnode/db/SCHEMA.sql` (or `npm run setup:db`) to create the new `pedido` and `pedidodetalle` tables.
- **References:** [backendnode/deploy/README.md](../backendnode/deploy/README.md), [pedidos_service.md](services/pedidos_service.md), [auth_service.md](services/auth_service.md), [DECISION.md](DECISION.md)
