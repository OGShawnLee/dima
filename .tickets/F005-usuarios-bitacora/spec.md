# F005 — Verification Spec

- [ ] Build gate passes.
- [ ] Admin creates a Usuario with a strong password; weak passwords (`123456`, `password`, `Abcdefgh`) blocked client- and server-side.
- [ ] Edit/delete another user works; own account shows no edit/delete; forged POST on own account surfaces backend `403`.
- [ ] Protected seeded admin cannot be edited/deleted (backend `403` shown as error).
- [ ] Duplicate email → form error.
- [ ] Bitácora lists actions with local time; failed logins visible.
- [ ] Usuario role → AccessDenied on `/Usuarios` and `/Bitacora`.
