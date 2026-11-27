# F007 — Changelog

Date: 2026-11-26 · Worker: Claude Opus 5.5 (T3 Code sub-agent) · Backend contract: live `/openapi.json`
(`Register`, `CreatePedido`, `GetMyPedidos`, `GetPedidos`, `GetPedidoById`), matching DEC-013..DEC-015.

## Files touched

| File | Change |
| :--- | :--- |
| `frontendnet/Models/Registro.cs` | New. Form model `{ Email, Nombre, Password, ConfirmarPassword }`. `[PasswordPolicy]` (F005, reused as-is) + `[Compare]`. No role/`protegido` property. |
| `frontendnet/Models/Pedido.cs` | New. `PedidoItemRequest`/`PedidoRequest` (checkout body, ids + quantities only) and `Pedido` (Created/Summary/AdminSummary DTO), plus Spanish status label helpers. |
| `frontendnet/Models/PedidoDetalle.cs` | New. `PedidoLinea` (`PedidoLineaDto`, nullable `productoId`) and `PedidoDetalle : Pedido` (`PedidoDetailDto`). |
| `frontendnet/Services/AuthClientService.cs` | Added `RegistrarAsync(email, nombre, password)` only. Sends exactly `{ email, nombre, password }`. Existing methods unchanged. |
| `frontendnet/Services/PedidosClientService.cs` | Filled the stub: `CrearAsync`, `GetMiosAsync`, `GetAsync()`, `GetAsync(id)`. |
| `frontendnet/Controllers/RegistroController.cs` | New, `[AllowAnonymous]`. `[Bind]` limited to the four form fields. 409 → generic "No fue posible crear la cuenta…"; 400 and 429 → friendly Spanish messages. On 201: `ObtenTokenAsync` + `IniciaSesionAsync`, then redirect to `/Comprar`. If auto sign-in fails, shows `Creada` with a link to `/Auth`. |
| `frontendnet/Controllers/PedidosController.cs` | New. `Index` (Administrador), `Mios` (Usuario), `Detalle/{id:int}` (both roles; backend 404 → NotFound, 403 → AccessDenied, 401 → `/Auth/Salir`), `POST Confirmar` (Usuario). Dates converted UTC → `America/Mexico_City`, the same way F005's Bitácora does it. |
| `frontendnet/Views/Registro/Index.cshtml`, `Creada.cshtml` | New. |
| `frontendnet/Views/Pedidos/Index.cshtml`, `Mios.cshtml`, `Detalle.cshtml`, `_MensajesPartial.cshtml` | New. Money uses `Producto.FormatoPrecio` (`$#,##0.00`, invariant culture). No inline scripts, no `Html.Raw`. |
| `frontendnet/Views/Carrito/Index.cshtml` | Enabled the `Confirmar compra` form (only change). The `Próximamente` badge and `disabled` were removed. The form now uses `asp-controller="Pedidos" asp-action="Confirmar"` instead of the literal `action="~/Pedidos/Confirmar"`, because a literal `action` stops the form tag helper from emitting the antiforgery token. The F006 form rendered **no token** (observed), so it would always have failed with 400. |
| `.tickets/F007-registro-pedidos/changelog.md` | This file. |

### Checkout behaviour (`POST /Pedidos/Confirmar`)
- Builds `{ items: [{ productoId, cantidad }] }` only from `CarritoSessionService.Obtener()`. The action binds no parameters, so posted fields (`precio`, `total`, `items[..]`) are ignored.
- Empty cart → no API call; redirects to `/Carrito` with "Su carrito está vacío."
- 201 → `CarritoSessionService.Vaciar()` (existing API; also sets the badge `CarritoCantidad = 0`), then PRG to `/Pedidos/Detalle/{pedidoId}`. That page shows the backend lines and total plus a success flash.
- 400 → `/Carrito` with a Spanish message; the cart is kept.
- 401 → `/Auth/Salir`; 403 → AccessDenied.
- Other failures, and `TaskCanceledException` (timeout) → `/Carrito`; the cart is kept. On timeout the message tells the user to check "Mis pedidos" before retrying.
- `CarritoSessionService` was **not** edited; its existing API was sufficient.

## Gates

1. `dotnet build frontendnet/frontendnet.csproj -c Release --no-incremental` → `Build succeeded. 0 Warning(s) 0 Error(s)`, exit 0 (re-run on the final tree).
2. `grep -rn "async void" frontendnet --include='*.cs'` → no results.
3. Antiforgery: the global `AutoValidateAntiforgeryTokenAttribute` is in `Program.cs:16`, and no `IgnoreAntiforgeryToken` exists anywhere. Both new `[HttpPost]` actions (`RegistroController.IndexAsync`, `PedidosController.Confirmar`) are covered. Observed: a tokenless POST to `/Registro` → `400`; a tokenless POST to `/Pedidos/Confirmar` → `400`.
4. `grep -rn "Html.Raw" frontendnet/Views` → no results.
5. Manual smoke: see below. Run with `dotnet run --launch-profile https --urls https://localhost:8444`, curl cookie jars, and fake `X-Forwarded-For` values 198.51.100.71–85.
6. Scope: `git status` shows only the files listed above (all inside "May create or edit" plus this changelog).

## Spec checks

