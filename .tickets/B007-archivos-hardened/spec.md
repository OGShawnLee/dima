# B007 — Verification Spec

Every checkbox below must pass deterministically before moving `B007` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

- [ ] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** errors.
- [ ] `npm run build` (`tsc`) exits `0`.

## 2. Automated Test Gate

- [ ] Targeted run: `npx vitest run tests/archivos.test.ts` exits `0`.
- [ ] Final full suite run: `npm test` (`vitest run`) exits `0` with **0 failures**.

## 3. Security & Contract Checks (`DEC-007`, `DEC-010`)

- [ ] **Auth before upload:** `authorize('Administrador')` runs strictly before `uploadImage.single('file')` on `POST` and `PUT`; unauthenticated (`401`) and `Usuario` (`403`) requests never write files.
- [ ] **100 KB cap & `memoryStorage`:** Files > `102400` bytes rejected with `400`; no orphan disk files left on validation or DB error.
- [ ] **Magic-byte inspection:** Spoofed `.jpg` with `image/jpeg` MIME lacking `0xFF 0xD8 0xFF` rejected with `400`.
- [ ] **UUID filenames & path traversal protection (CWE-22):** Client `originalname` is never used on disk; `resolveSafeUploadPath` blocks `..` and separators.
- [ ] **Safe binary delivery:** `GET /api/archivos/:id` is public, sets `Content-Type: image/jpeg` and `X-Content-Type-Options: nosniff`, uses async `fs/promises`, and returns `404` if disk file is missing.
- [ ] **Dual mode (`FILES_IN_BD`):** Both disk (`false`) and `LONGBLOB` (`true`) modes tested end-to-end including old-file cleanup on `PUT`/`DELETE`.
- [ ] **Canonical `201` DTO & audit fix:** `POST` returns `{ archivoId, mime, indb, nombre, size }`; `PUT` audits `archivos.editar` with the real numeric `id`.
- [ ] **OpenAPI 3.0.3 registrar:** `registerArchivosPaths` declares all 6 exact `operationId`s (`GetArchivos`, `DownloadArchivo`, `GetArchivoDetalle`, `UploadArchivo`, `ReplaceArchivo`, `DeleteArchivo`).
- [ ] **Zero `any` in `src/`:** 0 matches for `\bany\b` in `backendnode/src/**`.

## 4. Scope & Commit Checks

- [ ] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [ ] `.tickets/B007-archivos-hardened/changelog.md` is written.
- [ ] Single clean English Conventional Commit (e.g., `feat(backend): implement hardened archivos service with magic-byte and dual-mode storage`) with brief body overview.
