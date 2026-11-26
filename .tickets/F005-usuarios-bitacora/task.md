# F005 — Usuarios CRUD & Bitácora

| ID | Status | Model | Lane | Spec |
| :--- | :--- | :--- | :--- | :--- |
| `F005` | `draft` | Fast coding model (parallel worktree) | Front | [spec.md](spec.md) |

## Items addressed
- FRONTEND-API-SPEC §5 (`Rol`, `Usuario`, `UsuarioPwd`, `Bitacora`), §7, §8; PDF fixes #4 (`string id` route param), #8, #11.
- Backend contract: `usuarios_service.md`, `roles_service.md`, `bitacora_service.md` (`rol` on create, `protegido`, self-edit `403`, `usuario.login.fallido` rows).

## Scope

### May create or edit
- `frontendnet/Models/Rol.cs`, `Models/Usuario.cs`, `Models/UsuarioPwd.cs`, `Models/Bitacora.cs`, `Models/PasswordPolicyAttribute.cs`
- `frontendnet/Services/UsuariosClientService.cs`, `Services/RolesClientService.cs`, `Services/BitacoraClientService.cs`
- `frontendnet/Controllers/UsuariosController.cs`, `Controllers/BitacoraController.cs`
- `frontendnet/Views/Usuarios/**`, `frontendnet/Views/Bitacora/**`
- `.tickets/F005-usuarios-bitacora/changelog.md`

### Must not touch
- `Program.cs`, `Views/Shared/**`, other controllers/views.

## Steps
1. Admin CRUD keyed by email (`Uri.EscapeDataString` in API paths). `ViewBag.PuedeEditar = User.Identity?.Name != email`.
2. `PasswordPolicyAttribute` (reused by F007): min 12 chars, ≥1 upper, ≥1 lower, ≥1 digit, ≥1 symbol, max 128; client-side via `IClientModelValidator` + `jquery.validate` regex adapter. Mirror whatever the backend finally enforces (see BACK-HANDOFF item 2).
3. Map backend `403` (protected user / self-edit) and `409` (duplicate email) to form errors.
4. Bitácora: read-only table, UTC → `America/Mexico_City` via `TimeZoneInfo.FindSystemTimeZoneById("America/Mexico_City")` (IANA id works on Linux and .NET 10 on Windows); highlight `usuario.login.fallido` rows.

## Done when
[spec.md](spec.md) passes.
