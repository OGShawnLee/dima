# F009 — Changelog

Date: 2026-11-26/27 · Worker: frontend sub-agent (T3 Code) · Base: `main` @ `04701f4`

## Files touched

| File | Change |
| :--- | :--- |
| `frontendnet/Program.cs` | `AddControllersWithViews`: kept the global `AutoValidateAntiforgeryTokenAttribute`. Registered the global `ErrorServicioExceptionFilter`. Set all 11 `ModelBindingMessageProvider` accessors to Spanish. Added a backend `HttpClient.Timeout`: 30 s by default, overridable with `UrlWebAPITimeoutSeconds` (valid range 1–300). The reason: the old 100 s default outlived nginx's default 60 s `proxy_read_timeout`, so users got a bare 504 instead of the Spanish page. |
| `frontendnet/Filters/ErrorServicioExceptionFilter.cs` | New global `IAsyncExceptionFilter`. It only sees exceptions that controllers did not catch. Client abort (`OperationCanceledException` while `RequestAborted` is set) → `499`, logged at Debug only. `HttpRequestException` `401` → `/Auth/Salir`; `403` → `/Home/AccessDenied`. `TaskCanceledException` (timeout) and any other `HttpRequestException` (no status = connection failure, or other statuses) → `~/Views/Home/Error.cshtml` with `503`, `Cache-Control: no-store` and `Retry-After: 30`, logged as Warning with method and path (no query string). Any other exception type is left alone, so real bugs still reach `UseExceptionHandler`. |
| `frontendnet/Views/Home/Error.cshtml` | New. It takes precedence over `Views/Shared/Error.cshtml` for `HomeController.Error`, and the filter uses it explicitly. It shows a Spanish title and message plus the request id (the existing behaviour). It never shows exception details and has no scripts. |
| `frontendnet/Controllers/ArchivosController.cs` | `Imagen` headers only: authenticated requests get `Cache-Control: private, max-age=300`. Anonymous requests keep `public, max-age=300`. |
| `.tickets/F009-app-hardening/changelog.md` | This file. |

### Imagen decision (item 3)
**Chosen:** mark authenticated responses `private`.
**Rejected:** stripping the re-issued cookie. A re-issued `.frontendnet` cookie carries the renewed session (sliding renewal, or a `Set-Authorization` JWT refresh if the backend ever adds auth to `GET api/archivos/{id}`). Dropping it would leave the browser with a stale ticket or JWT and silently break the sliding session.
With `private`, a shared cache (nginx, corporate proxy) can never store or replay a response that carries `Set-Cookie`. Anonymous responses carry no session cookie and stay shared-cacheable.
Observed: when the cookie middleware itself renews the cookie, it overrides the header with `no-cache,no-store`, which is stricter still.

### Known limitation (spec check 3, see below)
Every list and detail action written in F002–F007 already catches `HttpRequestException`, connection failures (null status) included. These actions render their own in-page Spanish message with `200`, or redirect back to the list with a TempData error.
The ticket forbids changing that behaviour and forbids editing those controllers. So with the backend port **closed**, those pages still show the in-page Spanish message (`200`), not the `503` page.
The `503` page covers what the controllers do not catch: timeouts (on every page) and any future unhandled `HttpRequestException`.
Making connection-refused return `503` everywhere needs a follow-up ticket that edits the controllers.

## Gates

1. `dotnet build frontendnet/frontendnet.csproj -c Release --no-incremental` → `Build succeeded. 0 Warning(s) 0 Error(s)` (re-run on the final tree after rebase).
2. `grep -rn "async void" frontendnet --include='*.cs'` → no output (rc 1).
3. Antiforgery: `Program.cs:20` `o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());` is unchanged, and no `IgnoreAntiforgery` exists anywhere (grep rc 1). No new `[HttpPost]` was added.
4. `grep -rn "Html.Raw" frontendnet/Views` → no output (rc 1).
5. Manual smoke: see below. It ran on `https://localhost:8445` (`dotnet run --launch-profile https`) with curl cookie jars. Logins sent `X-Forwarded-For` 203.0.113.11 / .12 / .13.
6. Scope: `git status` → only the four files above plus this changelog. `frontendnet/keys/` is git-ignored.

## Spec checks

