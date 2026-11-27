# F003 — Archivos CRUD & BFF Image Proxy

| ID | Status | Model | Lane | Spec |
| :--- | :--- | :--- | :--- | :--- |
| `F003` | `implemented` | Fast coding model (parallel worktree) | Front | [spec.md](spec.md) |

## Items addressed
- FRONTEND-API-SPEC §5 (`Upload`, `Archivo` — "Tamaño" typo fix), §7 (`ArchivosClientService`), §8 (`ArchivosController`), §9 (`portada.js`); PDF fixes #8, #10, #11.
- [FDEC-002](../../frontendnet/.routing/DECISION.md#fdec-002) BFF image proxy.
- Backend contract: `.routing/services/archivos_service.md` (`archivoId`, `size`, JPEG magic bytes, ≤ 100 KB, multipart field `file`).

## Scope

### May create or edit
- `frontendnet/Models/Upload.cs`, `Models/Archivo.cs`
- `frontendnet/Services/ArchivosClientService.cs`
- `frontendnet/Controllers/ArchivosController.cs`
- `frontendnet/Views/Archivos/**`
- `frontendnet/wwwroot/js/portada.js`
- `.tickets/F003-archivos-image-proxy/changelog.md`

### Must not touch
- `Program.cs`, `Views/Shared/**`, other controllers/views.

## Steps
1. CRUD per spec (admin only). Server-side checks before upload: `Length <= 102400`, extension `.jpg/.jpeg` (case-insensitive), `ContentType == "image/jpeg"`, first 3 bytes `FF D8 FF`. Client-side: `accept="image/jpeg"` + size check in `portada.js`.
2. Add `[AllowAnonymous] [HttpGet] Imagen(int id)` → `ArchivosClientService.GetBinaryAsync(id)` → `File(stream, "image/jpeg")`, add `X-Content-Type-Options: nosniff`, `[ResponseCache(Duration = 300)]`; return `NotFound()` on `404`. Validate `id > 0`.
3. Views render images with `<img src="@Url.Action("Imagen","Archivos",new{ id })">`; no `PublicUrlWebAPI` anywhere.
4. Map backend `400` (bad file) to a `ModelState` error.

## Done when
[spec.md](spec.md) passes.
