# Security Audit — F006 (comprar-carrito)

| Field | Value |
| :--- | :--- |
| Ticket | `F006-comprar-carrito` |
| Target | `Frontend` |
| Audited Commit | `54bd67e` (ticket commit `bef862c`) |
| Date | `2026-11-27` |
| Verdict | `PASS` |

Evidence: static source review at `54bd67e` (ticket commit `bef862c`). The .NET SDK is not available in the audit environment, so the build and live checks were not re-run here; the router's live verification in `frontendnet/.routing/PROGRESS.md` (2026-11-26/27) was cross-checked against the code, not accepted on its own. Read: `Controllers/ComprarController.cs`, `Controllers/CarritoController.cs`, `Services/CarritoSessionService.cs`, `Models/CarritoItem.cs`, `Models/CarritoViewModel.cs`, `Views/Comprar/*`, `Views/Carrito/*`. Repo-wide greps over `Controllers/`, `Services/`, `Views/`: no `Html.Raw`, no `async void`, no `IgnoreAntiforgery`, no `Redirect(`/`returnUrl` sinks, every controller carries `[Authorize]` or a deliberate `[AllowAnonymous]`, every numeric id is an `int` route value and the only string path segment (`email`) is built with `Uri.EscapeDataString`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| Cookie & Session Auth | `PASS` | `.frontendnet.session`: `HttpOnly`, `SameSite=Strict`, `Secure` outside Development, 20 min idle; it stores only `{ ProductoId, Cantidad }`; prices are always re-read from the backend. |
| CSRF Protection | `PASS` | Global `AutoValidateAntiforgeryTokenAttribute` covers every unsafe method; forms use tag helpers. |
| XSS Prevention | `PASS` | Razor encoding only; no `Html.Raw`; CSP `script-src` is `self` + 2 CDNs with SRI, no inline scripts. |
| RBAC & Auto-Logout | `PASS` | `/Comprar` `Usuario,Administrador`; `/Carrito` `Usuario` only; the session is cleared on `/Auth/Salir`. |
| JWT Exposure | `N/A` |  |
| Upload & Input Validation | `PASS` | `[Required, Range]` on every POST parameter (quantity 1–99, max 50 lines, matching backend `CreatePedido`). |
| Secrets & Config | `PASS` | No secrets in `appsettings*.json`; `UrlWebAPI` is server-side only; browser never sees the API host. |

## Findings

None.
