# F003 — Changelog

## Files touched
- `frontendnet/Models/Upload.cs` (new) — `ArchivoId`, `Nombre`, `[Required] IFormFile? Portada`.
- `frontendnet/Models/Archivo.cs` (new) — maps `ArchivoMetadataDto` (`archivoId`, `mime`, `nombre`, `size`, `indb`); Display `"Tamaño"` (PDF fix #10).
- `frontendnet/Services/ArchivosClientService.cs` — `GetAsync()`, `GetAsync(id)` (`/detalle`), `GetBinaryAsync(id)`, `PostAsync`, `PutAsync` (multipart field `file`), `DeleteAsync`.
- `frontendnet/Controllers/ArchivosController.cs` (new) — admin CRUD + anonymous `GET /Archivos/Imagen/{id:int}` proxy.
- `frontendnet/Views/Archivos/` (new) — `Index`, `Detalle`, `Crear`, `Editar`, `Eliminar`, `_DetallePartial`, `_FormularioPartial`, `_MensajePartial`.
- `frontendnet/wwwroot/js/portada.js` (new) — client-side type/size check + live preview.

## Implementation notes
- `Upload.Portada` is `IFormFile?` + `[Required]` instead of the spec's C# `required` modifier, so the `Editar` GET can build the model without a file. POST still requires it.
- Server checks before upload (in this order): non-empty, `Length <= 102400`, `.jpg/.jpeg` (case-insensitive) and `ContentType == image/jpeg`, first 3 bytes `FF D8 FF`. The browser's filename is never forwarded; the multipart part is always named `portada.jpg`.
- Backend `400`/`415`/`413` → `ModelState` error on `Portada`; `401` → `/Auth/Salir`; `403` → `/Home/AccessDenied`; `404` → `NotFound()`.
- Image proxy: attribute route `{id:int}` (non-int → 404, so no caller-controlled path reaches the backend), `id <= 0` → `400`, unknown → `404`. Success sets `image/jpeg`, `X-Content-Type-Options: nosniff` and `[ResponseCache(Duration = 300)]`. Error responses override this with `Cache-Control: no-store` so 404s are not cached.
- Views add `?v={nombre}` to `Url.Action("Imagen", "Archivos", new { id, v })` to bust the cache. The backend generates a new UUID `nombre` on `PUT`, so a replaced image shows immediately despite the 5-minute cache. The server ignores `v`.
- CSP: no inline scripts or handlers. The preview uses `FileReader.readAsDataURL` because `img-src` allows `data:` but not `blob:`. The placeholder uses `placehold.co`, which is allowed.

## Gates
1. `dotnet build frontendnet/frontendnet.csproj -c Release --no-incremental` → `0 Warning(s)`, `0 Error(s)`.
2. `grep -rn "async void" frontendnet --include='*.cs'` → no output.
3. The global `AutoValidateAntiforgeryTokenAttribute` covers every POST, and `grep IgnoreAntiforgery` → no output. POST `/Archivos/Eliminar/1` without a token → `400`.
4. `grep -rn "Html.Raw" frontendnet/Views` → no output.
5. Smoke test against the shared backend (`http://localhost:3000`), BFF on `https://localhost:8445`. Logins used fake XFF `198.51.100.31` (admin) and `.32` (user). Results below.
6. Scope: changed and untracked files are exactly the files listed above plus this changelog.

## Spec checks
| Check | Result | Evidence |
| :--- | :--- | :--- |
| Build gate passes | PASS | Gate 1 output above. |
| Admin uploads a JPEG ≤ 100 KB; it shows in the list and in Detalle via `/Archivos/Imagen/{id}` | PASS | `ok1.jpg` (1039 B, filename `foto.JPG`) → `302 /Archivos/Detalle/1` with "Imagen subida correctamente." Detalle and Index both render `<img src="/Archivos/Imagen/1?v=<uuid>.jpg">`. The proxied bytes match the uploaded file (`cmp` identical). |
| Rejected with a form error (no crash): 150 KB JPEG, `.png` renamed `.jpg`, `.html` renamed `.jpg`, empty file | PASS | All four return `200` with the form re-rendered and a `Portada` field error. 151912 B JPEG → "La imagen excede el tamaño máximo de 100 KB."; png→jpg and html→jpg → "El contenido del archivo no corresponde a una imagen JPG."; empty → "El archivo está vacío.". A real `.png` sent as `image/png` → "Solo se permiten imágenes con extensión JPG." |
| Edit replaces the image; delete removes it | PASS | Editar/1 with html→jpg → form error. With `ok2.jpg` → `302 /Archivos/Detalle/1`, "Imagen reemplazada correctamente.", the proxy now serves bytes identical to `ok2.jpg`, and `v=` changed to the new UUID. Eliminar POST → `302 /Archivos` with "Imagen eliminada correctamente.". Afterwards `/Archivos/Imagen/1` → `404` and the list is empty. `Editar/999999` → `404`. |
| `/Archivos/Imagen/{id}` works anonymously with `image/jpeg` + `nosniff`; unknown → 404; `-1`/`abc` → 400/404, never 500 | PASS | Without a cookie: `200`, `content-type: image/jpeg`, `x-content-type-options: nosniff`, `cache-control: public,max-age=300`. `999999` → `404` (`no-store`), `-1` → `400`, `0` → `400`, `abc` → `404`, encoded traversal `1%2F..%2F..%2Fapi%2Fusuarios` → `404`. |
| `grep -rn "PublicUrlWebAPI\|:3000" frontendnet/Views` empty | PASS | No output. |
| Usuario → AccessDenied on `/Archivos` | PASS | `patito@uv.mx`: GET `/Archivos` → `302 /Home/AccessDenied?ReturnUrl=%2FArchivos`. POST `/Archivos/Crear` → `302 /Home/AccessDenied`. Anonymous → `302 /Auth?ReturnUrl=%2FArchivos`. |

## Not verified
- The mapping from a backend `400`/`413`/`415` to a form error was not hit live: the BFF's own checks reject every bad file first. The code path exists in `AgregaErrorBackend`.
- The `portada.js` preview and client-side rejection were not run in a real browser (curl only). The script only adds an event listener, so it is CSP-compatible.
- Forced `401` (expired JWT) → `/Auth/Salir` was not reproduced. It uses the same `HttpRequestException.StatusCode` branch as F001's `PerfilController`.

## Test data
- Created only archivo id `1` (my own test upload) and deleted it at the end. No seeded data was modified.
