# Archivos Service (`archivos`)

- **Base Route:** `/api/archivos`
- **Owned Files:**
  - `src/services/archivos.service.ts`
  - `src/middlewares/upload.middleware.ts`
  - `src/schemas/archivos.schema.ts`
  - `src/controllers/archivos.controller.ts`
  - `src/routes/archivos.routes.ts`
- **Dependencies:** Logs via `IBitacoraService` ([bitacora_service.md](bitacora_service.md)); referenced by `producto.archivoid` ([productos_service.md](productos_service.md)).

---

## 1. SQL Schema Entities

### Table: `archivo`

| Column | MySQL / Drizzle Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `int('id').autoincrement().primaryKey()` | PK, Auto-Increment, NOT NULL |
| `mime` | `varchar('mime', { length: 255 }).notNull()` | NOT NULL (`'image/jpeg'`) |
| `nombre` | `varchar('nombre', { length: 255 }).notNull()` | NOT NULL (server-generated UUID filename `<uuid>.jpg`) |
| `size` | `int('size').notNull()` | NOT NULL (bytes, `<= 102400`) |
| `indb` | `boolean('indb').notNull().default(true)` | NOT NULL, Default: `true` |
| `datos` | `customType<{ data: Buffer }>({ dataType: () => 'longblob' })('datos')` | NULLABLE (`LONGBLOB`, populated when `indb === true`) |
| `createdAt` | `datetime('createdAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL |
| `updatedAt` | `datetime('updatedAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL (on update) |

---

## 2. Zod Mappings (`src/schemas/archivos.schema.ts`)

```ts
import { z } from 'zod';

export const ArchivoMetadataDtoSchema = z.object({
  archivoId: z.number().int().positive(),
  mime: z.literal('image/jpeg'),
  indb: z.boolean(),
  nombre: z.string(),
  size: z.number().int().positive(),
}).openapi('ArchivoMetadataDto');

export const ArchivoListResponseSchema = z
  .array(ArchivoMetadataDtoSchema)
  .openapi('ArchivoListResponse');

export type ArchivoMetadataDto = z.infer<typeof ArchivoMetadataDtoSchema>;
```

> **Contract Standardization Note:** `POST /api/archivos` returns `ArchivoMetadataDto` (`{ archivoId, mime, indb, nombre, size }`) instead of the legacy PDF's `{ id, mime, indb, nombre }`, unifying metadata DTOs across `GET` and `POST`.

---

## 3. API Endpoints

| Method | Path | `operationId` | Roles | Request | Response | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/archivos` | `GetArchivos` | `Administrador` | None | `200` `ArchivoMetadataDto[]` \| `401` \| `403` | None |
| `GET` | `/api/archivos/:id` | `DownloadArchivo` | **Public** | Param `id` | `200` `image/jpeg` binary (`nosniff`) \| `400` \| `404` | None |
| `GET` | `/api/archivos/:id/detalle` | `GetArchivoDetalle` | `Administrador` | Param `id` | `200` `ArchivoMetadataDto` \| `400` \| `401` \| `403` \| `404` | None |
| `POST` | `/api/archivos` | `UploadArchivo` | `Administrador` | `multipart/form-data` (`file`) | `201` `ArchivoMetadataDto` \| `400` \| `401` \| `403` | `archivos.crear` (`id`) |
| `PUT` | `/api/archivos/:id` | `ReplaceArchivo` | `Administrador` | Param `id` + `multipart/form-data` (`file`) | `204` \| `400` \| `401` \| `403` \| `404` | `archivos.editar` (`id`) |
| `DELETE` | `/api/archivos/:id` | `DeleteArchivo` | `Administrador` | Param `id` | `204` \| `400` \| `401` \| `403` \| `404` | `archivos.eliminar` (`id`) |

### Security & Business Rules
1. **Middleware order (CRITICAL):** On `POST` and `PUT`, `authorize('Administrador')` **must** execute before `upload.single('file')`.
2. **Upload limits & memory-first buffering:** Configure Multer with `memoryStorage()` and `limits: { fileSize: 100 * 1024, files: 1 }`. Validating in memory before writing avoids orphan files on disk when validation or DB writes fail.
3. **Strict JPG validation (defense in depth):**
   - `file.mimetype === 'image/jpeg'`
   - `.jpg` or `.jpeg` extension (case-insensitive)
   - **Magic bytes check:** First 3 bytes of buffer **must** equal `0xFF 0xD8 0xFF`. Reject mismatches with `400` (`"Solo se permiten imágenes con extensión JPG."`).
4. **Safe filename & path traversal prevention:** Always generate `nombre = `${crypto.randomUUID()}.jpg``—never use `file.originalname` on disk. On disk reads/unlinks, verify `path.resolve(uploadsDir, nombre)` starts with `path.resolve(uploadsDir) + path.sep`.
5. **Dual storage mode (`env.FILES_IN_BD`):**
   - `true`: store `buffer` in `archivo.datos`, `indb: true`, write nothing to `uploads/`.
   - `false`: write `buffer` asynchronously (`fs/promises.writeFile`) to `uploads/<nombre>`, `datos: null`, `indb: false`. On `PUT`/`DELETE`, delete previous disk file only after DB mutation succeeds (and clean up new file if DB fails).
6. **Safe binary delivery (`GET /api/archivos/:id`):** Set `Content-Type: image/jpeg` and `X-Content-Type-Options: nosniff`; use async `fs/promises.readFile` and return `404` cleanly if disk file is missing.

---

## 4. TypeScript Interface

```ts
import type { AuditContext } from '../schemas/common.schema';
import type { ArchivoMetadataDto } from '../schemas/archivos.schema';

export interface UploadedImageInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface ArchivoBinaryResult {
  mime: 'image/jpeg';
  buffer: Buffer;
}

export interface IArchivosService {
  getAll(): Promise<ArchivoMetadataDto[]>;
  getDetalle(id: number): Promise<ArchivoMetadataDto | null>;
  getBinary(id: number): Promise<ArchivoBinaryResult | null>;
  create(file: UploadedImageInput, audit: AuditContext): Promise<ArchivoMetadataDto>;
  update(id: number, file: UploadedImageInput, audit: AuditContext): Promise<void>;
  delete(id: number, audit: AuditContext): Promise<void>;
}
```
