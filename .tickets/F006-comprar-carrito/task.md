# F006 — Comprar Catalog & Session Cart

| ID | Status | Model | Lane | Spec |
| :--- | :--- | :--- | :--- | :--- |
| `F006` | `implemented` | Strong coding model | Front | [spec.md](spec.md) |

## Items addressed
- FRONTEND-API-SPEC §8 (`ComprarController`, `CarritoController`), PDF fix #6 (correct controller filenames).
- [FDEC-004](../../frontendnet/.routing/DECISION.md#fdec-004) session cart.

## Scope

### May create or edit
- `frontendnet/Models/CarritoItem.cs`, `Models/CarritoViewModel.cs`
- `frontendnet/Services/CarritoSessionService.cs` (plain class, not DI-registered: the controller creates it with `new CarritoSessionService(HttpContext.Session)`, so `Program.cs` stays untouched)
- `frontendnet/Controllers/ComprarController.cs`, `Controllers/CarritoController.cs`
- `frontendnet/Views/Comprar/**`, `frontendnet/Views/Carrito/**`
- `.tickets/F006-comprar-carrito/changelog.md`

### Must not touch
- `Views/Shared/**`, other controllers/views, other services.

## Steps
1. `/Comprar` (`Usuario`, `Administrador` may browse): card grid, search `?s=`, category badges, images via `/Archivos/Imagen/{id}`.
2. `POST /Carrito/Agregar` (`productoId`, `cantidad` 1–99), `POST /Carrito/Actualizar`, `POST /Carrito/Quitar`, `POST /Carrito/Vaciar` — all antiforgery-protected, Usuario role.
3. Session stores only `List<CarritoItem { int ProductoId; int Cantidad }>` as JSON; max 50 distinct items. Prices/titles are re-read from `GET api/productos/{id}` when rendering `/Carrito` (never stored client-side); missing products are dropped with a notice.
4. `/Carrito` shows lines, subtotal (display only) and a `Confirmar compra` button that posts to `/Pedidos/Confirmar` (implemented in F007; until then show "Próximamente").

## Done when
[spec.md](spec.md) passes.