| # | Check | Result | Evidence |
| :--- | :--- | :--- | :--- |
| 1 | Build gate passes | **PASS** | Gate 1 above. |
| 2 | Anonymous user registers with a strong password, is logged in as `Usuario`, lands on `/Comprar` | **PASS** | `POST /Registro` (f007-prueba-1, and after the DB reset f007-prueba-3, password `Fuerte#Clave2026`) → `302 /Comprar`. `GET /Comprar` → 200 with "Hola f007-prueba-3@example.com!" and the Usuario menu (`/Pedidos/Mios`, no `/Productos`). Duplicate email → 200 with the generic "No fue posible crear la cuenta. Verifique sus datos o inténtelo más tarde." (backend 409 seen in the BFF log). |
| 3 | Weak password, mismatched confirmation, bad email blocked client- and server-side | **PASS** | Client side: the rendered form has `data-val-regex-pattern` (the policy regex), `data-val-equalto-other="*.Password"` and `data-val-email` (jquery-validate unobtrusive). Server side (posted directly, bypassing JS): `Password=debil` → 200 with the policy message; mismatch → "La confirmación no coincide con la contraseña."; `Email=no-es-correo` → "no es un correo electrónico válido". The BFF made no backend call in these three cases. The backend also rejects weak passwords directly (`POST /api/auth/registro` → 400 with `detalles`). |
| 4 | Forged `"rol":"Administrador"` still creates a `Usuario` (verified in `/Usuarios` as admin) | **PASS** | (a) BFF: `POST /Registro` with extra `Rol=Administrador&rol=Administrador&protegido=true` → 302 `/Comprar`, session menu is Usuario. (b) Direct backend: `POST /api/auth/registro {…,"rol":"Administrador","protegido":true}` → `201 {"rol":"Usuario"}`. Admin `GET /Usuarios` (BFF) listed `f007-prueba-1 … Usuario` and `f007-prueba-2 … Usuario`; repeated after the DB reset with prueba-3 (BFF) and prueba-4 (direct): both `rol: Usuario`. |
| 5 | Usuario checks out → order appears in `/Pedidos/Mios` and admin `/Pedidos` with the backend-computed total | **PASS** | Cart: product 1 ×2 + product 2 ×1 (badge 3, estimated total $34,497.00). `POST /Pedidos/Confirmar` → `302 /Pedidos/Detalle/1`. Detail: lines $12,999.00×2 and $8,499.00×1, **Total $34,497.00**, date "26/11/2026 16:39:39 (Ciudad de México)" (backend `2026-11-26T22:39:39.000Z`). Badge 0, `/Carrito` shows "Su carrito está vacío". `/Pedidos/Mios` row `#1 … 3 $34,497.00 Pendiente`, linking to `/Pedidos/Detalle/1`. Admin `/Pedidos` row `#1 … Prueba Tres f007-prueba-3@example.com 3 $34,497.00 Pendiente`. Backend `GET /api/pedidos/1` → `"total":34497`. |
| 6 | Tampering a price has no effect on the order total | **PASS** | The BFF was run with `UrlWebAPI=http://localhost:3001`, a local logging pass-through proxy to `:3000` (the backend itself was not touched). `/Carrito/Agregar` and `/Pedidos/Confirmar` were posted with forged `precio=1`, `total=1`, `items[0].precio=1`, `items[0].productoId=1`, `items[0].cantidad=1`. Captured outgoing body: `{"items":[{"productoId":1,"cantidad":2},{"productoId":2,"cantidad":1}]}` (no price; the forged items were ignored). The backend total was 34497 = 2×12999 + 8499. |
| 7 | Usuario cannot open another user's `/Pedidos/Detalle/{id}` (backend 403/404 → AccessDenied/NotFound) | **PASS** | As patito@uv.mx: `GET /Pedidos/Detalle/1` (owned by prueba-3) → **404** (NotFound). Direct backend `GET /api/pedidos/1` with patito's JWT → 404. 403 mapping → AccessDenied is in code (`Redireccion`) but was not triggered by the backend in this flow. Also `/Pedidos/Detalle/abc` → 404 and `/Pedidos/Detalle/0` → 404. |
| 8 | Usuario → AccessDenied on admin `/Pedidos` | **PASS** | As patito and prueba-1: `GET /Pedidos` → `302 /Home/AccessDenied?ReturnUrl=%2FPedidos`. The backend agrees: patito JWT `GET /api/pedidos` → 403. (Admin `GET /Pedidos/Mios` → AccessDenied as well, by design.) |

### Extra observations
- Checkout 400 path: added a temporary product (id 16, mine), put it in the cart, deleted it, then posted Confirmar → `302 /Carrito` with "No fue posible confirmar el pedido: uno o más productos ya no están disponibles…". The cart was kept (the stale line was then purged by `/Carrito`'s existing check), and no order was created.
- Checkout with the backend returning 500 (before the schema existed) → `/Carrito` with "El servicio no está disponible… Su carrito se conserva."; the badge stayed at 3.
- Expired JWT during checkout → `302 /Auth/Salir` (observed when prueba-1's 20-min JWT lapsed: the catalog GETs are public, so nothing refreshed it).
- Anonymous `GET /Pedidos/Mios` → `302 /Auth?ReturnUrl=…`.

## Test data / cleanup
- Applying `SCHEMA.sql` mid-session reset the DB, which removed f007-prueba-1 and f007-prueba-2 (registered before the reset).
- f007-prueba-3 and f007-prueba-4 were deleted as admin through the BFF (`POST /Usuarios/Eliminar/{email}` → 302). Order #1 was removed with prueba-3 (`pedido.usuarioid ON DELETE CASCADE`). Temporary product 16 was deleted. Final state: users `gvera@uv.mx`, `patito@uv.mx`; `GET /api/pedidos` → `[]`. Seeded accounts and products were not modified. Bitácora entries from the tests remain, which is expected.
- The frontend on :8444 and the logging proxy on :3001 were both stopped.
