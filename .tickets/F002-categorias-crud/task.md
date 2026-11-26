# F002 — Categorías CRUD

| ID | Status | Model | Lane | Spec |
| :--- | :--- | :--- | :--- | :--- |
| `F002` | `draft` | Fast coding model (parallel worktree) | Front | [spec.md](spec.md) |

## Items addressed
- FRONTEND-API-SPEC §5 (`Categoria`), §7 (`CategoriasClientService`), §8 (`CategoriasController`); PDF fixes #8, #11.
- Backend contract: `.routing/services/categorias_service.md` (`categoriaId` alias, `protegida`).

## Scope

### May create or edit
- `frontendnet/Models/Categoria.cs`
- `frontendnet/Services/CategoriasClientService.cs`
- `frontendnet/Controllers/CategoriasController.cs`
- `frontendnet/Views/Categorias/**`
- `.tickets/F002-categorias-crud/changelog.md`

### Must not touch
- Everything else (in particular `Program.cs` — the client is already registered by F001 — other controllers/views, and `Views/Shared/**`).

## Steps
1. Model with DataAnnotations (`[Required]`, `[StringLength(255)]` matching backend Zod).
2. Service methods `GetAsync()`, `GetAsync(id)`, `PostAsync`, `PutAsync`, `DeleteAsync` (call `EnsureSuccessStatusCode()`).
3. Controller `[Authorize(Roles = "Administrador")]`; every action catches `HttpRequestException`: `401` → `RedirectToAction("Salir","Auth")`, `403` → `AccessDenied`, `404` → `NotFound()`, `400`/`409` → `ModelState` error + redisplay.
4. Views `Index`, `Detalle`, `Crear`, `Editar`, `Eliminar`, `_DetallePartial` with `_ValidationScriptsPartial`. When `Protegida == true`, `Eliminar` shows a warning and no delete form.

## Done when
[spec.md](spec.md) passes.
