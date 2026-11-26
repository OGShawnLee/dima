# Categorías Service (`categorias`)

- **Base Route:** `/api/categorias`
- **Owned Files:**
  - `src/services/categorias.service.ts`
  - `src/schemas/categorias.schema.ts`
  - `src/controllers/categorias.controller.ts`
  - `src/routes/categorias.routes.ts`
- **Dependencies:** Logs via `IBitacoraService` ([bitacora_service.md](bitacora_service.md)); referenced by `productos` ([productos_service.md](productos_service.md)).

---

## 1. SQL Schema Entities

### Table: `categoria`

| Column | MySQL / Drizzle Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `int('id').autoincrement().primaryKey()` | PK, Auto-Increment, NOT NULL |
| `nombre` | `varchar('nombre', { length: 255 }).notNull()` | NOT NULL |
| `protegida` | `boolean('protegida').notNull().default(false)` | NOT NULL, Default: `false` |
| `createdAt` | `datetime('createdAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL |
| `updatedAt` | `datetime('updatedAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL (on update) |

**Seeded Values:** 15 protected categories (`id: 1..15`, `protegida: true`), from `Televisores` through `Supermercado`.

---

## 2. Zod Mappings (`src/schemas/categorias.schema.ts`)

```ts
import { z } from 'zod';

export const CategoriaDtoSchema = z.object({
  categoriaId: z.number().int().positive(),
  nombre: z.string(),
  protegida: z.boolean(),
}).openapi('CategoriaDto');

export const CreateCategoriaRequestSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
}).openapi('CreateCategoriaRequest');

export const UpdateCategoriaRequestSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
}).openapi('UpdateCategoriaRequest');

export type CategoriaDto = z.infer<typeof CategoriaDtoSchema>;
export type CreateCategoriaRequest = z.infer<typeof CreateCategoriaRequestSchema>;
export type UpdateCategoriaRequest = z.infer<typeof UpdateCategoriaRequestSchema>;
```

> **Contract Standardization Note:** `POST /api/categorias` returns `CategoriaDto` (`{ categoriaId, nombre, protegida }`), matching `GET` responses instead of raw Drizzle `id`.

---

## 3. API Endpoints

| Method | Path | `operationId` | Roles | Request | Response | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/categorias` | `GetCategorias` | `Usuario`, `Administrador` | None | `200` `CategoriaDto[]` \| `401` \| `403` | None |
| `GET` | `/api/categorias/:id` | `GetCategoriaById` | `Usuario`, `Administrador` | Param `id` (int) | `200` `CategoriaDto` \| `400` \| `401` \| `403` \| `404` | None |
| `POST` | `/api/categorias` | `CreateCategoria` | `Administrador` | `CreateCategoriaRequest` | `201` `CategoriaDto` \| `400` \| `401` \| `403` | `categoria.crear` (`id`) |
| `PUT` | `/api/categorias/:id` | `UpdateCategoria` | `Administrador` | Param `id` + `UpdateCategoriaRequest` | `204` \| `400` \| `401` \| `403` \| `404` | `categoria.editar` (`id`) |
| `DELETE` | `/api/categorias/:id` | `DeleteCategoria` | `Administrador` | Param `id` | `204` \| `400` Protected \| `401` \| `403` \| `404` | `categoria.eliminar` (`id`) |

### Security & Business Rules
1. **No mass assignment:** `PUT /api/categorias/:id` updates **only** `nombre` (and `updatedAt`). Callers can never flip `protegida` to `false` or mutate `id`.
2. **Protected deletion rule:** On `DELETE`, return `404` if not found; if `protegida === true`, return `400 Bad Request` without deleting.
3. **Validation errors:** Invalid `id` or empty `nombre` returns `400` via `validate` middleware (never `500`).

---

## 4. TypeScript Interface

```ts
import type { AuditContext } from '../schemas/common.schema';
import type {
  CategoriaDto,
  CreateCategoriaRequest,
  UpdateCategoriaRequest,
} from '../schemas/categorias.schema';

export interface ICategoriasService {
  getAll(): Promise<CategoriaDto[]>;
  getById(id: number): Promise<CategoriaDto | null>;
  create(input: CreateCategoriaRequest, audit: AuditContext): Promise<CategoriaDto>;
  update(id: number, input: UpdateCategoriaRequest, audit: AuditContext): Promise<void>;
  delete(id: number, audit: AuditContext): Promise<void>;
}
```
