# F004 — Productos CRUD & Category Assignment (M:N)

| ID | Status | Model | Lane | Spec |
| :--- | :--- | :--- | :--- | :--- |
| `F004` | `draft` | Strong coding model | Front | [spec.md](spec.md) |

## Items addressed
- FRONTEND-API-SPEC §5 (`Producto`, `ProductoCategoria`), §7 (`ProductosClientService`), §8 (`ProductosController`), §9 (`producto_portada.js`); PDF fixes #2 (`[JsonPropertyName("archivoid")]`), #8, #9 (escaped price regex), #10, #11.
- Backend contract: `.routing/services/productos_service.md` (`productoId`, `precio` as number, `?s=` search, `POST /{id}/categoria`, `DELETE /{id}/categoria/{categoriaid}`).

## Scope

### May create or edit
- `frontendnet/Models/Producto.cs`, `Models/ProductoCategoria.cs`
- `frontendnet/Services/ProductosClientService.cs`
- `frontendnet/Controllers/ProductosController.cs`
- `frontendnet/Views/Productos/**`
- `frontendnet/wwwroot/js/producto_portada.js`
- `.tickets/F004-productos-crud/changelog.md`

### Must not touch
- `Program.cs`, `Views/Shared/**`, `Services/ArchivosClientService.cs`, `Services/CategoriasClientService.cs` (consume them, do not edit).

## Steps
1. Admin CRUD with searchable table (`?s=` passed through `Uri.EscapeDataString`).
2. Cover dropdown from `ArchivosClientService.GetAsync()`; preview uses `/Archivos/Imagen/{id}` (`data-url` points to the BFF, not the API).
3. Category add/remove screens (`Categorias`, `CategoriasAgregar`, `CategoriasRemover`) mapping `409` (duplicate link) to a friendly message.
4. Dropdown loaders wrapped in `try/catch (HttpRequestException)` → `401` → `/Auth/Salir`.
5. Price: `[Range(0.01, 9999999)]` + regex `^\d+(\.\d{1,2})?$`.

## Done when
[spec.md](spec.md) passes.
