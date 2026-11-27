# Security Audit — F007 (registro-pedidos)

| Field | Value |
| :--- | :--- |
| Ticket | `F007-registro-pedidos` |
| Target | `Frontend` |
| Audited Commit | `54bd67e` (ticket commit `15f417d`) |
| Date | `2026-11-27` |
| Verdict | `PASS` |

Evidence: static source review at `54bd67e` (ticket commit `15f417d`). The .NET SDK is not available in the audit environment, so the build and live checks were not re-run here; the router's live verification in `frontendnet/.routing/PROGRESS.md` (2026-11-26/27) was cross-checked against the code, not accepted on its own. Read: `Controllers/RegistroController.cs`, `Controllers/PedidosController.cs`, `Services/AuthClientService.cs` (`RegistrarAsync`), `Services/PedidosClientService.cs`, `Models/Registro.cs`, `Models/Pedido.cs`, `Models/PedidoDetalle.cs`, `Views/Registro/*`, `Views/Pedidos/*`. Repo-wide greps over `Controllers/`, `Services/`, `Views/`: no `Html.Raw`, no `async void`, no `IgnoreAntiforgery`, no `Redirect(`/`returnUrl` sinks, every controller carries `[Authorize]` or a deliberate `[AllowAnonymous]`, every numeric id is an `int` route value and the only string path segment (`email`) is built with `Uri.EscapeDataString`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| Cookie & Session Auth | `PASS` | After registration, the user is signed in through the same `ObtenTokenAsync` → `IniciaSesionAsync` path as `/Auth`, so the role always comes from the backend token. |
| CSRF Protection | `PASS` | Global `AutoValidateAntiforgeryTokenAttribute` covers every unsafe method; forms use tag helpers. |
| XSS Prevention | `PASS` | Razor encoding only; no `Html.Raw`; CSP `script-src` is `self` + 2 CDNs with SRI, no inline scripts. |
| RBAC & Auto-Logout | `PASS` | `/Registro` anonymous (redirects if signed in); `PedidosController` `Usuario,Administrador`, `Index` admin-only, `Mios`/`Confirmar` Usuario-only; `Detalle/{id:int}` relies on backend anti-IDOR `404`. |
| JWT Exposure | `N/A` |  |
| Upload & Input Validation | `PASS` | `[Bind]` on `Registro` (no role field exists to forge); strong password policy and `[Compare]` confirmation; checkout sends only `{ productoId, cantidad }` from the session (backend recomputes prices); a timeout keeps the cart and points to "Mis pedidos" to avoid duplicates. |
| Secrets & Config | `PASS` | No secrets in `appsettings*.json`; `UrlWebAPI` is server-side only; browser never sees the API host. |

## Findings

None.

Note (informational, no action): a well-formed registration for an existing email gets the generic message, while invalid input gets the validation message, so the form reveals whether an email is registered. This is inherent to self-registration and was already accepted at the API level (`AUD-B009-02`). It is mitigated by the backend per-IP registration limit (5/h) and the nginx POST throttle.
