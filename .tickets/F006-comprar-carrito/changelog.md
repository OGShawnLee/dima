# F006 — Changelog

## Files touched (all new, all inside ticket scope)

- `frontendnet/Models/CarritoItem.cs` — session line `{ productoId, cantidad }` (shape of the future `POST api/pedidos` item; limits 1..99).
- `frontendnet/Models/CarritoViewModel.cs` — `CarritoLinea` (product re-read from the backend + quantity, display-only subtotal) and `CarritoViewModel` (lines, notices, total, `PreciosNoDisponibles`).
- `frontendnet/Services/CarritoSessionService.cs` — plain class (`new CarritoSessionService(HttpContext.Session)`, not DI-registered). Stores only the JSON list under session key `Carrito`; defensively merges duplicates and caps to 50 lines / 99 units on read; every mutation syncs `CarritoCantidad`.
- `frontendnet/Controllers/ComprarController.cs` — `GET /Comprar?s=` (`Usuario,Administrador`), same search/error conventions as F004.
- `frontendnet/Controllers/CarritoController.cs` — `GET /Carrito`, `POST Agregar|Actualizar|Quitar|Vaciar` (`Usuario` only, global antiforgery filter).
- `frontendnet/Views/Comprar/Index.cshtml` — 4-column card grid, search, category badges, quantity + "Agregar" form (Usuario only; Administrador sees a read-only notice).
- `frontendnet/Views/Carrito/Index.cshtml`, `_MensajesPartial.cshtml`, `_PortadaPartial.cshtml` — cart table, update/remove/empty forms, informative total, disabled `Confirmar compra` (posts to `/Pedidos/Confirmar`, badge "Próximamente" until F007).

## Design notes

- **Badge semantics:** `CarritoCantidad` = **total units** (sum of `cantidad`), matching the layout comment "item count" shown next to the cart icon. Distinct lines are shown on `/Carrito` as "Mostrando N elementos".
- **No product data client-side:** session holds ids + quantities only. Flash messages travel in the TempData cookie, so they never include product titles/prices (generic texts such as "Producto agregado al carrito.").
- **Forged ids:** `Agregar` verifies the product with `GET api/productos/{id}`; `404`/`400` → ignored with "El producto seleccionado ya no existe; no se agregó al carrito.". On `/Carrito`, products answering `404`/`400` are dropped from the session with a Spanish notice; `401` → `/Auth/Salir`, `403` → `/Home/AccessDenied`; any other failure (backend down) keeps the cart intact and shows an error.
- **Merge limit:** adding to an existing line beyond 99 units is rejected (backend merges duplicates with the same `<= 99` rule). Max 50 distinct lines (backend `items.max(50)`).
- **Images:** `Url.Action("Imagen","Archivos", new { id, v = id })`. The usual `?v={nombre}` cache-buster needs `GET api/archivos` (Administrador only), so the archivo id is used as `v` on Usuario pages. (All 15 seeded products currently have no cover, so the `placehold.co` fallback is what renders.)
- No inline scripts/styles/handlers (CSP); no `Html.Raw`; `ProductosClientService` consumed read-only (unchanged).

## Gates

1. `dotnet build frontendnet/frontendnet.csproj -c Release --no-incremental` → `Build succeeded. 0 Warning(s) 0 Error(s)`, exit 0.
2. `grep -rn "async void" frontendnet --include='*.cs'` → no output.
3. Antiforgery: the 4 `[HttpPost]` actions in `CarritoController` are covered by the global `AutoValidateAntiforgeryTokenAttribute` (`Program.cs:16`); no `IgnoreAntiforgeryToken` anywhere. Live: POST without token → `400` for Agregar, Actualizar, Quitar, Vaciar.
4. `grep -rn "Html.Raw" frontendnet/Views` → no output.
5. Manual smoke on `https://localhost:8444` against the shared backend `http://localhost:3000` (curl + cookie jars; see below).
6. `git status --porcelain` → only the new files listed above + this changelog.

## Spec checks

