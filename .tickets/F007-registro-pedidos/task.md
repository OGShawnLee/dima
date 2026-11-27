# F007 — Self-Registration, Checkout & Orders

| ID | Status | Model | Lane | Spec |
| :--- | :--- | :--- | :--- | :--- |
| `F007` | `dispatched` | Strong coding model | Front | [spec.md](spec.md) |

## Items addressed
- Project brief modules: "Crear cuenta para comprar", "Carrito de compra" (checkout), "Pedidos recibidos (admin)".
- [FDEC-004](../../frontendnet/.routing/DECISION.md#fdec-004).

## Requested backend contract (to be confirmed in `.routing/FRONT-HANDOFF.md`)
| Method | Path | Role | Body / Result |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/registro` | public, rate-limited | `{ email, nombre, password }` → `201 { id, email, nombre, rol: "Usuario" }`; `400` (`detalles`), `409` duplicate, `429` |
| `POST` | `/api/pedidos` | `Usuario` | `{ items: [{ productoId, cantidad }] }` → `201 { pedidoId, total, fecha, estado }` |
| `GET` | `/api/pedidos/mios` | `Usuario` | `[{ pedidoId, total, fecha, estado, itemCount }]` |
| `GET` | `/api/pedidos` | `Administrador` | `[{ pedidoId, usuarioEmail, usuarioNombre, total, fecha, estado, itemCount }]` |
| `GET` | `/api/pedidos/{id}` | owner or `Administrador` | order + lines (`titulo`, `precioUnitario`, `cantidad`) |

If the final contract differs, follow the backend (`/openapi.json`) and update this table.

## Scope

### May create or edit
- `frontendnet/Models/Registro.cs`, `Models/Pedido.cs`, `Models/PedidoDetalle.cs`
- `frontendnet/Services/PedidosClientService.cs`, `Services/AuthClientService.cs` (add `RegistrarAsync` only)
- `frontendnet/Controllers/RegistroController.cs`, `Controllers/PedidosController.cs`
- `frontendnet/Views/Registro/**`, `frontendnet/Views/Pedidos/**`
- `frontendnet/Views/Carrito/Index.cshtml` (enable the `Confirmar compra` form only)
- `.tickets/F007-registro-pedidos/changelog.md`

### Must not touch
- `Program.cs`, `Views/Shared/**`, other controllers.

## Steps
1. `/Registro` (anonymous): email, nombre, password + confirmation with `PasswordPolicyAttribute` (from F005) and `[Compare]`. On `201`, sign in by calling `ObtenTokenAsync` and redirect to `/Comprar`. Generic message on `409` to limit enumeration ("No fue posible crear la cuenta").
2. `POST /Pedidos/Confirmar` (Usuario): send cart ids + quantities; on `201` clear the session cart and show the order with backend totals.
3. `/Pedidos/Mios` (Usuario) and `/Pedidos` + `/Pedidos/Detalle/{id}` (Administrador).
4. Map `400` (unknown product / bad quantity) back to `/Carrito` with a message.

## Done when
[spec.md](spec.md) passes.
