# Software Specification Document (SSD): Frontend Web App (ASP.NET Core 8.0 MVC)

**Project Name:** `frontendnet`  
**Architecture Pattern:** Server-Side MVC (Model-View-Controller) acting as a Backend-for-Frontend (BFF)  
**Target Domain:** E-Commerce / Product Catalog Management (Admin Backoffice & Customer Storefront)  
**Primary Stack:** .NET 8.0 SDK / C# 12 / ASP.NET Core MVC / Razor View Engine / Bootstrap 5.3.3  
**Upstream Dependency:** `backendnode` REST API (`http://localhost:3000`, OpenAPI 3.0.3)

---

## 1. System Overview

`frontendnet` is a server-rendered ASP.NET Core 8.0 MVC web application that provides the user interface for the `backendnode` API. It implements a **Cookie-to-JWT BFF Authentication Bridge**: browsers authenticate with the .NET server using an encrypted HTTP-only session cookie (`.frontendnet`), while the .NET server communicates with the Node.js API using stateless **JWT Bearer** tokens stored inside the user's encrypted cookie claims.

### Core Capabilities

* **Hybrid Cookie-to-JWT Auth:** Browser sessions are managed via ASP.NET Core Cookie Authentication (20-minute sliding expiration); outbound API requests automatically attach `Authorization: Bearer <jwt>` and intercept `Set-Authorization` headers to silently refresh the cookie's stored JWT.
* **Role-Based UI & Routing (RBAC):**
  * **Public (Anonymous):** Home landing page with carousel, Login page, Error & Access Denied pages.
  * **`Administrador` Role:** Full CRUD for Products (including Category assignment & cover image selection), Categories, Files (`JPG` upload/edit/delete), Users, and read-only Audit Log (`Bitácora`).
  * **`Usuario` Role:** Storefront catalog browsing/search (`Comprar`) and Shopping Cart (`Carrito` — extensible stub).
  * **Authenticated (Both Roles):** User Profile page (`/Perfil`) showing claims, active JWT, and remaining backend session time (`/api/auth/tiempo`).
* **Dual-Layer Validation:** Server-side and client-side form validation powered by `System.ComponentModel.DataAnnotations` + `jquery-validate` + `jquery-validation-unobtrusive`.
* **Light/Dark Theme Support:** Bootstrap 5.3 `data-bs-theme` toggling persisted client-side (`wwwroot/js/cambio_tema.js`) with custom Mercado Libre yellow branding (`#ffe600`).

---

## 2. Technology Stack & Dependencies

### Server Runtime & SDK
* **.NET SDK:** `8.0.x` (`net8.0`, nullable reference types enabled, implicit usings enabled)
* **Template Base:** `dotnet new web` configured manually for MVC (`AddControllersWithViews`, `MapControllerRoute`)
* **Default Local URL:** `http://localhost:8080` (configured in `Properties/launchSettings.json`)

### Client-Side Libraries (CDN)
| Library | Version | Purpose |
| :--- | :--- | :--- |
| Bootstrap CSS & Bundle JS | `5.3.3` | Responsive layout, components, dark/light theme |
| Bootstrap Icons | `1.11.3` | UI icons (cart, search, moon/stars, menu) |
| jQuery | `3.7.1` | DOM helper & validation runtime |
| jQuery Validate | `1.20.0` | Client-side form validation |
| jQuery Validation Unobtrusive | `4.0.0` | Bridges C# `DataAnnotations` to jQuery Validate |

### Optional SDK Generation (Recommended Upgrade)
* **Microsoft Kiota** or **Refitter** consuming `http://localhost:3000/openapi.json` to keep DTOs and HTTP calls strictly synced with `backendnode` (see `ARCHITECTURE_AND_STACK_REVIEW.md`).

---

## 3. Project Directory Structure

> **Important Agent Note:** The source PDF contained typos omitting leading underscores (`_`) on Razor partials and duplicating `.cshtml` extensions. Agents **must** use the exact canonical paths below so `<partial name="..." />` resolves correctly.

