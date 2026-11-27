# Dima Frontend — Progress & Work Plan (`frontendnet`)

> **Single-Writer Rule:** Written exclusively by the **Frontend Router**. Readable by everyone. The Security Auditor picks tickets in status `implemented` from this file.

## Current Status

- **Phase:** Planning complete — implementation starts `2026-11-26`.
- **Hard deadline:** **2026-11-27 13:00 (America/Mexico_City)** — frontend complete **and** 3-server deployment passing the rubric's 7 live tests.
- **Backend status:** `B009`–`B011` merged on `main` (registration, `/api/pedidos`, proxy/host/remote-DB) — `F007` is **unblocked** (see `.routing/FRONT-HANDOFF.md` 2026-11-26). Local DB must re-apply `SCHEMA.sql` before F007 smoke tests.

## Ticket Board

| Ticket | Title | Status | Lane | Depends on | Audit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `F001` | MVC scaffold, BFF auth bridge, layout | `implemented` (on `main` @ `3397900`) | Front | backend running locally | — |
| `F002` | Categorías CRUD | `implemented` (on `main` @ `1428abf`) | Front | F001 | — |
| `F003` | Archivos CRUD + BFF image proxy | `implemented` (on `main` @ `6d627d9`) | Front | F001 | — |
| `F004` | Productos CRUD + categories M:N | `implemented` (on `main` @ `71c4dd1`) | Front | F002, F003 | — |
| `F005` | Usuarios CRUD + Bitácora | `implemented` (on `main` @ `ac70091`) | Front | F001 | — |
| `F006` | Comprar catalog + session cart | `implemented` (on `main` @ `bef862c`) | Front | F004 | — |
| `F007` | Self-registration + checkout + orders (customer & admin) | `implemented` (on `main` @ `15f417d`) | Front | F006 + backend endpoints | — |
| `F008` | Production hardening + 3-server deployment | step A `implemented` (on `main` @ `87b609d`); step B `draft` | Front/Ops | F001–F007; step B after F009 | — |
| `F009` | App hardening: Spanish binding messages, global API-error filter, image cache headers | `implemented` (on `main` @ `c3e1251`) | Front | F001–F007 | — |

`F002`, `F003`, and `F005` touch disjoint files and can run in **parallel worktrees** once `F001` is merged. `F008` step A (deploy files) and `F009` (app code) are disjoint and can run in parallel.

## Timeline (America/Mexico_City)

| Window | Front lane (T3 thread "Frontend") | Audit lane (T3 thread "Audit") |
| :--- | :--- | :--- |
| Thu 13:30–14:00 | Install `dotnet-sdk-10.0`; start backend locally (`npm ci && npm run setup:env && npm run setup:db -- --seed && npm run dev`); push this plan + `BACK-HANDOFF.md` | Read `security-audit` skill; record `main` SHA |
| Thu 14:00–16:00 | **F001** (milestone: login → `/Perfil` shows `/api/auth/tiempo`) | Audit **B001–B004** (scaffold, schema, setup scripts, auth) |
| Thu 16:00–18:30 | **F002 ‖ F003 ‖ F005** in parallel worktrees | Audit **B005–B008** |
| Thu 18:30–20:30 | **F004**, then **F006** | Audit **F001** |
| Thu 20:30–23:00 | **F007** (if backend endpoints merged; otherwise build against the agreed contract and finish Fri 08:00) | Audit **F002, F003, F005** |
| Fri 08:00–10:30 | **F008** deploy: 3 VMs, TLS, systemd, nginx, ufw | Audit **F004, F006, F007** |
| Fri 10:30–12:00 | Run the 7 rubric tests on the deployed system; fix | Audit **F008** (ports, services, headers) |
| Fri 12:00–13:00 | Buffer, freeze, tag `v1.0.0`, zip source + config scripts + test accounts | Final `AUDIT-HANDOFF.md` entries |

## Rubric coverage owned by frontend

