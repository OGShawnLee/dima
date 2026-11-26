# B006 — Verification Spec

Every checkbox below must pass deterministically before moving `B006` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

- [ ] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** errors.
- [ ] `npm run build` (`tsc`) exits `0`.

## 2. Automated Test Gate

- [ ] Targeted run: `npx vitest run tests/categorias.test.ts tests/productos.test.ts` exits `0`.
- [ ] Final full suite run: `npm test` (`vitest run`) exits `0` with **0 failures**.

## 3. Security & Contract Checks

- [ ] **No Mass Assignment (`DEC-006`):** `PUT /api/categorias/:id` cannot flip `protegida`; `POST`/`PUT /api/productos` only writes allowlisted columns.
- [ ] **Protected category rule:** `DELETE /api/categorias/:id` returns `404` if missing and `400` if `protegida === true`.
- [ ] **Safe `LIKE` escaping (`DEC-009`):** `escapeLikePattern` escapes `\`, `%`, and `_` for `GET /api/productos?s=`.
- [ ] **Contract parity (`DEC-010`):** `POST` returns `categoriaId` / `productoId`; `producto.precio` is JSON `number`; non-existent `archivoid` returns `400`; duplicate M:N link returns `409`.
- [ ] **RBAC:** `GET` endpoints allow `Usuario` + `Administrador`; mutating endpoints require `Administrador` (`401`/`403`).
- [ ] **Audit trail:** Exact action strings (`categoria.crear/editar/eliminar`, `producto.crear/editar/eliminar`, `productocategoria.agregar/remover` with `productId:categoriaId`) awaited.
- [ ] **OpenAPI 3.0.3 registrars:** `registerCategoriasPaths` and `registerProductosPaths` declare all 12 exact `operationId`s.
- [ ] **Zero `any` in `src/`:** 0 matches for `\bany\b` in `backendnode/src/**`.

## 4. Scope & Commit Checks

- [ ] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [ ] `.tickets/B006-categorias-and-productos/changelog.md` is written.
- [ ] Single clean English Conventional Commit (e.g., `feat(backend): implement categorias and productos services with safe search and M:N relations`) with brief body overview.
