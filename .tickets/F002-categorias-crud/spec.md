# F002 — Verification Spec

- [ ] Build gate from `frontendnet/.routing/CONTEXT.md` passes.
- [ ] Admin can list, view, create, edit and delete a category; the list reflects changes.
- [ ] Empty name blocked client-side **and** server-side (disable JS and retry → validation message, no API call crash).
- [ ] Protected category: no delete form; a forged `POST /Categorias/Eliminar/{id}` shows the backend `403` as an error, not a crash.
- [ ] Usuario role gets AccessDenied on `/Categorias`.
- [ ] Expired JWT on any action redirects to `/Auth/Salir`.
- [ ] All POST actions reject requests without antiforgery token.
- [ ] Category names containing `<script>` render encoded.
