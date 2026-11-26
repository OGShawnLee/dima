# F003 — Verification Spec

- [ ] Build gate passes.
- [ ] Admin uploads a real JPEG ≤ 100 KB; it appears in the list and in `Detalle` via `/Archivos/Imagen/{id}`.
- [ ] Rejected with a form error (no crash): 150 KB JPEG, `.png` renamed to `.jpg`, `.html` renamed to `.jpg`, empty file.
- [ ] Edit replaces the image; delete removes it.
- [ ] `/Archivos/Imagen/{id}` works anonymously, returns `image/jpeg` + `nosniff`; unknown id → `404`; `id=-1` or `id=abc` → `400/404`, never `500`.
- [ ] `grep -rn "PublicUrlWebAPI\|:3000" frontendnet/Views` returns nothing.
- [ ] Usuario role → AccessDenied on `/Archivos`.
