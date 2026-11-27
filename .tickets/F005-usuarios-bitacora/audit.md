# Security Audit — F005 (usuarios-bitacora)

| Field | Value |
| :--- | :--- |
| Ticket | `F005-usuarios-bitacora` |
| Target | `Frontend` |
| Audited Commit | `54bd67e` (ticket commit `ac70091`) |
| Date | `2026-11-27` |
| Verdict | `PASS` |

Evidence: static source review at `54bd67e` (ticket commit `ac70091`). The .NET SDK is not available in the audit environment, so the build and live checks were not re-run here; the router's live verification in `frontendnet/.routing/PROGRESS.md` (2026-11-26/27) was cross-checked against the code, not accepted on its own. Read: `Controllers/UsuariosController.cs`, `Controllers/BitacoraController.cs`, `Services/UsuariosClientService.cs`, `Services/RolesClientService.cs`, `Services/BitacoraClientService.cs`, `Models/Usuario.cs`, `Models/UsuarioPwd.cs`, `Models/PasswordPolicyAttribute.cs`, `Views/Usuarios/*`, `Views/Bitacora/Index.cshtml`. Repo-wide greps over `Controllers/`, `Services/`, `Views/`: no `Html.Raw`, no `async void`, no `IgnoreAntiforgery`, no `Redirect(`/`returnUrl` sinks, every controller carries `[Authorize]` or a deliberate `[AllowAnonymous]`, every numeric id is an `int` route value and the only string path segment (`email`) is built with `Uri.EscapeDataString`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| Cookie & Session Auth | `N/A` | Inherited from F001. |
| CSRF Protection | `PASS` | Global `AutoValidateAntiforgeryTokenAttribute` covers every unsafe method; forms use tag helpers. |
| XSS Prevention | `PASS` | Razor encoding only; no `Html.Raw`; CSP `script-src` is `self` + 2 CDNs with SRI, no inline scripts. |
| RBAC & Auto-Logout | `PASS` | Both controllers `[Authorize(Roles = "Administrador")]`. Edit takes the email from the route and discards the posted one. Own-account and `protegido` guards are only UI hints (`PuedeEditar`); the backend `403` is surfaced as a message. |
| JWT Exposure | `N/A` |  |
| Upload & Input Validation | `PASS` | `PasswordPolicyAttribute` = 12–128 chars + upper/lower/digit/symbol, matching backend `StrongPasswordSchema` (DEC-014), client and server; email path segment escaped with `Uri.EscapeDataString`. |
| Secrets & Config | `PASS` | No secrets in `appsettings*.json`; `UrlWebAPI` is server-side only; browser never sees the API host. |

## Findings

None.
