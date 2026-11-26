# F006 — Verification Spec

- [ ] Build gate passes.
- [ ] Usuario browses `/Comprar`, searches, adds items; cart badge updates; `/Carrito` lists items with current prices.
- [ ] Quantity `0`, `-1`, `1000`, `abc` rejected; forged `productoId` that does not exist is ignored with a message.
- [ ] Cart survives a backend restart; cart is per user session (second browser = empty cart).
- [ ] Cookie contains no product/price data (only the opaque session id).
- [ ] All cart POSTs require antiforgery token; anonymous user redirected to `/Auth`.