```text
frontendnet/
├── Controllers/
│   ├── ArchivosController.cs
│   ├── AuthController.cs
│   ├── BitacoraController.cs
│   ├── CarritoController.cs
│   ├── CategoriasController.cs
│   ├── ComprarController.cs
│   ├── HomeController.cs
│   ├── PerfilController.cs
│   ├── ProductosController.cs
│   └── UsuariosController.cs
├── Middlewares/
│   ├── EnviaBearerDelegatingHandler.cs
│   └── RefrescaTokenDelegatingHandler.cs
├── Models/
│   ├── Archivo.cs
│   ├── AuthUser.cs
│   ├── Bitacora.cs
│   ├── Categoria.cs
│   ├── Login.cs
│   ├── Producto.cs
│   ├── ProductoCategoria.cs
│   ├── Rol.cs
│   ├── Upload.cs
│   ├── Usuario.cs
│   └── UsuarioPwd.cs
├── Properties/
│   └── launchSettings.json          # Sets http profile to http://localhost:8080
├── Services/
│   ├── ArchivosClientService.cs
│   ├── AuthClientService.cs
│   ├── BitacoraClientService.cs
│   ├── CategoriasClientService.cs
│   ├── PerfilClientService.cs
│   ├── ProductosClientService.cs
│   ├── RolesClientService.cs
│   └── UsuariosClientService.cs
├── Views/
│   ├── _ViewImports.cshtml
│   ├── _ViewStart.cshtml
│   ├── Archivos/
│   │   ├── _DetallePartial.cshtml
│   │   ├── Crear.cshtml
│   │   ├── Detalle.cshtml
│   │   ├── Editar.cshtml
│   │   ├── Eliminar.cshtml
│   │   └── Index.cshtml
│   ├── Auth/
│   │   └── Index.cshtml
│   ├── Bitacora/
│   │   └── Index.cshtml
│   ├── Carrito/
│   │   ├── _CardPartial.cshtml
│   │   └── Index.cshtml
│   ├── Categorias/
│   │   ├── _DetallePartial.cshtml
│   │   ├── Crear.cshtml
│   │   ├── Detalle.cshtml
│   │   ├── Editar.cshtml
│   │   ├── Eliminar.cshtml
│   │   └── Index.cshtml
│   ├── Comprar/
│   │   ├── _CardPartial.cshtml
│   │   └── Index.cshtml
│   ├── Home/
│   │   └── Index.cshtml
│   ├── Perfil/
│   │   └── Index.cshtml
│   ├── Productos/
│   │   ├── _CardPartial.cshtml
│   │   ├── _CategoriasListadoPartial.cshtml
│   │   ├── Categorias.cshtml
│   │   ├── CategoriasAgregar.cshtml
│   │   ├── CategoriasRemover.cshtml
│   │   ├── Crear.cshtml
│   │   ├── Detalle.cshtml
│   │   ├── Editar.cshtml
│   │   ├── Eliminar.cshtml
│   │   └── Index.cshtml
│   ├── Shared/
│   │   ├── _Layout.cshtml
│   │   ├── _MenuDerPartial.cshtml
│   │   ├── _MenuIzqPartial.cshtml
│   │   ├── _ValidationScriptsPartial.cshtml
│   │   ├── AccessDenied.cshtml
│   │   └── Error.cshtml
│   └── Usuarios/
│       ├── _DetallePartial.cshtml
│       ├── Crear.cshtml
│       ├── Detalle.cshtml
│       ├── Editar.cshtml
│       ├── Eliminar.cshtml
│       └── Index.cshtml
├── wwwroot/
│   ├── css/site.css
│   ├── images/
│   │   ├── carrusel1.webp .. carrusel4.webp
│   │   ├── logo.png
│   │   ├── logo-dark.png
│   │   └── netlogo.jpg
│   ├── js/
│   │   ├── cambio_tema.js
│   │   ├── portada.js
│   │   └── producto_portada.js
│   └── favicon.svg
├── appsettings.json
├── frontendnet.csproj
├── Program.cs
└── .gitignore
```

---

## 4. Configuration & Startup Pipeline

