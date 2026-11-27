# F005 — Changelog (Usuarios CRUD & Bitácora)

Date: 2026-11-26 · Worker: frontend worker (Claude Opus 5.5) · Branch: `t3/f005-usuarios-bitacora-crud`

## Files touched

| File | Change |
| :--- | :--- |
| `frontendnet/Models/PasswordPolicyAttribute.cs` | **New.** Reusable DEC-014 policy (12–128 chars, ≥1 upper, ≥1 lower, ≥1 digit, ≥1 symbol `[^A-Za-z0-9]`, same as backend `StrongPasswordSchema`). It checks the password on the server. On the client it implements `IClientModelValidator` and emits the stock unobtrusive `regex` adapter (`data-val-regex`, `data-val-regex-pattern`) plus `maxlength`. No extra JS file or inline script is needed, so it complies with the CSP. Ready for F007. |
| `frontendnet/Models/Rol.cs`, `Usuario.cs`, `UsuarioPwd.cs`, `Bitacora.cs` | **New.** Models per FRONTEND-API-SPEC §5 aligned to the real DTOs. `UsuarioPwd.Password` uses `[PasswordPolicy]`, not the old `[MinLength(6)]`. `Bitacora.Fecha` is a `DateTimeOffset?` and `ElementoId` maps from `elementoid`. |
| `frontendnet/Services/UsuariosClientService.cs` | Filled in the stub: `GetAsync()`, `GetAsync(email)`, `PostAsync`, `PutAsync(email, …)` (sends only `nombre` and `rol`, so no mass assignment), `DeleteAsync`. Every path uses `Uri.EscapeDataString(email)`. |
| `frontendnet/Services/RolesClientService.cs`, `BitacoraClientService.cs` | Filled in the stubs: `GET api/roles`, `GET api/bitacora`. |
| `frontendnet/Controllers/UsuariosController.cs` | **New.** `[Authorize(Roles="Administrador")]`. Actions: Index, Detalle, Crear, Editar, Eliminar (GET confirm + POST `[ActionName("Eliminar")]`), all keyed by `string id` = email (PDF fix #4). `ViewBag.PuedeEditar` compares the target email with `User.Identity.Name`, ignoring case. The POST edit takes the email from the route and ignores any email in the body. Backend status codes map to Spanish form errors: 400 invalid data, 403 protected or own account, 404 not found, 409 duplicate email (shown on the Email field), 401 redirects to `/Auth/Salir`. The roles dropdown loader is wrapped in try/catch (PDF fix #8). |
| `frontendnet/Controllers/BitacoraController.cs` | **New.** Read-only list. Converts UTC to `America/Mexico_City` with `TimeZoneInfo.FindSystemTimeZoneById`. 401 → Salir, 403 → AccessDenied. |
| `frontendnet/Views/Usuarios/*.cshtml` | **New.** Index, Detalle, Crear, Editar, Eliminar, `_DetallePartial`, `_PropiaCuentaPartial`. The own account shows no edit/delete buttons and a warning instead of the form. |
| `frontendnet/Views/Bitacora/Index.cshtml` | **New.** Read-only table. `usuario.login.fallido` rows get `table-danger` and an icon. Every value goes through Razor's default HTML encoding. |
| `.tickets/F005-usuarios-bitacora/changelog.md` | This file. |

No edits to `Program.cs`, `Views/Shared/**`, `Middlewares/**`, `wwwroot/**`, or other tickets' files.

## Gates

1. **Build:** `dotnet build frontendnet/frontendnet.csproj -c Release --no-incremental` → exit 0, `0 Warning(s)`, `0 Error(s)`.
2. **`grep -rn "async void" frontendnet --include='*.cs'`** → no output.
3. **Antiforgery:** the global `AutoValidateAntiforgeryTokenAttribute` covers every POST. `grep -rn IgnoreAntiforgery frontendnet` → no output. Every smoke POST sent the token from the rendered form.
4. **`grep -rn "Html.Raw" frontendnet/Views`** → no output. Bitácora cells (`accion`, `elementoid`, `usuario`, `ip`) use plain `@` output, which Razor HTML-encodes. I tried to inject markup through failed logins with emails such as `<img src=x onerror=alert(1)>`. The backend returned `400` (zod email validation) and wrote no row, so a live markup row could not be produced. Encoding rests on Razor's default behaviour plus the absence of `Html.Raw`.
5. **Manual smoke:** BFF at `https://localhost:8446`, shared backend at `http://localhost:3000`, curl with cookie jars, fake `X-Forwarded-For` 198.51.100.51–55. Results below.
6. **Scope:** `git status --porcelain` lists only the files above plus this changelog.

## Spec checks

| Check | Result | Evidence |
| :--- | :--- | :--- |
| Build gate passes | **PASS** | Gate 1. |
| Admin creates a Usuario with a strong password | **PASS** | POST `/Usuarios/Crear` with `f005-prueba-1@example.com` / `Prueba#F005-2026` / `Usuario` → `302 /Usuarios`, "Usuario creado correctamente.", and the row appears in the list. |
| Weak passwords blocked on the server | **PASS** | POST with `123456`, `password`, `Abcdefgh` → `200`, form re-rendered with the Password error "El campo Contraseña debe tener entre 12 y 128 caracteres e incluir…". Those requests never reached the backend, and the password is not echoed back. |
| Weak passwords blocked on the client | **PASS** | jsdom (no real browser available) loaded the rendered `/Usuarios/Crear` HTML and the exact CDN scripts (SRI hashes re-checked against the layout). `$('#Password').valid()` blocked `123456`, `password`, `Abcdefgh`, `Abcdefgh1234`, `abcdefgh#123` with the Spanish message and accepted `Prueba#F005-2026`. jquery.validate's `:hidden` ignore was turned off because jsdom has no layout. |
| Edit another user works | **PASS** | POST `/Usuarios/Editar/f005-prueba-1@example.com` with Nombre "Prueba Editada" and a forged body `Email=patito@uv.mx` → `302`. Detalle shows the new name. `patito@uv.mx` was not changed, so the body email is ignored. |
| Delete another user works | **PASS** | POST `/Usuarios/Eliminar/{f005-prueba-1,f005-prueba-2}` → `302`, "Usuario eliminado correctamente.". A later GET `Detalle` → `404`. |
| Own account shows no edit/delete | **PASS** | As gvera: the Index row has the "Usted" badge and no Editar/Eliminar links. GET Detalle, Editar and Eliminar for `gvera@uv.mx` show "No puede editar ni eliminar su propia cuenta" with no form or links. |
| Forged POST on own account surfaces backend `403` | **PASS** | As gvera, forged POST `/Usuarios/Editar/gvera@uv.mx` and `/Usuarios/Eliminar/gvera@uv.mx` → "No es posible editar/eliminar este usuario: está protegido o es su propia cuenta." The BFF log shows "rejected by backend with status 403". As temporary admin `f005-prueba-2` (not protected), a forged self-delete also gave a backend `403` with the same message, which isolates the self-rule. |
| Protected seeded admin cannot be edited/deleted | **PASS** | As temporary admin `f005-prueba-2`: POST edit and delete of `gvera@uv.mx` → backend `403`, shown as the form error. gvera is still "Guillermo Vera" / Administrador. |
| Duplicate email → form error | **PASS** | Re-creating `f005-prueba-1@example.com` → backend `409`, shown under Email: "Ya existe un usuario registrado con ese correo electrónico." |
| Bitácora lists actions with local time; failed logins visible | **PASS** | `/Bitacora` → `200`. Row 11 (UTC `2026-11-27T02:45:18Z`) shows `26/11/2026 20:45:18` (UTC-6). My failed BFF login (row 32, `f005-prueba-1@example.com`, IP `198.51.100.54`, `invitado`) shows as `table-danger` with the warning icon. |
| Usuario role → AccessDenied on `/Usuarios` and `/Bitacora` | **PASS** | Logged in as test Usuario `f005-prueba-1`: GET `/Usuarios`, `/Usuarios/Crear`, `/Usuarios/Detalle/gvera@uv.mx`, `/Bitacora` → `302 /Home/AccessDenied?...`. A forged POST `/Usuarios/Eliminar/patito@uv.mx` → `302 /Home/AccessDenied`. |
| Backend `400` mapping (extra) | **PASS** | Edit with `Rol=Root` → "Los datos enviados no son válidos. Revise el formulario." |
| Forced `401` (expired JWT) → `/Auth/Salir` on these pages (gate 5) | **NOT VERIFIED** | I could not force an expired JWT inside the encrypted cookie in this run. The code path (`catch … when StatusCode == Unauthorized` → `RedirectToAction("Salir","Auth")`) is present on every API call. |

## Cleanup

- Test users `f005-prueba-1@example.com` (Usuario) and `f005-prueba-2@example.com` (Administrador) were deleted through the BFF. The final list holds only `gvera@uv.mx` and `patito@uv.mx`.
- Seeded accounts were not modified (protected or rejected attempts only, verified unchanged).
- The BFF process on `:8446` was stopped. The backend was not touched.
- Bitácora keeps the audit rows produced by these tests (append-only by design).
