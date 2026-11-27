# F002 — Changelog

## Files touched

| File | Change |
| :--- | :--- |
| `frontendnet/Models/Categoria.cs` | New. `int? CategoriaId` (Display "Id"), `required string Nombre` (`[Required]`, `[StringLength(255)]`, Spanish messages), `bool Protegida`. Matches backend `CategoriaDto` `{ categoriaId, nombre, protegida }`. |
| `frontendnet/Services/CategoriasClientService.cs` | Replaced the F001 stub. `GetAsync()`, `GetAsync(id)`, `PostAsync`, `PutAsync`, `DeleteAsync` → `GET/POST api/categorias`, `GET/PUT/DELETE api/categorias/{id}`, each calling `EnsureSuccessStatusCode()`. POST/PUT send only `{ nombre }`, never `protegida` or `id`. |
| `frontendnet/Controllers/CategoriasController.cs` | New. `[Authorize(Roles = "Administrador")]`. Actions: `Index`, `Detalle/{id}`, `Crear` (GET/POST), `Editar/{id}` (GET/POST), `Eliminar/{id}` (GET/POST). POSTs bind only `Nombre` (`[Bind("Nombre")]`). Every backend call catches `HttpRequestException`. |
| `frontendnet/Views/Categorias/{Index,Detalle,Crear,Editar,Eliminar,_DetallePartial}.cshtml` | New. Bootstrap tables and forms. `Crear`, `Editar` and `Eliminar` include `_ValidationScriptsPartial`. `Eliminar` shows a warning and no form when `Protegida == true`. |

## Status handling

The shared helper `Redireccion` maps statuses like this:

- `401` → `RedirectToAction("Salir","Auth")`
- `403` → `/Home/AccessDenied`
- `404` → `NotFound()`
- On reads (`Detalle`, `Editar`, `Eliminar` GET), `400` (invalid id) → `NotFound()`

On `Crear`/`Editar` POST, `400` and `409` add a Spanish `ModelState` error and redisplay the form. Other errors (`5xx` or network) show "El servicio no está disponible…".

`Eliminar` POST shows `400`/`403`/`409` as an inline error on the redisplayed delete page. It does not redirect for these.

## Deviation noted (spec vs. backend contract)

spec.md says a forged delete of a protected category "shows the backend `403`". The real backend (`categorias.service.ts` and `.routing/services/categorias_service.md`, rule 2) returns **`400 Bad Request`** for protected categories. Backend is the source of truth, so the controller handles `400` (the observed status) and also `403`. Both appear as an inline error on the delete page. The Frontend Router may want to fix the spec wording.

## Gates

1. `dotnet build frontendnet/frontendnet.csproj -c Release --no-incremental` → exit `0`, `Build succeeded. 0 Warning(s) 0 Error(s)`.
2. `grep -rn "async void" frontendnet --include='*.cs'` → no output (exit 1).
3. Antiforgery: the global `AutoValidateAntiforgeryTokenAttribute` filter is in `Program.cs`. `grep -rn IgnoreAntiforgery frontendnet` → no output. All 3 POST actions were tested without a token → `400` (see below).
4. `grep -rn "Html.Raw" frontendnet/Views` → no output (exit 1).
5. Manual smoke: see the table below.
6. Scope: `git status --porcelain --untracked-files=all` lists only `Models/Categoria.cs`, `Services/CategoriasClientService.cs`, `Controllers/CategoriasController.cs`, `Views/Categorias/*` (6 files) and this changelog.

## Spec checks (smoke against shared backend `http://localhost:3000`, BFF on `https://localhost:8444`, curl + cookie jars, fake `X-Forwarded-For` 198.51.100.21–23)