### 4.1 `appsettings.json`
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "UrlWebAPI": "http://localhost:3000",
  "PublicUrlWebAPI": "http://localhost:3000"
}
```
> **Best Practice:** Use `UrlWebAPI` for server-to-server `HttpClient` calls and `PublicUrlWebAPI` (falling back to `UrlWebAPI`) for browser `<img src="...">` URLs so the app works identically in local dev and Docker/reverse-proxy deployments.

### 4.2 `Program.cs` Registration & Middleware Order
1. **MVC Services:** `builder.Services.AddControllersWithViews();`
2. **HTTP Context & Delegating Handlers:**
   * `builder.Services.AddHttpContextAccessor();`
   * `builder.Services.AddTransient<EnviaBearerDelegatingHandler>();`
   * `builder.Services.AddTransient<RefrescaTokenDelegatingHandler>();`
3. **Typed HTTP Clients:**
   * `AuthClientService`: BaseAddress = `UrlWebAPI` (**NO** auth delegating handlers — login is unauthenticated).
   * `CategoriasClientService`, `UsuariosClientService`, `RolesClientService`, `ProductosClientService`, `PerfilClientService`, `ArchivosClientService`, `BitacoraClientService`: BaseAddress = `UrlWebAPI`, each chained with:
     ```csharp
     .AddHttpMessageHandler<EnviaBearerDelegatingHandler>()
     .AddHttpMessageHandler<RefrescaTokenDelegatingHandler>();
     ```
4. **Cookie Authentication:**
   * Scheme: `CookieAuthenticationDefaults.AuthenticationScheme`
   * `Cookie.Name = ".frontendnet"`
   * `Cookie.HttpOnly = true`
   * `AccessDeniedPath = "/Home/AccessDenied"`
   * `LoginPath = "/Auth"`
   * `SlidingExpiration = true`
   * `ExpireTimeSpan = TimeSpan.FromMinutes(20)`
5. **Request Pipeline (strict order):**
   1. `app.UseExceptionHandler("/Home/Error");`
   2. `app.UseStaticFiles();`
   3. `app.UseRouting();`
   4. `app.UseAuthentication();`
   5. `app.UseAuthorization();`
   6. `app.MapControllerRoute(name: "default", pattern: "{controller=Home}/{action=Index}/{id?}");`

---

## 5. Models & Validation Rules (`Models/`)

All models live under `namespace frontendnet.Models;`. Validation messages are localized in Spanish for the UI.

| Model | Properties & DataAnnotations / JSON Notes |
| :--- | :--- |
| **`AuthUser`** | `required string Email`, `required string Nombre`, `required string Rol`, `required string Jwt` |
| **`Login`** | `required string Email` (`[Required]`, `[EmailAddress]`, Display: `"Correo electrónico"`), `required string Password` (`[Required]`, `[DataType(DataType.Password)]`, Display: `"Contraseña"`) |
| **`Categoria`** | `int? CategoriaId` (Display: `"Id"`), `required string Nombre` (`[Required]`), `bool Protegida = false` (Display: `"Eliminable"`) |
| **`Producto`** | `int? ProductoId` (Display: `"Id"`), `required string Titulo` (`[Required]`), `string Descripcion = "Sin descripción"` (`[Required]`, `MultilineText`), `decimal Precio` (`[Required]`, `Currency`, Regex `^\d+(\.\d{1,2})?$`, Format `{0:C}`), `int? ArchivoId` (`[JsonPropertyName("archivoid")]` **CRITICAL** — see Section 10), `bool Protegida = false`, `ICollection<Categoria>? Categorias` |
| **`ProductoCategoria`** | `int? CategoriaId` (`[Required]`, Display: `"Categoría"`), `string? Nombre`, `Producto? Producto` |
| **`Rol`** | `required string Id`, `required string Nombre` (`[Required]`, Display: `"Rol"`) |
| **`Usuario`** | `string? Id` (Display: `"Id"`), `required string Email` (`[Required]`, `[EmailAddress]`), `required string Nombre` (`[Required]`), `required string Rol` (`[Required]`) |
| **`UsuarioPwd`** | `required string Email` (`[Required]`, `[EmailAddress]`), `required string Password` (`[Required]`, `[MinLength(6)]`, `Password`), `required string Nombre` (`[Required]`), `required string Rol` (`[Required]`) |
| **`Upload`** | `int? ArchivoId` (Display: `"Id"`), `string? Nombre`, `required IFormFile Portada` (`[Required]`, `Upload`, Display: `"Portada"`) |
| **`Archivo`** | `int? ArchivoId` (Display: `"Id"`), `string? Mime` (`"MIME"`), `string? Nombre`, `int? Size` (Display: `"Tamaño"` — fixed from PDF typo `"Tamprecio"`), `bool InDb = true` (Display: `"Repositorio"`) |
| **`Bitacora`** | `int? BitacoraId` (Display: `"Id"`), `string? Accion` (`"Acción"`), `string? ElementoId` (`"Elemento Id"`), `string? IP`, `string? Usuario`, `DateTime? Fecha` |

---

## 6. Outbound HTTP Middlewares (`Middlewares/`)

### 6.1 `EnviaBearerDelegatingHandler`
* Reads `"jwt"` claim from `httpContextAccessor.HttpContext?.User.FindFirstValue("jwt")`.
* If non-empty, sets `request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);`.
* Calls `base.SendAsync(request, cancellationToken)`.

### 6.2 `RefrescaTokenDelegatingHandler`
* Awaits `var response = await base.SendAsync(request, cancellationToken);`.
* Calls `response.EnsureSuccessStatusCode();` (surfaces `401 Unauthorized` as `HttpRequestException` so controllers redirect to `/Auth/Salir`).
* Checks `if (response.Headers.TryGetValues("Set-Authorization", out var values))`:
  * Extracts the new JWT.
  * Rebuilds the 4 claims (`ClaimTypes.Name`, `ClaimTypes.GivenName`, `"jwt"`, `ClaimTypes.Role`) from the current `HttpContext.User`.
  * **MUST `await auth.IniciaSesionAsync(claims);`** (re-signs the encrypted `.frontendnet` cookie before returning the response).

---

## 7. API Client Services (`Services/`)

| Service | Method | Upstream Backend Call |
| :--- | :--- | :--- |
| **`AuthClientService`** | `ObtenTokenAsync(email, password)` | `POST api/auth` (`response.EnsureSuccessStatusCode()`, returns `AuthUser`) |
| | `IniciaSesionAsync(List<Claim>)` | **Returns `Task` (NOT `void`)** — invokes `HttpContext.SignInAsync(...)` |
| **`CategoriasClientService`** | `GetAsync()` / `GetAsync(id)` | `GET api/categorias`, `GET api/categorias/{id}` |
| | `PostAsync(cat)` / `PutAsync(cat)` / `DeleteAsync(id)` | `POST`, `PUT api/categorias/{id}`, `DELETE api/categorias/{id}` |
| **`ProductosClientService`** | `GetAsync(string? search)` | `GET api/productos` or `GET api/productos?s={Uri.EscapeDataString(search)}` |
| | `GetAsync(id)` / `PostAsync(prod)` / `PutAsync(prod)` / `DeleteAsync(id)` | `GET`, `POST`, `PUT`, `DELETE api/productos/{id}` |
| | `PostAsync(id, categoriaid)` / `DeleteAsync(id, categoriaid)` | `POST api/productos/{id}/categoria` (`{ categoriaid }`), `DELETE api/productos/{id}/categoria/{categoriaid}` |
| **`ArchivosClientService`** | `GetAsync()` / `GetAsync(id)` | `GET api/archivos`, `GET api/archivos/{id}/detalle` |
| | `PostAsync(Upload)` / `PutAsync(Upload)` | `POST api/archivos`, `PUT api/archivos/{id}` (`multipart/form-data`, field name `"file"`) |
| | `DeleteAsync(id)` | `DELETE api/archivos/{id}` |
| **`UsuariosClientService`** | `GetAsync()` / `GetAsync(email)` | `GET api/usuarios`, `GET api/usuarios/{email}` |
| | `PostAsync(UsuarioPwd)` / `PutAsync(Usuario)` / `DeleteAsync(email)` | `POST`, `PUT api/usuarios/{email}`, `DELETE api/usuarios/{email}` |
| **`RolesClientService`** | `GetAsync()` | `GET api/roles` |
| **`PerfilClientService`** | `ObtenTiempoAsync()` | `GET api/auth/tiempo` (returns `string` `"00:MM:SS"`) |
| **`BitacoraClientService`** | `GetAsync()` | `GET api/bitacora` |

---

## 8. Routes, Controllers & Authorization Matrix

Every protected controller action calling an API service must catch `HttpRequestException` and redirect to `Auth/Salir` when `ex.StatusCode == HttpStatusCode.Unauthorized` (session expired on backend). All `[HttpPost]` actions should enforce `[ValidateAntiForgeryToken]`.

| Controller | Route Pattern | Roles | Key Behaviors & Business Rules |
| :--- | :--- | :--- | :--- |
| **`HomeController`** | `/`, `/Home/Index`, `/Home/Error`, `/Home/AccessDenied` | Public | Carousel landing page; CTA adapts to role (`Comenzar a comprar`, `Administrar catálogo`, or `Iniciar sesión`). |
| **`AuthController`** | `GET /Auth`, `POST /Auth` | Public | Authenticates via `POST api/auth`, stores claims + JWT in cookie. Redirects `Administrador` → `/Productos`, `Usuario` → `/Home`. |
| | `GET /Auth/Salir` | `Administrador, Usuario` | Calls `HttpContext.SignOutAsync()`, redirects to `/Auth`. |
| **`PerfilController`** | `GET /Perfil` | `[Authorize]` (Any) | Calls `GET api/auth/tiempo` and displays user claims, raw JWT, and remaining session time. |
| **`ProductosController`** | `/Productos` (`?s=`), `/Detalle/{id}`, `/Crear`, `/Editar/{id}`, `/Eliminar/{id}`, `/Categorias/{id}`, `/CategoriasAgregar/{id}`, `/CategoriasRemover/{id}?categoriaid=...` | `Administrador` | Searchable table, cover image dropdown (from `ArchivosClientService`), cover live preview (`producto_portada.js`), and M:N category add/remove workflow. |
| **`CategoriasController`** | `/Categorias`, `/Detalle/{id}`, `/Crear`, `/Editar/{id}`, `/Eliminar/{id}` | `Administrador` | Prevents deletion UI when `Model.Protegida == true` (displays warning banner instead of delete form). |
| **`ArchivosController`** | `/Archivos`, `/Detalle/{id}`, `/Crear`, `/Editar/{id}`, `/Eliminar/{id}` | `Administrador` | Validates file `Length <= 100 KB` (`<= 102400` bytes) and `ContentType == "image/jpeg"` before uploading. Displays live preview (`portada.js`) and renders stored images via `<img>` pointing to `{PublicUrlWebAPI}/api/archivos/{id}`. |
| **`UsuariosController`** | `/Usuarios`, `/Detalle/{id}`, `/Crear`, `/Editar/{id}`, `/Eliminar/{id}` | `Administrador` | Uses `email` as the route identifier. Sets `ViewBag.PuedeEditar = !(User.Identity?.Name == email)` to prevent an admin from editing or deleting their own active account. |
| **`BitacoraController`** | `/Bitacora` | `Administrador` | Read-only audit table converting UTC timestamps to `"America/Mexico_City"` timezone. |
| **`ComprarController`** | `/Comprar` (`?s=`) | `Usuario` | Responsive 4-column Bootstrap card grid displaying products, prices, category badges, and search bar. (*"Comprar" button is a placeholder stub for future cart implementation.*) |
| **`CarritoController`** | `/Carrito` | `Usuario` | Renders empty cart state (`Mostrando 0 elementos`). (*Placeholder stub for future cart implementation.*) |

---

## 9. UI & Client-Side JavaScript Specifications

* **Layout (`Views/Shared/_Layout.cshtml`):**
  * Top navbar styled with `.bg-mercadolibre` (`#ffe600` in light mode, `--bs-body-bg` in dark mode).
  * Left menu (`_MenuIzqPartial.cshtml`): Shows `Inicio` (anonymous), `Comprar` + `Carrito` (`Usuario`), or `Productos`, `Categorías`, `Archivos`, `Usuarios`, `Bitácora` (`Administrador`).
  * Right menu (`_MenuDerPartial.cshtml`): Dark mode toggle switch (`#darkModeSwitch`), `Hola {email}!` link to `/Perfil`, `Salir` / `Iniciar sesión`, and `.NET` badge (`~/images/netlogo.jpg`).