| Check | Result | Evidence |
| :--- | :--- | :--- |
| Build gate, no `async void`, no `Html.Raw` | PASS | See Gates 1, 2 and 4. |
| `Precio=abc` on `/Productos/Crear` and `cantidad=abc` on `/Carrito/Agregar` show Spanish only | PASS | `Precio=abc` → `200` form showing "El campo Precio debe ser un número positivo con hasta dos decimales…" (the F004 custom binder). The same POST with `ArchivoId=abc` (default binder, which proves the new provider is active) → "El valor 'abc' no es válido para Portada." The page has 0 English binding strings ("is not valid", "is invalid", "must be a number"). `cantidad=abc` → `302 /Comprar`, alert "La cantidad debe ser un número entero entre 1 y 99." |
| Backend unavailable → Spanish error page `503`, no stack trace, session valid after recovery | PARTIAL | **Timeout** (BFF → a local listener on :3998 that accepts and never answers, `UrlWebAPITimeoutSeconds=3`). Admin `/Categorias`, `/Productos`, `/Usuarios`, `/Comprar`, `/Archivos`, `/Bitacora`, `/Pedidos`, `/Perfil`, `/Productos/Detalle/1`, and Usuario `/Comprar`, `/Pedidos/Mios` → all `503` in about 3.0 s with "El servicio no está disponible, inténtelo más tarde.", `cache-control: no-store`, `retry-after: 30`, CSP present, request id shown, 0 `<script>` inline, 0 matches for `exception`, `stack`, `   at `. The same check under `ASPNETCORE_ENVIRONMENT=Production` gave `503` on all 4 spec pages with 0 exception text. The log shows `warn: frontendnet.Filters.ErrorServicioExceptionFilter … Backend call timed out on GET /Categorias.`. **Client abort** (`curl -m 1` during a timeout) → no new warn/fail log line (12 before, 12 after). **Closed port** (`UrlWebAPI=http://127.0.0.1:3999`): the four spec pages → `200` with the existing in-page Spanish messages ("El servicio no está disponible. Inténtelo más tarde." / "No fue posible obtener la lista de usuarios."). This is the controllers' F002–F007 behaviour, kept on purpose (see Known limitation), and the session cookie was still accepted (no `/Auth` redirect). **Recovery back on :3000: NOT VERIFIED.** The shared backend went down during this run and stayed down through a 15-minute poll. |
| Expired/invalid JWT → `/Auth/Salir` on every admin page | PASS | A `.frontendnet` cookie (role Administrador) holding a bogus JWT was minted with the BFF key ring, the same technique as F002, against the live backend. `/Categorias`, `/Categorias/Detalle/1`, `/Productos`, `/Productos/Detalle/1`, `/Productos/Crear`, `/Archivos`, `/Archivos/Detalle/1`, `/Usuarios`, `/Bitacora`, `/Pedidos`, `/Perfil`, `/Comprar` → all `302 /Auth/Salir`. Usuario: `/Comprar`, `/Pedidos/Mios` → `302 /Auth/Salir`. `/Carrito` with an empty cart → `200`, because it makes no API call (unchanged since F006). |
| `Imagen`: anonymous `public, max-age=300`; authenticated never shared-cacheable with `Set-Cookie` | PASS | Live backend, archivo 1. Anonymous → `200 image/jpeg`, `cache-control: public,max-age=300`, no `Set-Cookie`. Admin and Usuario jars → `cache-control: private, max-age=300`. A minted cookie aged 15 min (forces sliding renewal) → `set-cookie: .frontendnet=…` together with `cache-control: no-cache,no-store`, `pragma: no-cache`. Missing id → `404 no-store` (unchanged). |
| Regression smoke | PASS (before the backend went down) | Login: admin → `302 /Productos`, Usuario → `302 /`. Categorías: create "F009 prueba" → id 16, edit → "F009 prueba editada". Archivos: upload JPEG → `/Archivos/Detalle/1`. Productos: create (ArchivoId 1) → `/Productos/Detalle/17` showing the cover, edit, assign category 16. Bitácora: `200`, shows 203.0.113.11. Usuarios, Pedidos: `200`. Registro: temporary Usuario `f009.temp@example.com` → `302 /Comprar`. Cart: add product 17 ×2 and product 1 ×1, `/Carrito` shows backend prices. Checkout → `302 /Pedidos/Detalle/3`, total `$13,025.00` (= 2 × 13.00 + 12,999.00), badge reset to `0`. |
| Scope check | PASS | See Gate 6. |

## Cleanup still pending (backend down)
The backend stopped before cleanup and was still down after a 15-minute poll. These test records were created through the UI and have **not** been deleted:
- user `f009.temp@example.com`, which cascades its order #3
- product 17 "F009 producto editado" (it carries category 16)
- category 16 "F009 prueba editada"
- archivo 1 (test JPEG)

Delete them in this order once the backend is back: user, then product, then category, then archivo. Seeded data was not modified.