| Check | Result | Evidence |
| :--- | :--- | :--- |
| Build gate | PASS | Release build without incremental: exit 0, 0 warnings, 0 errors. Gates 2/3/4/6 clean (above). |
| Admin list/view/create/edit/delete; list reflects changes | PASS | Login as `gvera@uv.mx` → `302 /Productos`. `GET /Categorias` → `200`, 15 seeded rows. `POST /Categorias/Crear` (`Nombre=F002 prueba <script>…`) → `302 /Categorias`, the new row (id 16) and "Categoría creada correctamente." appear. `GET /Categorias/Detalle/16` → `200` with the name. `POST /Categorias/Editar/16` (`Nombre=F002 prueba editada`, plus forged `Protegida=true`) → `302`. The list shows the new name, and the badge still reads "No", so the overpost was ignored. `GET /Categorias/Eliminar/16` shows the form. `POST /Categorias/Eliminar/16` → `302`, "Categoría eliminada correctamente.", 0 "F002 prueba" rows left, and `Detalle/16` → `404`. |
| Empty name blocked client-side and server-side | PASS (server) / PARTIAL (client) | Server: `POST /Categorias/Crear` with `Nombre="   "` and `POST /Categorias/Editar/16` with `Nombre=""` (no JS) → `200` redisplay with "El campo Nombre es obligatorio.", no crash, no API call. Client: the rendered input carries `data-val-required="El campo Nombre es obligatorio."` and the page loads `_ValidationScriptsPartial` (jquery-validate + unobtrusive). This is **not executed in a browser**: the available preview browser rejects the self-signed dev certificate (`ERR_CERT_AUTHORITY_INVALID`) and no headless browser is installed. |
| Protected category: no delete form; forged POST shows the backend error | PASS (backend answers `400`, see deviation) | `GET /Categorias/Eliminar/1` → 0 `<form>` elements and "Esta categoría está protegida y no puede eliminarse." A forged `POST /Categorias/Eliminar/1` with a valid antiforgery token → `200` page with "No se puede eliminar esta categoría: está protegida o en uso." BFF log: `Category 1 deletion rejected with status 400.` The category is still listed. The `403` branch of the same `catch` was not triggered, because the backend never returns `403` to an Administrador JWT here. |
| Usuario role gets AccessDenied on `/Categorias` | PASS | `patito@uv.mx` → `GET /Categorias` → `302 /Home/AccessDenied?ReturnUrl=%2FCategorias`, and `/Categorias/Crear` gives the same. Anonymous → `302 /Auth?ReturnUrl=%2FCategorias`. |
| Expired JWT on any action redirects to `/Auth/Salir` | PASS | **Invalid JWT:** a scratch tool used the BFF's own Data Protection key ring to mint a valid `.frontendnet` cookie (role Administrador) holding a bogus JWT. `GET` `/Categorias`, `/Detalle/1`, `/Editar/1`, `/Eliminar/1` → all `302 /Auth/Salir`. `POST` `Crear`, `Editar/1`, `Eliminar/1` with a valid antiforgery token → all `302 /Auth/Salir`. `/Auth/Salir` clears `.frontendnet`. **Real expiry (no tampering):** login at 21:20:24. At 21:31:24 `GET /` → `200`, which slides only the cookie (no API call). At 21:42:04 (cookie valid, JWT past its 20 min TTL) `GET /Categorias` → `302 /Auth/Salir`, then `/Auth/Salir` → `302 /Auth`. |
| All POST actions reject requests without antiforgery token | PASS | With the admin cookie and no token, `POST /Categorias/Crear`, `/Editar/16`, `/Eliminar/16` → `400`. A bogus token on `/Eliminar/16` → `400`. The test category was still present afterwards. |
| `<script>` names render encoded | PASS | Index and Detalle render `F002 prueba &lt;script&gt;alert(1)&lt;/script&gt;`. The raw `<script>alert` occurs 0 times. |

Extra: `GET /Categorias/Detalle/999999` → `404`. `GET /Categorias/Detalle/abc` → `404`.

Cleanup: the only test category (id 16, "F002 prueba …") was deleted through the UI. Seeded data was not modified. The list is back to the 15 seeded rows.
