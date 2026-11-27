# F001 — Changelog

Implemented 2026-11-26 on branch `t3/frontend-mvc-scaffold-auth` (base `73c2bb3`). The shared backend was used as it was running at `http://localhost:3000` (`TRUST_PROXY=loopback`) and was not restarted or reconfigured.

## Files touched (all new)

- `frontendnet/frontendnet.csproj` (`net10.0`, nullable, implicit usings; `keys/**` excluded from content)
- `frontendnet/.gitignore` (`dotnet new gitignore` + `keys/`)
- `frontendnet/Program.cs`
- `frontendnet/appsettings.json`, `appsettings.Development.json`, `appsettings.Production.json` (no secrets)
- `frontendnet/Properties/launchSettings.json` (http `8080`, https `8443;8080`)
- `frontendnet/Middlewares/EnviaBearerDelegatingHandler.cs`, `RefrescaTokenDelegatingHandler.cs`, `ReenviaIpDelegatingHandler.cs`, `SecurityHeadersMiddleware.cs`
- `frontendnet/Models/AuthUser.cs`, `Models/Login.cs`
- `frontendnet/Services/AuthClientService.cs`, `PerfilClientService.cs` (full)
- `frontendnet/Services/{Categorias,Productos,Archivos,Usuarios,Roles,Bitacora,Pedidos}ClientService.cs` (stubs)
- `frontendnet/Controllers/HomeController.cs`, `AuthController.cs`, `PerfilController.cs`
- `frontendnet/Views/_ViewImports.cshtml`, `_ViewStart.cshtml`
- `frontendnet/Views/Shared/_Layout.cshtml`, `_MenuIzqPartial.cshtml`, `_MenuDerPartial.cshtml`, `_ValidationScriptsPartial.cshtml`, `Error.cshtml`, `AccessDenied.cshtml`
- `frontendnet/Views/Home/Index.cshtml`, `Views/Auth/Index.cshtml`, `Views/Perfil/Index.cshtml`
- `frontendnet/wwwroot/css/site.css`, `js/cambio_tema.js`, `favicon.svg`, `images/carrusel1..4.webp`, `images/logo.png`, `images/logo-dark.png`, `images/netlogo.jpg` (generic generated artwork, no third-party branding)
- `.tickets/F001-mvc-scaffold-auth/changelog.md`

## Notes for later tickets

- **Program.cs is final.** All typed clients are registered. `AuthClientService` uses only `ReenviaIp`. Every other client uses `Envia → Refresca → ReenviaIp`. Each stub exposes `protected HttpClient Client`. Replace the class body as needed, but keep the constructor shape `(HttpClient client)`. If you need more DI dependencies, add them to the primary constructor.
- **`RefrescaTokenDelegatingHandler` calls `EnsureSuccessStatusCode()` (spec §6.2).** Any non-2xx response surfaces as `HttpRequestException` with `StatusCode` set. Catch `Unauthorized` and redirect to `/Auth/Salir`. Error bodies (e.g. `409`, `400 detalles`) cannot be read through these clients.
- On refresh, the handler takes `givenname` and `role` from the new token's payload. It only decodes the payload and does not validate it; the backend re-reads them from MySQL. If they are missing, it falls back to the current claims.
- **Cart badge contract (F006):** `_MenuIzqPartial` reads `Context.Session.GetInt32("CarritoCantidad")`. F006 must keep that session key updated.
- Menu links are plain `~/Controller/...` hrefs, because tag helpers yield an empty `href` for controllers that do not exist yet. Linked routes:
  - Anonymous: `/`, `/Registro`.
  - Usuario: `/Comprar`, `/Carrito`, `/Pedidos/Mios`.
  - Administrador: `/Productos`, `/Categorias`, `/Archivos`, `/Usuarios`, `/Pedidos`, `/Bitacora`.
  - Every user: `/Perfil`, `/Auth/Salir`, `/Auth`.
- **Cookie `Secure` flag:** it is `Always` outside Development. In Development it is `SameAsRequest`, so cookies are `Secure` under the https profile and the http profile still works. The same policy applies to `.frontendnet`, `.frontendnet.af` (antiforgery) and `.frontendnet.session`.
- **Login errors:** the same generic Spanish message is shown for `401`, `429` and `400`. Network failures and `5xx` show "servicio no disponible".
- `Usuario` login redirects to `/`, which is `HomeController.Index`. `RedirectToAction("Index","Home")` produces that shortest URL.
- `/Auth/Salir` is `[AllowAnonymous]`, so an expired cookie still lands cleanly on `/Auth`. It also clears the session.
- `UseHsts` sends no header for `localhost` (ASP.NET Core excludes it by default). HSTS will appear on real hostnames.

## Gate results

1. `dotnet build frontendnet/frontendnet.csproj -c Release` → **exit 0, 0 Warning(s), 0 Error(s)**, so there are no nullable warnings anywhere.
2. `grep -rn "async void" frontendnet --include='*.cs'` → no output (rc=1).
3. Antiforgery: the global `AutoValidateAntiforgeryTokenAttribute` filter is in `Program.cs`. The only `[HttpPost]` is `AuthController.IndexAsync`. `POST /Auth` without a token → `400`.
4. `grep -rn "Html.Raw" frontendnet/Views` → no output.
5. Manual smoke: see the table below.
6. Scope: `git status --porcelain --untracked-files=all` lists only files under `frontendnet/` in the allowed set, plus this changelog. `bin/`, `obj/` and `keys/` are ignored (verified with `git check-ignore`).

