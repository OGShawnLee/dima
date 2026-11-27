# Security Audit — F009 (app-hardening)

| Field | Value |
| :--- | :--- |
| Ticket | `F009-app-hardening` |
| Target | `Frontend` |
| Audited Commit | `54bd67e` (ticket commit `c3e1251`) |
| Date | `2026-11-27` |
| Verdict | `PASS` |

Evidence: static source review at `54bd67e` (ticket commit `c3e1251`). The .NET SDK is not available in the audit environment, so the build and live checks were not re-run here; the router's live verification in `frontendnet/.routing/PROGRESS.md` (2026-11-26/27) was cross-checked against the code, not accepted on its own. Read: `Program.cs` (binding messages, filter registration, `HttpClient` timeout), `Filters/ErrorServicioExceptionFilter.cs`, `Controllers/ArchivosController.cs` (`Imagen` cache headers), `Views/Home/Error.cshtml`. Repo-wide greps over `Controllers/`, `Services/`, `Views/`: no `Html.Raw`, no `async void`, no `IgnoreAntiforgery`, no `Redirect(`/`returnUrl` sinks, every controller carries `[Authorize]` or a deliberate `[AllowAnonymous]`, every numeric id is an `int` route value and the only string path segment (`email`) is built with `Uri.EscapeDataString`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| Cookie & Session Auth | `PASS` | `Imagen` responses for signed-in users are `private, max-age=300`, so a re-issued cookie is never stored by a shared cache. |
| CSRF Protection | `N/A` | No new actions. |
| XSS Prevention | `PASS` | Model-binding messages echo the attempted value through the standard `ModelState` → encoded `asp-validation-for` path. |
| RBAC & Auto-Logout | `PASS` | The global filter maps `401` → `/Auth/Salir`, `403` → AccessDenied, timeouts and connection failures → a generic Spanish `503` page; client aborts → `499`; no exception text or stack trace reaches the response; logged with method/path/status only. |
| JWT Exposure | `N/A` |  |
| Upload & Input Validation | `PASS` | `UrlWebAPITimeoutSeconds` bounded 1–300, default 30 s (< nginx 60 s). |
| Secrets & Config | `PASS` | No new configuration secrets. |

## Findings

None.
