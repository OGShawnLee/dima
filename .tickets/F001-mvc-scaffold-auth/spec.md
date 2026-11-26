# F001 — Verification Spec

## Build gates
- [ ] `dotnet build frontendnet/frontendnet.csproj -c Release` exits `0` with `0` errors.
- [ ] `TargetFramework` is `net10.0`.
- [ ] `grep -rn "async void" frontendnet --include=*.cs` returns nothing.

## Functional (backend running on `http://localhost:3000`, seeded)
- [ ] `/` and `/Auth` load anonymously; `/Perfil` redirects anonymous users to `/Auth`.
- [ ] Admin login → `/Productos` (404 page acceptable until F004); Usuario login → `/Home`.
- [ ] Wrong password shows a generic message and the form keeps client-side validation (empty email / bad email format blocked before submit).
- [ ] `/Perfil` shows name, email, role and remaining time from `GET /api/auth/tiempo`.
- [ ] With a JWT inside the last 5 min, any API call returns `Set-Authorization` and the cookie is re-issued (check `Set-Cookie` in devtools).
- [ ] Backend restart while logged in → next page still works (state kept by cookie).
- [ ] Expired/invalid JWT → `/Auth/Salir` → `/Auth`.
- [ ] `/Auth/Salir` clears the `.frontendnet` cookie.

## Security
- [ ] Cookie flags: `HttpOnly`, `SameSite=Strict`, `Secure` under the `https` profile.
- [ ] Antiforgery token present in the login form; `POST /Auth` without token → `400`.
- [ ] Response headers include CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`.
- [ ] Raw JWT not rendered when `ASPNETCORE_ENVIRONMENT=Production`.
- [ ] No secrets in `appsettings*.json`.
- [ ] `X-Forwarded-For` sent to the backend on login (verify in backend `bitacora` IP or a request log).