| Check | Result | Evidence |
| :--- | :--- | :--- |
| Build gate passes | **PASS** | Gate 1 above. |
| Usuario browses `/Comprar`, searches, adds items; badge updates; `/Carrito` lists items with current prices | **PASS** | `patito@uv.mx`: `GET /Comprar` 200 with 15 cards; `?s=Smart` → "Resultados para «Smart»: 2" (Smart TV, Smartphone). Agregar id 1 ×2 → 302 `/Comprar?s=Smart`, "Producto agregado al carrito.", badge `0→2`; id 2 ×3 → badge `5`. `/Carrito`: "Mostrando 2 elementos", Smart TV `$12,999.00` × 2 = `$25,998.00`, Smartphone `$8,499.00` × 3 = `$25,497.00` (prices from `GET api/productos/{id}`). Actualizar id 2 → 7: badge `9`; Quitar id 2: badge `2`; Vaciar: "Se vació el carrito.", badge `0`. |
| Quantity `0`, `-1`, `1000`, `abc` rejected | **PASS** | Agregar and Actualizar with each value (and empty) → 302 + "La cantidad debe ser un número entero entre 1 y 99."; badge unchanged. 98 more units on a line already holding 2 → "No puede tener más de 99 unidades del mismo producto en el carrito." `productoId=abc` → "El producto seleccionado no es válido." |
| Forged `productoId` that does not exist is ignored with a message | **PASS** | `productoId=999999` → "El producto seleccionado ya no existe; no se agregó al carrito.", cart unchanged. Stale-product drop: admin created temporary product 18 ("F006 temporal smoke", not seeded), Usuario added it (11 lines, 52 units), admin deleted it; next `/Carrito` → "Un producto de su carrito ya no está disponible y fue retirado.", 10 lines, badge `52→50`. Re-adding id 18 → "ya no existe" message. Seeded data untouched. |
| Cart survives a backend restart | **NOT VERIFIED** | Not run: the shared backend must not be restarted by workers (router to run it). By design the cart lives only in the BFF's in-memory session (`AddDistributedMemoryCache`) and is never sent to the backend, so a backend restart cannot clear it; the next `/Carrito` render simply re-reads prices. (Note: a **BFF** restart does clear it — observed when the BFF was restarted mid-smoke; this is the expected in-memory session behaviour.) |
| Cart is per user session (second browser = empty cart) | **PASS** | Jar 1 had 2 lines (badge `2`). Jar 2, same account `patito@uv.mx` logged in separately → badge `0`, `/Carrito` "Mostrando 0 elementos … Su carrito está vacío."; jar 1 still badge `2`. |
| Cookie contains no product/price data (only the opaque session id) | **PASS** | Cookies in the Usuario jar: `.frontendnet.session` 190 chars, `.frontendnet` 1243 chars (auth), `.frontendnet.af` 155 chars (antiforgery). Session cookie stays opaque and does not grow with the cart (182 chars with 10 lines / 50 units). grep of cookie values for `smart|laptop|12999|productoId|cantidad` → 0 matches. TempData flashes are generic (no titles/prices). |
| All cart POSTs require antiforgery token | **PASS** | No-token POSTs → `400` for all four actions; cart unchanged. |
| Anonymous user redirected to `/Auth` | **PASS** | Anonymous `GET /Comprar` → 302 `/Auth?ReturnUrl=%2FComprar`; `GET /Carrito` → 302 `/Auth?ReturnUrl=%2FCarrito`; `POST /Carrito/Agregar` (with valid token) → 302 `/Auth?ReturnUrl=%2FCarrito%2FAgregar`. |

### Extra checks

- `/Auth/Salir` clears the cart: **PASS** — cart with 3 units → Salir 302 → re-login → badge `0`, "Mostrando 0 elementos".
- Administrador (`gvera@uv.mx`): `GET /Comprar` 200, 0 Agregar forms, notice "Vista de catálogo: solo las cuentas de cliente…"; `GET /Carrito` → 302 `/Home/AccessDenied`; `POST /Carrito/Agregar` → 302 `/Home/AccessDenied`.
- `Confirmar compra` renders disabled with "Próximamente", form `action="/Pedidos/Confirmar"` with exactly one antiforgery token (form tag helper). `PedidosController` not created.
- 50-distinct-line limit: code path only (cannot be reached live — only ~15 products exist and `Agregar` verifies each id).
- Logins used fake `X-Forwarded-For` 198.51.100.61–65. Frontend run only on `https://localhost:8444`; process stopped afterwards (port 8444 free).
