# F009 — Verification Spec

- [ ] Build gate passes (`-c Release --no-incremental`, 0 warnings); no `async void`; no `Html.Raw`.
- [ ] Posting `Precio=abc` on `/Productos/Crear` and `cantidad=abc` on `/Carrito/Agregar` shows Spanish messages only.
- [ ] With the backend stopped (or `UrlWebAPI` pointed at a closed port), `/Categorias`, `/Productos`, `/Comprar`, `/Usuarios` show a Spanish "service unavailable" message with no stack trace — either the controller's own in-page message (F002–F006 behaviour, `200`) or the global error page (`503`) for anything they do not catch, including timeouts — and the session stays valid once the backend is back.
- [ ] Expired/invalid JWT still → `/Auth/Salir` on every admin page (F001 behaviour unchanged).
- [ ] `GET /Archivos/Imagen/{id}`: anonymous → `public, max-age=300`; authenticated → no shared-cacheable response carrying `Set-Cookie`.
- [ ] Regression smoke: login, one CRUD per module, cart + checkout still work.
- [ ] Scope check: `git diff --name-only` ⊆ ticket scope + changelog.
