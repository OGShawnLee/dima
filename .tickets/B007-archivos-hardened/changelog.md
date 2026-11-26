# B007 — Hardened File Storage Service Changelog

## Files Created

- `backendnode/src/schemas/archivos.schema.ts` — Zod DTOs (`ArchivoMetadataDtoSchema`, `ArchivoListResponseSchema`, `ArchivoMetadataDto`) and OpenAPI 3.0.3 path registrar `registerArchivosPaths(registry)` declaring `GetArchivos`, `DownloadArchivo` (public, `image/jpeg` binary), `GetArchivoDetalle`, `UploadArchivo`, `ReplaceArchivo`, and `DeleteArchivo`.
- `backendnode/src/middlewares/upload.middleware.ts` — `MAX_IMAGE_SIZE_BYTES` (`100 * 1024`), `isValidJpegMagicBytes`, `isAllowedJpegExtension`, `uploadImage` (`multer.memoryStorage()`, 100 KB / 1-file limit, `image/jpeg` MIME + `.jpg`/`.jpeg` extension filter), and `validateUploadedJpeg` middleware.
- `backendnode/src/services/archivos.service.ts` — `resolveSafeUploadPath` (CWE-22 containment), `DrizzleArchivosRepository`, and `ArchivosService` supporting dual storage (`FILES_IN_BD=true` `LONGBLOB` and `FILES_IN_BD=false` async `fs/promises` disk storage), UUID filenames (`<uuid>.jpg`), orphan-file cleanup on DB failure, old-file cleanup on `PUT`/`DELETE`, and `bitacora` auditing (`archivos.crear`, `archivos.editar` with real numeric `id`, `archivos.eliminar`).
- `backendnode/src/controllers/archivos.controller.ts` — Express controller handlers forwarding errors via `next(err)` and streaming `GET /api/archivos/:id` with `Content-Type: image/jpeg` and `X-Content-Type-Options: nosniff`.
- `backendnode/src/routes/archivos.routes.ts` — `createArchivosRouter(deps?)` and default `archivosRouter` enforcing `authorize('Administrador')` strictly before `uploadImage.single('file')` on `POST` and `PUT`.
- `backendnode/tests/archivos.test.ts` — Vitest + Supertest regression suite (10 tests) covering auth-before-upload, 100 KB size cap, magic-byte & MIME/extension spoofing, CWE-22 path traversal, dual-mode CRUD (`FILES_IN_BD=false` and `true`), `nosniff` streaming, audit trail, and OpenAPI registration.

## Verification

- `npx vitest run tests/archivos.test.ts`: **1 test file passed, 10 tests passed**
- `npm run typecheck` (`tsc --noEmit`): **exit 0 (0 errors)**
- `npm run build` (`tsc`): **exit 0**
- `npm test` (`vitest run`): **6 test files passed, 87 tests passed (0 failures)**

## Security Checks Verified

- `DEC-007`: `authorize('Administrador')` executes strictly before `uploadImage.single('file')` on `POST /api/archivos` and `PUT /api/archivos/:id` (`401`/`403` never touch disk).
- `DEC-007`: `multer.memoryStorage()` with `limits: { fileSize: 102400, files: 1 }` prevents >100 KB uploads and orphan disk files.
- `DEC-007`: Defense-in-depth JPEG validation (`image/jpeg` MIME, case-insensitive `.jpg`/`.jpeg` extension, and `0xFF 0xD8 0xFF` magic bytes).
- `DEC-007` / `CWE-22`: Server-generated `${crypto.randomUUID()}.jpg` filenames and `resolveSafeUploadPath` containment check.
- `DEC-007`: Public `GET /api/archivos/:id` uses async `fs/promises.readFile`, sets `Content-Type: image/jpeg` and `X-Content-Type-Options: nosniff`, and returns `404` when disk file is missing.
- `DEC-010`: `POST /api/archivos` returns canonical `ArchivoMetadataDto` (`{ archivoId, mime, indb, nombre, size }`); `PUT /api/archivos/:id` audits `archivos.editar` with the real numeric `id`.
