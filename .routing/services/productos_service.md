# Productos Service (`productos`)

- **Base Route:** `/api/productos`
- **Owned Files:**
  - `src/services/productos.service.ts`
  - `src/schemas/productos.schema.ts`
  - `src/controllers/productos.controller.ts`
  - `src/routes/productos.routes.ts`
- **Dependencies:** References `categoria` ([categorias_service.md](categorias_service.md)) and `archivo` ([archivos_service.md](archivos_service.md)); logs via `IBitacoraService` ([bitacora_service.md](bitacora_service.md)).

---

## 1. SQL Schema Entities

### Table: `producto`

| Column | MySQL / Drizzle Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `int('id').autoincrement().primaryKey()` | PK, Auto-Increment, NOT NULL |
| `titulo` | `varchar('titulo', { length: 255 }).notNull().default('Sin título')` | NOT NULL |
| `descripcion` | `text('descripcion').notNull()` | NOT NULL (app default `'Sin descripcion'`) |
| `precio` | `decimal('precio', { precision: 10, scale: 2 }).notNull()` | NOT NULL (serialized as JSON `number`) |
| `archivoid` | `int('archivoid').references(() => archivo.id, { onUpdate: 'cascade', onDelete: 'set null' })` | NULLABLE, FK → `archivo(id)` |
| `createdAt` | `datetime('createdAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL |
| `updatedAt` | `datetime('updatedAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL (on update) |

### Table: `categoriaproducto` (M:N Join Table)

| Column | MySQL / Drizzle Type | Constraints / Default |
| :--- | :--- | :--- |
| `categoriaid` | `int('categoriaid').notNull().references(() => categoria.id, { onUpdate: 'cascade', onDelete: 'cascade' })` | Composite PK, FK → `categoria(id)` |
| `productoid` | `int('productoid').notNull().references(() => producto.id, { onUpdate: 'cascade', onDelete: 'cascade' })` | Composite PK, FK → `producto(id)` |
| `createdAt` | `datetime('createdAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL |
| `updatedAt` | `datetime('updatedAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL (on update) |

---

## 2. Zod Mappings (`src/schemas/productos.schema.ts`)

```ts
import { z } from 'zod';
import { CategoriaDtoSchema } from './categorias.schema';

export const ProductoSearchQuerySchema = z.object({
  s: z.string().trim().max(255).optional(),
});

export const ProductoCategoriaParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  categoriaid: z.coerce.number().int().positive(),
});

export const AssignCategoriaBodySchema = z.object({
  categoriaid: z.coerce.number().int().positive(),
}).openapi('AssignCategoriaRequest');

export const ProductoDtoSchema = z.object({
  productoId: z.number().int().positive(),
  titulo: z.string(),
  descripcion: z.string(),
  precio: z.number().nonnegative(),
  archivoid: z.number().int().positive().nullable(),
  categorias: z.array(CategoriaDtoSchema),
}).openapi('ProductoDto');

export const CreateProductoRequestSchema = z.object({
  titulo: z.string().trim().min(1).max(255),
  descripcion: z.string().trim().min(1).max(5000),
  precio: z.coerce.number().finite().nonnegative().max(99999999.99),
  archivoid: z.number().int().positive().nullable().optional(),
}).openapi('CreateProductoRequest');

export const UpdateProductoRequestSchema = CreateProductoRequestSchema.openapi(
  'UpdateProductoRequest',
);

export type ProductoDto = z.infer<typeof ProductoDtoSchema>;
export type CreateProductoRequest = z.infer<typeof CreateProductoRequestSchema>;
export type UpdateProductoRequest = z.infer<typeof UpdateProductoRequestSchema>;
```

> **Contract Standardization Notes:**
> - `precio` is always coerced from MySQL `DECIMAL(10,2)` string to JSON `number` (`Number(row.precio)`) to match OpenAPI `type: number`.
> - `archivoid` is the canonical lowercase property name in OpenAPI 3.0.3.
> - `POST /api/productos` returns `ProductoDto` (with `productoId` and `categorias: []`).

---

## 3. API Endpoints

| Method | Path | `operationId` | Roles | Request | Response | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/productos` | `GetProductos` | `Usuario`, `Administrador` | Query `?s=` (optional) | `200` `ProductoDto[]` \| `400` \| `401` \| `403` | None |
| `GET` | `/api/productos/:id` | `GetProductoById` | `Usuario`, `Administrador` | Param `id` | `200` `ProductoDto` \| `400` \| `401` \| `403` \| `404` | None |
| `POST` | `/api/productos` | `CreateProducto` | `Administrador` | `CreateProductoRequest` | `201` `ProductoDto` \| `400` \| `401` \| `403` | `producto.crear` (`id`) |
| `PUT` | `/api/productos/:id` | `UpdateProducto` | `Administrador` | Param `id` + `UpdateProductoRequest` | `204` \| `400` \| `401` \| `403` \| `404` | `producto.editar` (`id`) |
| `DELETE` | `/api/productos/:id` | `DeleteProducto` | `Administrador` | Param `id` | `204` \| `400` \| `401` \| `403` \| `404` | `producto.eliminar` (`id`) |
| `POST` | `/api/productos/:id/categoria` | `AssignProductoCategoria` | `Administrador` | Param `id` + `AssignCategoriaRequest` | `204` \| `400` \| `401` \| `403` \| `404` \| `409` | `productocategoria.agregar` (`productId:categoriaId`) |
| `DELETE` | `/api/productos/:id/categoria/:categoriaid` | `RemoveProductoCategoria` | `Administrador` | Params `id`, `categoriaid` | `204` \| `400` \| `401` \| `403` \| `404` | `productocategoria.remover` (`productId:categoriaId`) |

### Security & Business Rules
1. **No mass assignment:** `POST` and `PUT` explicitly write only `titulo`, `descripcion`, `precio` (formatted to 2 decimal places), and `archivoid ?? null`.
2. **FK pre-validation:** When `archivoid` is non-null on `POST`/`PUT`, verify the `archivo` record exists first (`400 Bad Request` if missing) instead of leaking a MySQL FK `500`.
3. **Safe `LIKE` search:** Escape `\`, `%`, and `_` in `?s=` before querying `LIKE %escaped%` (parameterized via Drizzle).
4. **M:N link validation:** Both `assignCategoria` and `removeCategoria` verify that both `producto` and `categoria` exist (`404` if either is missing). Assigning an already-linked pair returns `409 Conflict`.

---

## 4. TypeScript Interface

```ts
import type { AuditContext } from '../schemas/common.schema';
import type {
  CreateProductoRequest,
  ProductoDto,
  UpdateProductoRequest,
} from '../schemas/productos.schema';

export interface IProductosService {
  getAll(search?: string): Promise<ProductoDto[]>;
  getById(id: number): Promise<ProductoDto | null>;
  create(input: CreateProductoRequest, audit: AuditContext): Promise<ProductoDto>;
  update(id: number, input: UpdateProductoRequest, audit: AuditContext): Promise<void>;
  delete(id: number, audit: AuditContext): Promise<void>;
  assignCategoria(productoId: number, categoriaId: number, audit: AuditContext): Promise<void>;
  removeCategoria(productoId: number, categoriaId: number, audit: AuditContext): Promise<void>;
}
```