## Spec checks

Setup:
- The app ran with `dotnet run --launch-profile https` (`https://localhost:8443` and `http://localhost:8080`, Development).
- A Production instance ran from the Release build at `https://localhost:8453`. Its config overrides were env vars `UrlWebAPI=http://localhost:3000` and `DataProtection__KeysPath=<scratch dir>`.
- Tests used `curl` with cookie jars. Each login sent a distinct fake client IP via `X-Forwarded-For` to the BFF. The BFF trusts loopback, which also keeps the shared backend's per-IP login limiter clear.
- Client-side validation was tested in a real headless Firefox driven over WebDriver BiDi.

| Check | Result | Evidence |
| :--- | :--- | :--- |
| Release build exit 0 / 0 errors | PASS | 0 warnings, 0 errors |
| `TargetFramework` is `net10.0` | PASS | `frontendnet.csproj` |
| No `async void` | PASS | grep empty |
| `/` and `/Auth` load anonymously; `/Perfil` → `/Auth` | PASS | `/` 200; `/Auth` 200; `/Perfil` 302 → `/Auth?ReturnUrl=%2FPerfil` |
| Admin → `/Productos`; Usuario → `/Home` | PASS | admin `302 location: /Productos` (then 404, which is expected until F004); patito `302 location: /` (HomeController.Index) |
| Wrong password: generic message + client validation | PASS | Server: wrong password and unknown email both return 200 with the same message, "No fue posible iniciar sesión. Verifique sus credenciales o inténtelo más tarde.". Firefox: jQuery, validate and unobtrusive load with SRI under the CSP. An empty email shows "El campo Correo electrónico es obligatorio." and an invalid format shows "…no es un correo electrónico válido.". In both cases a `window` marker survived the click, so no navigation or POST happened. A valid-format wrong password did submit (marker gone) and showed the generic summary. |
| `/Perfil` shows name, email, role, remaining time | PASS | "Usuario patito", "patito@uv.mx", "Usuario", `00:19:59` from `GET /api/auth/tiempo` |
| JWT in last 5 min → `Set-Authorization` + cookie re-issued | PASS | Real 20-min token, no tampering. Logged in at 20:22:25. At 20:37:55 (t0+15.5m) `/Perfil` returned `Set-Cookie: .frontendnet=…` and showed `00:04:29`, the old token sent on that call. The app log has "JWT refreshed through Set-Authorization; cookie re-issued.". The next `/Perfil` showed `00:19:59`, so the cookie now held the refreshed token. At t0+21.3m the same session was still valid (`00:14:19`). |
| Backend restart → next page still works | **NOT VERIFIED** | I could not restart the shared backend (forbidden by the brief). Related evidence: the backend is stateless (JWT signed with `.env` `JWT_SECRET`). The BFF was restarted during the test window, and the existing admin cookie still loaded `/Perfil` (200, `00:17:37`) because the Data Protection key ring in `frontendnet/keys/` persists. The timed sessions above also survived that BFF restart. |
| Expired/invalid JWT → `/Auth/Salir` → `/Auth` | PASS | Real expiry, no tampering. Session E logged in at 20:22:25. At t0+11m it requested `GET /` with no API call, so only the cookie slid (`Set-Cookie` re-issued) and the JWT kept its 20-min life. At t0+21.3m (cookie valid, JWT expired) `/Perfil` returned `302 location: /Auth/Salir`. `/Auth/Salir` then returned `302 location: /Auth` and cleared the cookie. |
| `/Auth/Salir` clears `.frontendnet` | PASS | `set-cookie: .frontendnet=; expires=Thu, 01 Jan 1970 …`; `/Perfil` afterwards → 302 `/Auth` |
| Cookie flags `HttpOnly`, `SameSite=Strict`, `Secure` (https) | PASS | `path=/; secure; samesite=strict; httponly` on `.frontendnet` (dev https and Production) and on `.frontendnet.af` |
| Antiforgery token in form; POST without token → 400 | PASS | One `__RequestVerificationToken` hidden input; tokenless POST → `400` |
| CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` | PASS | All present on `/` (also `Permissions-Policy`). The CSP allows only `self`, `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `placehold.co` (img) and `data:` (img, Bootstrap SVG icons), plus `frame-ancestors 'none'`. |
| Raw JWT not rendered in Production | PASS | Production `/Perfil` 200 with time `00:19:58`. Zero occurrences of `eyJ` or "Solo desarrollo" in the HTML. The controller also blanks `Model.Jwt` outside Development. |
| No secrets in `appsettings*.json` | PASS | Only logging, `AllowedHosts`, `UrlWebAPI`, `DataProtection:KeysPath` |
| `X-Forwarded-For` sent to backend on login | PASS | Backend `GET /api/bitacora` (admin Bearer) has `usuario.login` gvera@uv.mx ip `203.0.113.11`, `usuario.login` patito@uv.mx ip `203.0.113.12`, and `usuario.login.fallido` ×2 ip `203.0.113.13`. These are the client IPs given to the BFF, forwarded by `ReenviaIpDelegatingHandler`. |

Additional checks:
- `http://localhost:8080/` → `307` to `https://localhost:8443/`.
- The dark-mode switch toggles `data-bs-theme` and persists it in `localStorage` (verified in Firefox).
- CDN SRI hashes were computed from the exact files served by jsDelivr and cdnjs.
- All dotnet and Firefox processes were stopped after testing.
