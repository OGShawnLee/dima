# Security Audit — F002 (categorias-crud)

| Field | Value |
| :--- | :--- |
| Ticket | `F002-categorias-crud` |
| Target | `Frontend` |
| Audited Commit | `54bd67e` (ticket commit `1428abf`) |
| Date | `2026-11-27` |
| Verdict | `PASS` |

Evidence: static source review at `54bd67e` (ticket commit `1428abf`). The .NET SDK is not available in the audit environment, so the build and live checks were not re-run here; the router's live verification in `frontendnet/.routing/PROGRESS.md` (2026-11-26/27) was cross-checked against the code, not accepted on its own. Read: `Controllers/CategoriasController.cs`, `Services/CategoriasClientService.cs`, `Models/Categoria.cs`, `Views/Categorias/*`. Repo-wide greps over `Controllers/`, `Services/`, `Views/`: no `Html.Raw`, no `async void`, no `IgnoreAntiforgery`, no `Redirect(`/`returnUrl` sinks, every controller carries `[Authorize]` or a deliberate `[AllowAnonymous]`, every numeric id is an `int` route value and the only string path segment (`email`) is built with `Uri.EscapeDataString`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| Cookie & Session Auth | `N/A` | Inherited from F001. |
| CSRF Protection | `PASS` | Global `AutoValidateAntiforgeryTokenAttribute` covers every unsafe method; forms use tag helpers. |
| XSS Prevention | `PASS` | Razor encoding only; no `Html.Raw`; CSP `script-src` is `self` + 2 CDNs with SRI, no inline scripts. |
| RBAC & Auto-Logout | `PASS` | `[Authorize(Roles = "Administrador")]`; `401` → `/Auth/Salir`, `403` → AccessDenied, `404` → `NotFound()`. Backend RBAC remains authoritative. |
| JWT Exposure | `N/A` |  |
| Upload & Input Validation | `PASS` | `[Bind("Nombre")]` on create/edit (forged `Protegida`/`CategoriaId` ignored); service sends only `{ nombre }`; id is an `int` route value. |
| Secrets & Config | `PASS` | No secrets in `appsettings*.json`; `UrlWebAPI` is server-side only; browser never sees the API host. |

## Findings

None.
