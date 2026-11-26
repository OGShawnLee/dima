# F001 — MVC Scaffold, BFF Auth Bridge & Layout

| ID | Status | Model | Lane | Spec |
| :--- | :--- | :--- | :--- | :--- |
| `F001` | `draft` | Strong coding model (T3 "Frontend" lane) | Front | [spec.md](spec.md) |

## Items addressed
- FRONTEND-API-SPEC §2–§4, §6, §7 (Auth/Perfil), §9; PDF fixes #1, #3, #5, #7, #11.
- [FDEC-001](../../frontendnet/.routing/DECISION.md#fdec-001) (`net10.0`), [FDEC-006](../../frontendnet/.routing/DECISION.md#fdec-006) (`X-Forwarded-For` handler).

## Scope

### May create or edit
- `frontendnet/frontendnet.csproj`, `frontendnet/Program.cs`, `frontendnet/appsettings.json`, `frontendnet/appsettings.Development.json`, `frontendnet/appsettings.Production.json`, `frontendnet/Properties/launchSettings.json`, `frontendnet/.gitignore`
- `frontendnet/Middlewares/**`
- `frontendnet/Models/AuthUser.cs`, `Models/Login.cs`
- `frontendnet/Services/**` (full `AuthClientService` + `PerfilClientService`; empty stubs for the rest)
- `frontendnet/Controllers/HomeController.cs`, `AuthController.cs`, `PerfilController.cs`
- `frontendnet/Views/_ViewImports.cshtml`, `Views/_ViewStart.cshtml`, `Views/Shared/**`, `Views/Home/**`, `Views/Auth/**`, `Views/Perfil/**`
- `frontendnet/wwwroot/**`
- `.tickets/F001-mvc-scaffold-auth/changelog.md`

### Must not touch
- `backendnode/**`, root `.routing/**`, `.tickets/B*/**`, any `audit.md`, `frontendnet/.routing/**`

## Steps
1. `dotnet new web -n frontendnet -o frontendnet --framework net10.0`; `dotnet new gitignore` inside `frontendnet/`.
2. Create the folder tree from FRONTEND-API-SPEC §3 (only files in scope for now).
3. `Program.cs`:
   - `AddControllersWithViews(o => o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()))`.
   - `AddHttpContextAccessor`; register `EnviaBearerDelegatingHandler`, `RefrescaTokenDelegatingHandler`, `ReenviaIpDelegatingHandler` (adds `X-Forwarded-For` from `HttpContext.Connection.RemoteIpAddress`).
   - Typed clients read `UrlWebAPI` from config; `AuthClientService` gets **only** `ReenviaIpDelegatingHandler`; every other client chains Envia → Refresca → ReenviaIp.
   - **Parallel-safety rule:** register *all* typed clients now (`Categorias`, `Productos`, `Archivos`, `Usuarios`, `Roles`, `Bitacora`, `Perfil`, `Pedidos`) and create empty stub classes (`public class XClientService(HttpClient client) { }`) for the ones outside this ticket. Later tickets only fill in their own service file and never edit `Program.cs`.
   - Cookie auth per spec §4.2 plus `Cookie.SecurePolicy = Always` (outside Development), `Cookie.SameSite = Strict`, `LoginPath = "/Auth"`, `AccessDeniedPath = "/Home/AccessDenied"`.
   - `AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(config["DataProtection:KeysPath"] ?? "keys")).SetApplicationName("frontendnet")`.
   - `AddSession` (`HttpOnly`, `Secure`, `SameSite=Strict`, idle 20 min) — consumed in F006.
   - Pipeline: `UseForwardedHeaders` (XForwardedFor | XForwardedProto) → `UseExceptionHandler("/Home/Error")` + `UseHsts` (non-Development) → `UseHttpsRedirection` → security headers middleware (CSP allowing `self`, `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `placehold.co`; `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`) → `UseStaticFiles` → `UseRouting` → `UseSession` → `UseAuthentication` → `UseAuthorization` → `MapControllerRoute` → `MapGet("/health")`.
4. `AuthClientService.IniciaSesionAsync` returns `Task` and is awaited everywhere; `ObtenTokenAsync` calls `EnsureSuccessStatusCode()`.
5. `AuthController`: `GET/POST /Auth` (redirect Administrador → `/Productos`, Usuario → `/Home`), `GET /Auth/Salir`. Show a generic error on `401`/`429` (never reveal whether the email exists).
6. `PerfilController`: shows claims and remaining time; the raw JWT is rendered **only** when `IWebHostEnvironment.IsDevelopment()`.
7. Menus link **all** final routes now so later tickets never edit `Views/Shared/**`: anonymous → `Inicio`, `Crear cuenta` (`/Registro`); Usuario → `Comprar`, `Carrito` (badge reads `Context.Session` count), `Mis pedidos` (`/Pedidos/Mios`); Administrador → `Productos`, `Categorías`, `Archivos`, `Usuarios`, `Pedidos` (`/Pedidos`), `Bitácora`.
8. Layout, theme switch, Home carousel, Error, AccessDenied per spec §9; CDN tags carry `integrity` + `crossorigin`; `via.placeholder.com` → `placehold.co`.
9. `launchSettings.json`: `http` → `http://localhost:8080`, `https` → `https://localhost:8443`.

## Done when
All checks in [spec.md](spec.md) pass and `changelog.md` lists files + manual test evidence.