* **Client Scripts (`wwwroot/js/`):**
  * `cambio_tema.js`: Toggles `document.documentElement.setAttribute('data-bs-theme', 'dark' | 'light')` and persists preference in `localStorage`.
  * `portada.js`: Updates `<img class="portada">` preview via `FileReader` / `URL.createObjectURL` when selecting a `.jpg` file in `Archivos/Crear` and `Archivos/Editar`.
  * `producto_portada.js`: Listens to `<select id="ArchivoId">` change events in `Productos/Crear` and `Productos/Editar` and updates `<img class="portada">` `src` to `${img.dataset.url}/api/archivos/${selectedId}` (or placeholder when empty).
* **Placeholder Images:** Replace all deprecated `https://via.placeholder.com/...` URLs from the PDF with `https://placehold.co/...` (which is already used in `Comprar` and `Carrito`).

---

## 10. Mandatory PDF Bug Fixes & Guardrails for Agents

The original practice PDF contained several compile-time, runtime, and cross-stack defects. Agents **must** apply all fixes below during implementation:

1. **Fix `async void IniciaSesionAsync` → `async Task IniciaSesionAsync`:** Always `await auth.IniciaSesionAsync(claims)` in `AuthController.IndexAsync` and `RefrescaTokenDelegatingHandler.SendAsync`. Leaving it `async void` causes race conditions where redirects flush before `Set-Cookie` is written.
2. **Fix `ArchivoId` JSON Serialization Mismatch:** Add `[JsonPropertyName("archivoid")]` on `Producto.ArchivoId` (or have the backend Zod schema accept both `archivoid` and `archivoId`). Without this, `PostAsJsonAsync` sends `"archivoId"` (camelCase) while the backend expects `"archivoid"` (lowercase), silently dropping product cover images on create/edit.
3. **Fix `AuthClientService.ObtenTokenAsync` Status Check:** Call `response.EnsureSuccessStatusCode()` before `ReadFromJsonAsync<AuthUser>()` so `401` login failures fail cleanly instead of throwing a `JsonException`.
4. **Fix `UsuariosController` Route Parameter Consistency:** Standardize `EditarAsync` to accept `string id` (matching `Detalle`, `Eliminar`, and `asp-route-id="@item.Email"` in `Views/Usuarios/Index.cshtml`), or update the view to `asp-route-email`.
5. **Fix Razor Partial & Layout Filenames:** Use leading underscores (`_ViewImports.cshtml`, `_Layout.cshtml`, `_MenuIzqPartial.cshtml`, `_MenuDerPartial.cshtml`, `_ValidationScriptsPartial.cshtml`, `_DetallePartial.cshtml`, `_CardPartial.cshtml`, `_CategoriasListadoPartial.cshtml`).
6. **Fix Copy-Paste Controller Filenames:** Create `Controllers/CarritoController.cs` and `Controllers/ComprarController.cs` (the PDF mistakenly titled both as `UsuariosController.cs`).
7. **Fix `Program.cs` Typed `HttpClient` Handler Chaining:** Ensure every API client service (except `AuthClientService`) chains `.AddHttpMessageHandler<EnviaBearerDelegatingHandler>().AddHttpMessageHandler<RefrescaTokenDelegatingHandler>()` cleanly.
8. **Fix Unhandled `401` in Dropdown Loaders:** Wrap `ProductosDropDownListAsync()`, `CategoriasDropDownListAsync()`, and `RolesDropDownListAsync()` calls inside `try/catch (HttpRequestException ex)` blocks in `Crear`/`Editar` actions so expired sessions redirect to `/Auth/Salir` instead of crashing to `/Home/Error`.
9. **Fix `Producto.Precio` Regex:** Escape the decimal dot (`@"^\d+(\.\d{1,2})?$"`) so non-numeric characters are rejected.
10. **Fix Broken Placeholder Domain & UI Typos:** Replace `via.placeholder.com` with `placehold.co`, fix `"Tamprecio"` → `"Tamaño"`, and `"Nueva película"` → `"Nuevo producto"`.
11. **Add `[ValidateAntiForgeryToken]`** on all `[HttpPost]` controller actions.
12. **Definition of Done:** `dotnet build` succeeds with zero errors and zero nullable warnings on critical auth paths; all CRUD flows work end-to-end against `backendnode` (`http://localhost:3000`).