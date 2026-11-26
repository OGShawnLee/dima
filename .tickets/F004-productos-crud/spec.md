# F004 — Verification Spec

- [ ] Build gate passes.
- [ ] Create product with cover → cover persists after reload (proves `archivoid` serialization fix).
- [ ] Edit, delete, search (`?s=%` and `?s=_` do not return everything; `?s=<script>` renders encoded).
- [ ] Add/remove category; duplicate add shows a message, not a crash.
- [ ] Price `12.5a`, `-1`, `1.234` rejected client- and server-side.
- [ ] Expired session while opening `Crear` (dropdown load) → `/Auth/Salir`.
- [ ] Usuario role → AccessDenied on `/Productos/*`.
