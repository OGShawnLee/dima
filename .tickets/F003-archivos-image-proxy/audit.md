# Security Audit — F003 (archivos-image-proxy)

| Field | Value |
| :--- | :--- |
| Ticket | `F003-archivos-image-proxy` |
| Target | `Frontend` |
| Audited Commit | `54bd67e` (ticket commit `6d627d9`) |
| Date | `2026-11-27` |
| Verdict | `PASS WITH NOTES` |

Evidence: static source review at `54bd67e` (ticket commit `6d627d9`). The .NET SDK is not available in the audit environment, so the build and live checks were not re-run here; the router's live verification in `frontendnet/.routing/PROGRESS.md` (2026-11-26/27) was cross-checked against the code, not accepted on its own. Read: `Controllers/ArchivosController.cs`, `Services/ArchivosClientService.cs`, `Models/Upload.cs`, `Models/Archivo.cs`, `Views/Archivos/*`. Repo-wide greps over `Controllers/`, `Services/`, `Views/`: no `Html.Raw`, no `async void`, no `IgnoreAntiforgery`, no `Redirect(`/`returnUrl` sinks, every controller carries `[Authorize]` or a deliberate `[AllowAnonymous]`, every numeric id is an `int` route value and the only string path segment (`email`) is built with `Uri.EscapeDataString`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| Cookie & Session Auth | `N/A` | Inherited from F001. |
| CSRF Protection | `PASS` | Global `AutoValidateAntiforgeryTokenAttribute` covers every unsafe method; forms use tag helpers. |
| XSS Prevention | `PASS` | Razor encoding only; no `Html.Raw`; CSP `script-src` is `self` + 2 CDNs with SRI, no inline scripts. |
| RBAC & Auto-Logout | `PASS` | Controller `[Authorize(Roles = "Administrador")]`; only `Imagen` is `[AllowAnonymous]`, behind `{id:int}` so it cannot reach other backend paths. |
| JWT Exposure | `N/A` |  |
| Upload & Input Validation | `PASS` | Early checks for size (100 KB), `.jpg/.jpeg`, `image/jpeg`, and `FF D8 FF` magic bytes; the browser filename is never forwarded (`portada.jpg`); the backend re-validates. Proxy returns `image/jpeg` + `nosniff`; error paths are `no-store`; authenticated responses are `private` so a refreshed cookie is never stored by a shared cache. |
| Secrets & Config | `PASS` | No secrets in `appsettings*.json`; `UrlWebAPI` is server-side only; browser never sees the API host. |

## Findings

### AUD-F003-01 — No application-level request body limit on the upload actions
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `frontendnet/Controllers/ArchivosController.cs` (`Crear`/`Editar` POST)
- **CWE / OWASP:** `CWE-770 / OWASP API4:2023`
- **Issue / Exploit Scenario:** The 100 KB check runs after model binding has already buffered the multipart body. Kestrel's defaults allow ~28.6 MB bodies (128 MB multipart), so an authenticated admin session, or a forged POST that still has to pass antiforgery, can make the BFF buffer large files to disk. In production, nginx `client_max_body_size 1m` caps this, but the app relies on that external setting, and the dev profile has no cap.
- **Required Fix:** Add `[RequestSizeLimit(256 * 1024)]` and `[RequestFormLimits(MultipartBodyLengthLimit = 256 * 1024)]` to both upload POST actions.
- **Required Regression Test:** POST a 2 MB multipart body to `/Archivos/Crear` directly to Kestrel; expect `413` before the action runs.