| Rubric item | Covered by |
| :--- | :--- |
| Cliente web: clear pattern, no mixed code, full API communication, keeps state after API restart | F001–F007 (MVC + services + cookie BFF) |
| Funcionalidad: 2 roles, auth, RBAC, CRUD, multimedia, registration, cart, orders, dev + prod envs | F001–F007, F008 |
| Seguridad: client validation, auth in frontend, cookies, session refresh/expiry, 80 closed, strong passwords | F001, F007, F008 |
| Uso de servidores: 3 servers, reverse proxy, services, firewall | F008 |
| Pruebas: 1 client validation, 3 private sections, 5 auto-start on reboot, 6 JWT refresh, 7 netstat | F001, F008 |

## Router Verification Log

- 2026-11-26 — `F001` @ `3397900` verified by router: Release build 0 warnings / 0 errors; no `async void`; global `AutoValidateAntiforgeryTokenAttribute` (`POST /Auth` without token → `400`); no `Html.Raw`; `net10.0`; `IniciaSesionAsync` returns `Task` and is awaited; no secrets in `appsettings*.json`; scope ⊆ ticket. Live smoke (https profile): generic login error, admin → `/Productos`, `/Perfil` shows claims + `/api/auth/tiempo`, cookie `secure; samesite=strict; httponly`, CSP / `nosniff` / `DENY` / `Referrer-Policy` present, **session survives backend restart**, tampered cookie and anonymous → `/Auth`, `/Auth/Salir` expires the cookie. Worker evidence accepted for JWT sliding refresh, expired JWT → `/Auth/Salir`, Production hides raw JWT, `X-Forwarded-For` visible in `bitacora`.
- 2026-11-26 — `F003` @ `6d627d9` verified by router: Release build 0 warnings / 0 errors; no `async void`; no `Html.Raw`, no `PublicUrlWebAPI` / `:3000` in Views; controller `[Authorize(Roles = "Administrador")]` with only `Imagen` `[AllowAnonymous]` behind an `{id:int}` constraint; scope ⊆ ticket. Live: unknown id → `404` + `no-store`, `abc` and encoded path-traversal → `404`, anonymous `/Archivos` → `/Auth`. Worker evidence accepted for upload/replace/delete, oversize / non-JPEG rejection, proxy `image/jpeg` + `nosniff`, Usuario → AccessDenied. Audit note: `Imagen` is `public, max-age=300`; a logged-in request near JWT expiry could carry a refreshed `Set-Cookie` on that cacheable response (no shared cache in the deploy plan).
- 2026-11-26 — `F005` @ `ac70091` (worker `537dcc4` rebased onto `d4bd3e6`, clean) verified by router: Release `--no-incremental` build 0 warnings / 0 errors; no `async void`; no `Html.Raw`; no `IgnoreAntiforgery` / `AllowAnonymous`; both controllers `[Authorize(Roles = "Administrador")]`; `PasswordPolicyAttribute` = 12–128 chars + upper/lower/digit/symbol (matches DEC-014); scope ⊆ ticket. Live: Usuario → AccessDenied on `/Usuarios`, `/Bitacora`, `/Usuarios/Editar/*`; admin `/Usuarios` and `/Bitacora` render. Worker evidence accepted for CRUD, weak-password rejection (server + jsdom client), own-account and protected-admin `403`, duplicate `409`, Mexico City timestamps. Not verified: expired JWT → `/Auth/Salir` on these pages (shared handler, verified in F001).
- 2026-11-26 — `F002` @ `1428abf` (worker `4acd125` rebased onto `8455240`, clean) verified by router: Release `--no-incremental` build 0 warnings / 0 errors; no `async void`; no `Html.Raw`; `[Authorize(Roles = "Administrador")]`; `[Bind("Nombre")]` on create/edit (forged `Protegida` ignored); scope ⊆ ticket. Live: Usuario → AccessDenied on `/Categorias` and `/Categorias/Crear`; admin list shows seeded categories; `Nombre` carries `data-val-required`; POST without token → `400`. Worker evidence accepted for full CRUD, `<script>` encoded, invalid and genuinely expired JWT → `/Auth/Salir`, forged delete of a protected category shown inline. Spec corrected: the backend answers `400` (not `403`) for protected categories. Not verified: client-side empty-name block in a real browser.
- 2026-11-26 — `F004` @ `71c4dd1` (based on `5121f0a`, fast-forward) verified by router: Release `--no-incremental` build 0 warnings / 0 errors; no `async void`; no `Html.Raw` or API host in Views; `[Authorize(Roles = "Administrador")]`; `[Bind]` whitelists on create/edit/category-add; `[JsonPropertyName("archivoid")]`; `?s=` via `Uri.EscapeDataString`; invariant-culture price binding; scope ⊆ ticket. Live: Usuario → AccessDenied on `/Productos` and `/Productos/Crear`; `?s=<script>` rendered encoded; prices `12.5a`, `-1`, `1.234` rejected server-side with a Spanish message and nothing created. Worker evidence accepted for cover persistence, edit/delete, `?s=%` / `?s=_` → 0 rows (backend escapes LIKE), category add/remove + duplicate message, bogus JWT on `Crear` → `/Auth/Salir`, es-MX culture binding. Not verified: client-side price validation in a real browser (attributes + Node rule check only).
- 2026-11-26 — `F006` @ `bef862c` (based on `68aacf3`, fast-forward) verified by router: Release `--no-incremental` build 0 warnings / 0 errors; no `async void`; no `Html.Raw`; `/Comprar` `[Authorize(Roles = "Usuario,Administrador")]`, `/Carrito` `[Authorize(Roles = "Usuario")]`; cart POST parameters `[Required, Range]` (quantity 1–99, max 50 lines, mirroring `CreatePedido`); session stores only `{ ProductoId, Cantidad }`; scope ⊆ ticket. Live: added 2 products ×2 → badge `4`, `/Carrito` shows current backend prices; **cart and session survive a backend restart**; a second cookie jar for the same account starts with an empty cart; cookies are only `.frontendnet` (1243), `.frontendnet.session` (184), `.frontendnet.af` (155). Worker evidence accepted for search, invalid quantities (`0`, `-1`, `1000`, `abc`), forged / deleted product ids dropped with a notice, POSTs without token → `400`, anonymous → `/Auth`, `/Auth/Salir` empties the cart, Administrador → AccessDenied on `/Carrito`.
- 2026-11-26 — `F007` @ `15f417d` (based on `0642dc4`, fast-forward) verified by router: Release `--no-incremental` build 0 warnings / 0 errors; no `async void`; no `Html.Raw`; `/Registro` `[AllowAnonymous]`, `PedidosController` `Usuario,Administrador` with `Index` admin-only and `Mios` / `Confirmar` Usuario-only; `AuthClientService` only gained `RegistrarAsync`; `Views/Carrito/Index.cshtml` change limited to enabling the checkout form; all 21 POST forms in `Views/**` use tag helpers (antiforgery token emitted); scope ⊆ ticket. Live (after the local DB rebuild, see `REQ-008`): registration with forged `Rol=Administrador` → redirected to `/Comprar`, `/Perfil` and `GET /api/usuarios` show `Usuario`; checkout with forged `precio`/`total` → order total `$37,998.00` = 2 × backend price `18999`, cart badge reset to `0`; order visible in `/Pedidos/Mios` and admin `/Pedidos`; `patito@uv.mx` → another user's `/Pedidos/Detalle/{id}` → `404`; Usuario → AccessDenied on `/Pedidos`; test user deleted (order cascaded). Worker evidence accepted for weak/mismatched/bad-email rejection, outgoing body containing only `{ productoId, cantidad }` (logging proxy), `400` → `/Carrito` message, POSTs without token → `400`. Worker fixed F006's checkout form (literal `action="~/..."` suppressed the antiforgery token).
- 2026-11-27 — `F009` @ `c3e1251` (worker `bcdff9d` rebased onto `5c78bd0`) verified by router: Release `--no-incremental` build 0 warnings / 0 errors; no `async void` / `Html.Raw`; scope ⊆ ticket. Live: `ArchivoId=abc` → "El valor 'abc' no es válido para Portada." (no English binding text); with a second frontend pointed at a closed port and the same cookie, `/Categorias`, `/Productos`, `/Comprar`, `/Bitacora` show Spanish "no está disponible" messages with no stack trace; the same session is still valid on the healthy frontend afterwards (recovery leg the worker could not run); `Imagen` → `public,max-age=300` anonymous, `private, max-age=300` authenticated. Worker evidence accepted for timeouts → Spanish `503` page in Production, bad JWT → `/Auth/Salir` on all admin pages, full regression smoke. Spec adjusted: on connection failures the F002–F006 controllers keep their own in-page Spanish message (`200`) by design; the global filter covers what they do not catch. Router deleted the worker's leftover test data (user `f009.temp@example.com` + order, product 17, category 16, archivo 1). `HttpClient` timeout is now 30 s (`UrlWebAPITimeoutSeconds`), below nginx's 60 s.
- 2026-11-27 — `F008` step A @ `87b609d` (worker `d0e93eb` rebased onto `5c78bd0`) verified by router: `bash -n` on all 4 scripts, `ruby -c Vagrantfile` OK; `frontendnet/deploy/.gitignore` covers `certs/`, `out/`, `.vagrant/`, `.env.deploy`, `*.tgz`, and no cert/key/env file is tracked; libvirt `default_prefix = "dima_"` + `VAGRANT_DOTFILE_PATH` outside the repo; secrets generated with `openssl rand` under `umask 077`, staged per VM with only the keys each role needs; nginx overwrites `X-Forwarded-For` with `$remote_addr`, `server_tokens off`, HSTS, login rate limit, 443 only; `frontendnet.service` sandboxed (`ProtectSystem=strict`, `NoNewPrivileges`); `appsettings.Production.json` has no secrets. Worker evidence accepted for `shellcheck`, `vagrant validate`, `nginx -t` (container), `make-certs.sh` idempotency. Backend issues filed as `REQ-010`. Workaround in `deploy-all.sh`: `DB_DATABASE=mercadolibrenode` + `backup-db.service` override.

