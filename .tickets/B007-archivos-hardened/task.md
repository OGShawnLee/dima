# B007 — Hardened File Storage Service (`/api/archivos`)

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B007` | `completed` | `Gemini 4 Hydrogen (Medium)` | `C` | `archivos` | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-007` — **`authorize('Administrador')` MUST run BEFORE `upload.single('file')`** on `POST` and `PUT` (fixing PDF p. 59 unauthenticated upload DoS).
- `DEC-007` — Multer `memoryStorage()` with `limits: { fileSize: 100 * 1024, files: 1 }` (100 KB cap, zero orphan temp files on disk when validation or DB fails).
- `DEC-007` — Defense-in-depth JPG verification: `image/jpeg` MIME + case-insensitive `.jpg`/`.jpeg` extension + **JPEG magic bytes (`0xFF 0xD8 0xFF`)**.
- `DEC-007` — Server-generated UUID filename (`${crypto.randomUUID()}.jpg`, never trusting `file.originalname`) + `path.resolve` containment check (CWE-22 path traversal defense).
- `DEC-007` — Async `fs/promises` I/O on disk mode (`FILES_IN_BD=false`) + `LONGBLOB` storage on DB mode (`FILES_IN_BD=true`); `GET /api/archivos/:id` streams `Content-Type: image/jpeg` with `X-Content-Type-Options: nosniff` and clean `404` when disk file is missing.
- `DEC-010` — `POST /api/archivos` returns canonical `ArchivoMetadataDto` (`{ archivoId, mime, indb, nombre, size }`).

## Scope

### May create or edit
- `backendnode/src/schemas/archivos.schema.ts`
- `backendnode/src/middlewares/upload.middleware.ts`
- `backendnode/src/services/archivos.service.ts`
- `backendnode/src/controllers/archivos.controller.ts`
- `backendnode/src/routes/archivos.routes.ts`
- `backendnode/tests/archivos.test.ts`
- `.tickets/B007-archivos-hardened/changelog.md`

### Must not touch
- `backendnode/src/app.ts`, `backendnode/src/index.ts`, `backendnode/src/db/**`, `backendnode/package.json`
- Any `auth`, `bitacora`, `roles`, `usuarios`, `categorias`, or `productos` files
- `.routing/**`, `.gemini/**`, `frontendnet/**`
- Any other `.tickets/**` folder, or `B007`'s `task.md`, `spec.md`, `audit.md`

## Inputs

Read these files first before writing code:
1. [.routing/CONTEXT.md](../../.routing/CONTEXT.md)
2. [.routing/DECISION.md](../../.routing/DECISION.md) (`DEC-007`, `DEC-010`)
3. [.routing/SERVICES.md](../../.routing/SERVICES.md)
4. [.routing/services/archivos_service.md](../../.routing/services/archivos_service.md)
5. Existing foundation/auth files: `backendnode/src/config/env.ts`, `backendnode/src/schemas/common.schema.ts`, `backendnode/src/utils/httpError.ts`, `backendnode/src/middlewares/auth.middleware.ts`, `backendnode/src/middlewares/validate.middleware.ts`, `backendnode/src/services/bitacora.service.ts`, `backendnode/src/db/schema.ts`

## Task

1. Create `backendnode/src/schemas/archivos.schema.ts` exporting `ArchivoMetadataDtoSchema`, `ArchivoListResponseSchema`, `ArchivoMetadataDto`, and `registerArchivosPaths(registry)` declaring all 6 exact `operationId`s (`GetArchivos`, `DownloadArchivo` public with `image/jpeg` binary response, `GetArchivoDetalle`, `UploadArchivo` with `multipart/form-data` binary `file`, `ReplaceArchivo` with `multipart/form-data` binary `file`, `DeleteArchivo`, with `bearerAuth` on all except `DownloadArchivo`).
2. Create `backendnode/src/middlewares/upload.middleware.ts` exporting:
   - `MAX_IMAGE_SIZE_BYTES = 100 * 1024`
   - `isValidJpegMagicBytes(buffer: Buffer): boolean` — returns `true` iff `buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff`.
   - `isAllowedJpegExtension(filename: string): boolean` — case-insensitive `.jpg` or `.jpeg`.
   - `uploadImage`: `multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 }, fileFilter })` checking `file.mimetype === 'image/jpeg'` and `isAllowedJpegExtension(file.originalname)` (rejecting others with `badRequest('Solo se permiten imágenes con extensión JPG.')`).
   - `validateUploadedJpeg` middleware (runs immediately after `uploadImage.single('file')`): rejects missing `req.file` with `badRequest('El archivo es obligatorio.')` and rejects invalid magic bytes (`!isValidJpegMagicBytes(req.file.buffer)`) with `badRequest('Solo se permiten imágenes con extensión JPG.')`.
