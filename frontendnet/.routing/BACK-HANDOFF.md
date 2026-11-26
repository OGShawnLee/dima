# Dima — Frontend-to-Backend Handoff Log

> **Single-Writer Rule:** This file is **append-only** and written **exclusively by the Frontend Router**. The Backend Router reads it for API requests, integration bugs, and deployment needs, and answers in [`.routing/FRONT-HANDOFF.md`](../../.routing/FRONT-HANDOFF.md).

## Entry Format

```markdown
## YYYY-MM-DD — <Short Title> (`<Request ID>`)
- **Priority:** Blocker | High | Medium | Low
- **Needed by:** <date/time>
- **Request:** What the frontend needs.
- **Why:** Requirement / rubric / security rationale.
- **Proposed contract:** Endpoint, DTO, status codes (backend may change it; publish the final one in FRONT-HANDOFF.md).
```

---

## Handoff Log

> Context: hard deadline **2026-11-27 13:00 (America/Mexico_City)** for a working 3-server deployment. Items 1–3 block frontend features; items 4–7 block deployment.

## 2026-11-26 — Self-registration endpoint (`REQ-001`)
- **Priority:** Blocker (rubric "Funcionalidad", project brief module 1 "Crear cuenta para comprar")
- **Needed by:** 2026-11-26 22:00
- **Request:** Public account creation. Today `POST /api/usuarios` requires `Administrador`.
- **Why:** Required functional module; frontend ticket `F007`.
- **Proposed contract:** `POST /api/auth/registro` (anonymous, rate-limited like `POST /api/auth`) body `{ email, nombre, password }` → `201 { email, nombre, rol: "Usuario" }`; `400` validation, `409` duplicate. Role is **forced server-side** to `Usuario` (ignore any `rol` in the body — mass assignment). Bitácora action e.g. `usuario.registro`.

## 2026-11-26 — Stronger password policy (`REQ-002`)
- **Priority:** High (project requirement "Política de contraseñas seguras"; rubric "Contraseñas fuertes")
- **Needed by:** 2026-11-26 22:00
- **Request:** Replace `password: z.string().min(6).max(128)` in `usuarios.schema.ts` (and use it for `REQ-001`) with: min 12, max 128, at least one uppercase, one lowercase, one digit, one symbol. Frontend mirrors the same rule in `PasswordPolicyAttribute` (F005/F007).
- **Why:** `min(6)` alone does not meet the secure password policy requirement; backend is the source of truth for validation.
- **Note:** Check that seeded accounts still satisfy the policy or document them as legacy seed data.

## 2026-11-26 — Orders module (`REQ-003`)
- **Priority:** Blocker (project brief modules 2 "Carrito de compra" checkout and 3 "Pedidos recibidos (admin)")
- **Needed by:** 2026-11-26 22:00 (contract), 2026-11-27 08:00 (merged)
- **Request:** Persist orders. The cart itself stays in the BFF session ([FDEC-004](DECISION.md#fdec-004)) unless you prefer `/api/carrito` — tell us in FRONT-HANDOFF.
- **Proposed contract:**
  - `POST /api/pedidos` (`Usuario`) body `{ items: [{ productoId:int, cantidad:int 1..99 }] (1..50 items) }` → `201 { pedidoId, total, fecha, estado }`. **Backend recomputes prices from `producto.precio`**; never accept prices from the client. Unknown product → `400`.
  - `GET /api/pedidos/mios` (`Usuario`) → own orders.
  - `GET /api/pedidos` (`Administrador`) → all orders with customer email.
  - `GET /api/pedidos/{id}` (owner or `Administrador`; others → `404` to avoid IDOR enumeration) → order + lines `{ productoId, titulo, precioUnitario, cantidad }`.
  - Suggested tables: `pedido(id, usuarioid, total DECIMAL(10,2), fecha, estado)`, `pedidodetalle(pedidoid, productoid, titulo, preciounitario, cantidad)` (snapshot title/price at purchase time). Bitácora action `pedido.crear`.

## 2026-11-26 — Rate limiting and audit IP behind the BFF (`REQ-004`)
- **Priority:** High (production DoS on login; wrong audit data)
- **Needed by:** 2026-11-27 08:00
- **Request:** All API traffic comes from the `web` server, so `express-rate-limit` (10 / 15 min per IP on `POST /api/auth`) currently counts **every user together** and `bitacora` logs the frontend server IP. The BFF now sends `X-Forwarded-For: <browser IP>` ([FDEC-006](DECISION.md#fdec-006)).
- **Proposed change:** support `TRUST_PROXY` as a list (e.g. `loopback,10.10.10.10`) passed to `app.set('trust proxy', ...)` so `req.ip` is the browser IP only when the request comes from nginx on `api` + the `web` server. Optionally key the login limiter by `ip + email`.

## 2026-11-26 — Bind address for production (`REQ-005`)
- **Priority:** High (rubric: port 3000 closed)
- **Needed by:** 2026-11-27 08:00
- **Request:** `index.ts` calls `app.listen(SERVER_PORT)` on all interfaces. Add env `HOST` (default `127.0.0.1` in production) → `app.listen(port, host)` so only nginx on the same server can reach `:3000`.

## 2026-11-26 — Remote database host in setup script (`REQ-006`)
- **Priority:** High (rubric: separate DB server)
- **Needed by:** 2026-11-27 08:00
- **Request:** `scripts/setup-db.mjs` only allows `DB_HOST` `localhost`/`127.0.0.1` and grants `'<user>'@'localhost'`. Add an option (e.g. `DB_APP_HOST=10.10.10.20`) to create/grant the least-privilege app user as `'<user>'@'10.10.10.20'` when MySQL runs on `db.dima.lab`, keeping the root-user and DML-only rules. Optional: `require_secure_transport` + `ssl` options in the mysql2 pool.

## 2026-11-26 — Production deployment of `api` and `db` (`REQ-007`)
- **Priority:** High
- **Needed by:** 2026-11-27 09:30
- **Request:** Bring up `api` (10.10.10.20) and `db` (10.10.10.30) following Phases 2–3 of [deploy/DEPLOY-PLAN.md](../deploy/DEPLOY-PLAN.md): systemd service with `Restart=always` + enabled on boot, nginx TLS on 443 (cert `api.dima.lab` from the lab CA, given out of band), `ufw` allowing 443 only from `10.10.10.10`, MySQL 3306 only from `10.10.10.20`, nightly `mysqldump`, seed run once before `NODE_ENV=production`.
- **Also confirm:** `GET /health` stays anonymous (used by deploy smoke checks); `GET /api/archivos/:id` stays anonymous (BFF image proxy, [FDEC-002](DECISION.md#fdec-002)).

## 2026-11-26 — Audit schedule notice (`INFO-001`)
- **Priority:** Low (informational)
- **Request:** None. The Security Auditor will audit `B001`–`B008` today (2026-11-26, 14:00–18:30). Expect `CHANGES REQUESTED` entries in `.routing/AUDIT-HANDOFF.md` this evening; please keep a worker warm. New endpoints from `REQ-001`/`REQ-003` should come as new `B` tickets so they can be audited too.
- **Tooling note:** a root `t3.json` (T3 Code project actions, no secrets) is proposed in the frontend branch; feel free to own/move it — it does not affect the build.