## Notes for Later Tickets (from F001)

- Cart badge reads session key `CarritoCantidad` — `F006` must keep it updated.
- `RefrescaTokenDelegatingHandler` turns any non-2xx into `HttpRequestException` with `StatusCode`; branch on `ex.StatusCode` (e.g. `409` in `F007`, `400` in `F005`) — response bodies (`detalles`) are not readable through these clients.
- Image URLs: `Url.Action("Imagen", "Archivos", new { id })` + `?v={nombre}` cache-buster (F003); CSP allows `data:` images, not `blob:`.
- `PasswordPolicyAttribute` (F005) uses the built-in unobtrusive `regex` adapter — reuse it as-is in F007; no extra JS needed.
- Default MVC model-binding messages (e.g. "The value '…' is not valid") are still English; localize via `ModelBindingMessageProvider` in `Program.cs` (fold into `F008`).
- Cart (F006): `CarritoSessionService` (`new CarritoSessionService(HttpContext.Session)`), badge `CarritoCantidad` = total units; `Confirmar compra` form already posts to `/Pedidos/Confirmar` (disabled, "Próximamente") — F007 enables it and must clear the cart on `201`.
- Session uses the in-memory distributed cache: a **frontend** restart empties carts (auth cookie survives). Acceptable for the rubric ("keeps state after API restart"); revisit in F008 only if needed.
- `HttpClient` timeouts (`TaskCanceledException`) are only handled in `PedidosController.Confirmar`; other controllers surface them as `500` → `/Home/Error`. Consider a global exception filter in `F008` (`Program.cs`).
- Forms must use `asp-controller`/`asp-action` (tag helpers); a literal `action="~/..."` drops the antiforgery token.
- `Usuario` login redirects to `/` (Home); HSTS is suppressed on `localhost` by ASP.NET Core defaults.

## Completed

- 2026-11-26 — Bootstrapped `frontendnet/.routing/` (CONTEXT, PROGRESS, DECISION, BACK-HANDOFF, T3-SETUP), tickets `F001`–`F008`, deployment plan.
