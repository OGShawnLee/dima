# F007 — Verification Spec

- [ ] Build gate passes.
- [ ] Anonymous user registers with a strong password, is logged in as `Usuario`, and lands on `/Comprar`.
- [ ] Weak password, mismatched confirmation, bad email blocked client- and server-side.
- [ ] A forged registration body with `"rol":"Administrador"` still creates a `Usuario` (verify in `/Usuarios` as admin).
- [ ] Usuario checks out a cart → order appears in `/Pedidos/Mios` and in admin `/Pedidos` with backend-computed total.
- [ ] Tampering: changing a price in devtools has no effect on the order total.
- [ ] Usuario cannot open another user's `/Pedidos/Detalle/{id}` (backend `403/404` shown as AccessDenied/NotFound).
- [ ] Usuario → AccessDenied on admin `/Pedidos`.