3. Create `backendnode/src/services/archivos.service.ts` exporting:
   - `resolveSafeUploadPath(uploadsDir: string, filename: string): string` — rejects filenames containing path separators or `..`, resolves `path.resolve(uploadsDir, filename)`, and asserts it starts with `path.resolve(uploadsDir) + path.sep` (throws `badRequest` / `Error` on traversal attempt).
   - `ArchivosService` implementing `IArchivosService` with injectable repository/DB, `IBitacoraService`, `uploadsDir` (default `path.resolve(process.cwd(), 'uploads')`), and `filesInDb` getter (default `() => env.FILES_IN_BD`):
     - `getAll()` / `getDetalle(id)`: return metadata `{ archivoId, mime, indb, nombre, size }` (never select `datos` `LONGBLOB` in metadata queries!).
     - `getBinary(id)`: if `indb === true`, return `datos` buffer (`null` if missing); if `indb === false`, resolve via `resolveSafeUploadPath` and read with async `fs.promises.readFile` (return `null` cleanly on `ENOENT` so controller returns `404`).
     - `create(file, audit)`: verify `isValidJpegMagicBytes(file.buffer)` (defense in depth even when service called directly); generate `nombre = `${crypto.randomUUID()}.jpg``; if `filesInDb` → insert with `indb: true, datos: file.buffer`; else write buffer via `fs.promises.writeFile` to safe path, insert with `indb: false, datos: null` (unlink written file in `catch` if DB insert fails!); `await bitacora.registrar({ accion: 'archivos.crear', elementoid: id, ... })`; return `ArchivoMetadataDto` (`{ archivoId, mime: 'image/jpeg', indb, nombre, size }`).
     - `update(id, file, audit)`: verify record exists first (`404` if missing — never write disk before verifying!); verify magic bytes; generate new UUID filename; write new file (if `!filesInDb`) then update DB row (cleanup new file if DB fails); `await bitacora.registrar({ accion: 'archivos.editar', elementoid: id, ... })` (fixing PDF's `data.id === undefined` bug!); delete old disk file safely (ignore `ENOENT`) only if `!existing.indb` and after DB update succeeds.
     - `delete(id, audit)`: verify record exists (`404`); delete DB row; `await bitacora.registrar({ accion: 'archivos.eliminar', elementoid: id, ... })`; if `!existing.indb`, unlink disk file via `resolveSafeUploadPath` (ignore `ENOENT`).
4. Create `backendnode/src/controllers/archivos.controller.ts` (all handlers `try/catch` → `next(err)`; `getBinary` sets `Content-Type: image/jpeg` and `X-Content-Type-Options: nosniff` and sends raw buffer) and `backendnode/src/routes/archivos.routes.ts` (`createArchivosRouter(deps?)` + default router):
   - `GET /` → `[authorize('Administrador'), controller.getAll]`
   - `GET /:id/detalle` → `[authorize('Administrador'), validate({ params: NumericIdParamSchema }), controller.getDetalle]`
   - `GET /:id` → `[validate({ params: NumericIdParamSchema }), controller.getBinary]` (**Public**, registered after `/:id/detalle` or cleanly distinct)
   - `POST /` → **`[authorize('Administrador'), uploadImage.single('file'), validateUploadedJpeg, controller.create]`** (`authorize` strictly FIRST!)
   - `PUT /:id` → **`[authorize('Administrador'), validate({ params: NumericIdParamSchema }), uploadImage.single('file'), validateUploadedJpeg, controller.update]`** (`authorize` strictly FIRST!)
   - `DELETE /:id` → `[authorize('Administrador'), validate({ params: NumericIdParamSchema }), controller.delete]`
5. Create `backendnode/tests/archivos.test.ts` using Vitest + Supertest + temp `uploads` dir testing:
   - **Middleware order (`DEC-007`):** Unauthenticated (`401`) and `Usuario` (`403`) `POST /api/archivos` & `PUT /api/archivos/:id` are rejected BEFORE upload executes (zero files written to temp `uploadsDir`).
   - **Size cap (`DEC-007`):** `> 100 KB` JPEG rejected with `400`.
   - **Magic bytes & MIME spoofing (`DEC-007`):** HTML/JS payload renamed to `evil.jpg` with `Content-Type: image/jpeg` rejected with `400`; genuine JPEG magic bytes (`FF D8 FF ...`) accepted with `201` returning canonical `{ archivoId, mime: 'image/jpeg', indb, nombre, size }` with UUID filename (NOT client `../../evil.jpg`).
   - **Path traversal (`CWE-22`):** `resolveSafeUploadPath(dir, '../secret.txt')` and `'..\\secret.txt'` throw.
   - **Dual storage modes:** Both `FILES_IN_BD=false` (disk write, `GET /:id` streams bytes with `Content-Type: image/jpeg` + `X-Content-Type-Options: nosniff`, `PUT` replaces and unlinks old disk file, `DELETE` unlinks disk file, missing disk file → `404`) and `FILES_IN_BD=true` (stores `Buffer` in `datos`, writes zero files to disk, `GET /:id` streams from `datos`).
   - **Audit trail:** Exact `archivos.crear`, `archivos.editar` (with real numeric `id`, not `undefined`!), and `archivos.eliminar` actions awaited.
   - **OpenAPI registration:** `registerArchivosPaths` registers all 6 exact `operationId`s.
6. Run `npx vitest run tests/archivos.test.ts` while iterating, then run full gates once before committing: `npm run typecheck`, `npm run build`, and `npm test`.

## Verification

Follow every check in [spec.md](spec.md).

## Change log

Write `.tickets/B007-archivos-hardened/changelog.md` listing files touched, verification commands/results, and security checks verified.
