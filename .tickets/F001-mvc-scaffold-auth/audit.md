# Security Audit — F001 (mvc-scaffold-auth)

| Field | Value |
| :--- | :--- |
| Ticket | `F001-mvc-scaffold-auth` |
| Target | `Frontend` |
| Audited Commit | `54bd67e` (ticket commit `3397900`) |
| Date | `2026-11-27` |
| Verdict | `PASS WITH NOTES` |

Evidence: static source review at `54bd67e` (ticket commit `3397900`). The .NET SDK is not available in the audit environment, so the build and live checks were not re-run here; the router's live verification in `frontendnet/.routing/PROGRESS.md` (2026-11-26/27) was cross-checked against the code, not accepted on its own. Read: `Program.cs`, `Controllers/AuthController.cs`, `Controllers/PerfilController.cs`, `Controllers/HomeController.cs`, `Services/AuthClientService.cs`, `Services/PerfilClientService.cs`, `Middlewares/*.cs`, `Models/Login.cs`, `Views/Auth/Index.cshtml`, `Views/Perfil/Index.cshtml`, `Views/Shared/_Layout.cshtml`. Repo-wide greps over `Controllers/`, `Services/`, `Views/`: no `Html.Raw`, no `async void`, no `IgnoreAntiforgery`, no `Redirect(`/`returnUrl` sinks, every controller carries `[Authorize]` or a deliberate `[AllowAnonymous]`, every numeric id is an `int` route value and the only string path segment (`email`) is built with `Uri.EscapeDataString`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| Cookie & Session Auth | `PASS` | `.frontendnet`: `HttpOnly`, `SameSite=Strict`, `Secure` outside Development, 20 min sliding; `IniciaSesionAsync` returns `Task` and is awaited; Data Protection keys persisted (0700, `UMask=0077` in prod). |
| CSRF Protection | `PASS` | Global `AutoValidateAntiforgeryTokenAttribute` covers every unsafe method; forms use tag helpers. |
| XSS Prevention | `PASS` | Razor encoding only; no `Html.Raw`; CSP `script-src` is `self` + 2 CDNs with SRI, no inline scripts. |
| RBAC & Auto-Logout | `PASS` | Fallback via `[Authorize]` per controller; `RefrescaTokenDelegatingHandler` turns non-2xx into `HttpRequestException(StatusCode)`; `401` → `/Auth/Salir`; `ObtenTokenAsync` calls `EnsureSuccessStatusCode()`. Login shows one generic message for `400`/`401`/`429` (no enumeration); no open redirect (fixed targets). |
| JWT Exposure | `PASS` | Raw JWT only rendered on `/Perfil` when `ViewBag.MostrarJwt` (Development). |
| Upload & Input Validation | `N/A` | Login model only. |
| Secrets & Config | `PASS` | No secrets in `appsettings*.json`; `UrlWebAPI` is server-side only; browser never sees the API host. |
| Forwarded IP / proxy trust | `PASS` | `UseForwardedHeaders` trusts loopback only; `ReenviaIpDelegatingHandler` strips any incoming `X-Forwarded-For` and sends one hop. |
| Security headers | `PASS` | CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; HSTS outside Development. |

## Findings

### AUD-F001-01 — Logout is a GET and does not revoke the issued cookie or JWT
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `frontendnet/Controllers/AuthController.cs` (`SalirAsync`, `[HttpGet]`)
- **CWE / OWASP:** `CWE-352 / CWE-613 / OWASP A07:2021`
- **Issue / Exploit Scenario:** (a) `/Auth/Salir` signs the user out on a plain GET, so any same-site link or image can log a user out (nuisance only; `SameSite=Strict` stops cross-site triggering). (b) The cookie ticket is self-contained: a copy of `.frontendnet` captured before logout (shared machine, malware, proxy log) stays valid until its 20-minute sliding window lapses, and the JWT inside stays valid at the API until its own expiry. Server-side, logout only deletes the browser's copy.
- **Required Fix:** Keep the GET only as the landing target for `401` redirects, and make the menu's "Salir" a `POST` form (antiforgery-protected). Optionally, set a short absolute lifetime on the ticket (`AuthenticationProperties.ExpiresUtc` at sign-in) so a stolen cookie cannot slide indefinitely. Document the residual JWT lifetime as accepted in `frontendnet/.routing/DECISION.md`.
- **Required Regression Test:** `POST /Auth/Salir` without an antiforgery token returns `400`, and with one it clears the cookie. Replaying a captured cookie after the absolute lifetime redirects to `/Auth`.
