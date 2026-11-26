# Pedidos Service (`pedidos`)

- **Base Route:** `/api/pedidos`
- **Owned Files:**
  - `src/schemas/pedidos.schema.ts`
  - `src/services/pedidos.service.ts`
  - `src/controllers/pedidos.controller.ts`
  - `src/routes/pedidos.routes.ts`
- **Dependencies:** References `usuario` ([usuarios_service.md](usuarios_service.md)) and `producto` ([productos_service.md](productos_service.md)); logs via `IBitacoraService` ([bitacora_service.md](bitacora_service.md)).
- **Decision Reference:** [DEC-015](../DECISION.md#dec-015--server-authoritative-orders-module-apipedidos-2026-11-26) (responds to `BACK-HANDOFF` `REQ-003`).

---

## 1. SQL Schema Entities

### Table: `pedido` (Layer 1 — FK → `usuario`)

| Column | MySQL / Drizzle Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `int('id').autoincrement().primaryKey()` | PK, Auto-Increment, NOT NULL |
| `usuarioid` | `varchar('usuarioid', { length: 36 }).notNull().references(() => usuario.id, { onUpdate: 'cascade', onDelete: 'cascade' })` | NOT NULL, FK → `usuario(id)` |
| `total` | `decimal('total', { precision: 10, scale: 2 }).notNull()` | NOT NULL (server-computed, serialized as JSON `number`) |
| `fecha` | `datetime('fecha').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL |
| `estado` | `varchar('estado', { length: 50 }).notNull().default('pendiente')` | NOT NULL (`'pendiente' \| 'confirmado' \| 'cancelado'`) |
| `createdAt` | `datetime('createdAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL |
| `updatedAt` | `datetime('updatedAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL (on update) |

### Table: `pedidodetalle` (Layer 2 — FKs → `pedido`, `producto`)

| Column | MySQL / Drizzle Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `int('id').autoincrement().primaryKey()` | PK, Auto-Increment, NOT NULL |
| `pedidoid` | `int('pedidoid').notNull().references(() => pedido.id, { onUpdate: 'cascade', onDelete: 'cascade' })` | NOT NULL, FK → `pedido(id)` |
| `productoid` | `int('productoid').references(() => producto.id, { onUpdate: 'cascade', onDelete: 'set null' })` | NULLABLE, FK → `producto(id)` *(preserves order history if product is later deleted)* |
| `titulo` | `varchar('titulo', { length: 255 }).notNull()` | NOT NULL *(snapshot of `producto.titulo` at checkout)* |
| `preciounitario` | `decimal('preciounitario', { precision: 10, scale: 2 }).notNull()` | NOT NULL *(snapshot of `producto.precio` at checkout; serialized as JSON `number`)* |
| `cantidad` | `int('cantidad').notNull()` | NOT NULL (`1..99`) |
| `createdAt` | `datetime('createdAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL |
| `updatedAt` | `datetime('updatedAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL (on update) |

---

## 2. Zod Mappings (`src/schemas/pedidos.schema.ts`)

```ts
import { z } from 'zod';

export const PedidoEstadoSchema = z.enum(['pendiente', 'confirmado', 'cancelado']);
export type PedidoEstado = z.infer<typeof PedidoEstadoSchema>;

export const CreatePedidoItemSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().int().min(1).max(99),
});

export const CreatePedidoRequestSchema = z.object({
  items: z.array(CreatePedidoItemSchema).min(1).max(50),
}).openapi('CreatePedidoRequest');

export const PedidoCreatedDtoSchema = z.object({
  pedidoId: z.number().int().positive(),
  total: z.number().nonnegative(),
  fecha: z.string().datetime(),
  estado: PedidoEstadoSchema,
}).openapi('PedidoCreatedDto');

export const PedidoSummaryDtoSchema = z.object({
  pedidoId: z.number().int().positive(),
  total: z.number().nonnegative(),
  fecha: z.string().datetime(),
  estado: PedidoEstadoSchema,
  itemCount: z.number().int().nonnegative(),
}).openapi('PedidoSummaryDto');

export const PedidoAdminSummaryDtoSchema = PedidoSummaryDtoSchema.extend({
  usuarioEmail: z.string().email(),
  usuarioNombre: z.string(),
}).openapi('PedidoAdminSummaryDto');

export const PedidoLineaDtoSchema = z.object({
  productoId: z.number().int().positive().nullable(),
  titulo: z.string(),
  precioUnitario: z.number().nonnegative(),
  cantidad: z.number().int().positive(),
}).openapi('PedidoLineaDto');

export const PedidoDetailDtoSchema = z.object({
  pedidoId: z.number().int().positive(),
  usuarioEmail: z.string().email(),
  usuarioNombre: z.string(),
  total: z.number().nonnegative(),
  fecha: z.string().datetime(),
  estado: PedidoEstadoSchema,
  items: z.array(PedidoLineaDtoSchema),
}).openapi('PedidoDetailDto');
```

---

## 3. API Endpoints

| Method | Path | `operationId` | Roles | Request | Response | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/pedidos` | `CreatePedido` | `Usuario` | `CreatePedidoRequest` | `201` `PedidoCreatedDto` \| `400` Validation / unknown product \| `401` \| `403` | `pedido.crear` (`pedidoId`) |
| `GET` | `/api/pedidos/mios` | `GetMyPedidos` | `Usuario` | None | `200` `PedidoSummaryDto[]` (ordered `id DESC`) \| `401` \| `403` | None |
| `GET` | `/api/pedidos` | `GetPedidos` | `Administrador` | None | `200` `PedidoAdminSummaryDto[]` (ordered `id DESC`) \| `401` \| `403` | None |
| `GET` | `/api/pedidos/:id` | `GetPedidoById` | `Usuario`, `Administrador` | Param `id` (int) | `200` `PedidoDetailDto` \| `400` \| `401` \| `403` \| `404` *(also for non-owner)* | None |

### Security & Business Rules
1. **Route registration order:** Register `GET /mios` **before** `GET /:id` so Express never treats `"mios"` as `:id`.
2. **Server-side price authority (OWASP API6 / CWE-602):** Ignore any client-supplied price/total (stripped by Zod). Merge duplicate `productoId` quantities in the request (enforcing merged quantity `<= 99`), fetch authoritative `producto` rows from MySQL, reject with `400` if any `productoId` does not exist, compute total in integer cents (`Math.round(Number(p.precio) * 100) * qty`) to avoid floating-point drift, and persist `pedido` + `pedidodetalle` atomically inside a transaction.
3. **Anti-IDOR (`GET /api/pedidos/:id`):** Look up order with owner email. If caller role is `'Usuario'` and `order.usuarioEmail.toLowerCase() !== callerEmail.toLowerCase()`, return **`404`** (never `403` — avoids leaking whether an order ID exists).
4. **Actor lookup:** Resolve caller's `usuario.id` from `req.decodedToken[ClaimTypes.Name]` (`401` if user no longer exists).

---

## 4. TypeScript Interface

```ts
import type { AuditContext, RoleName } from '../schemas/common.schema';
import type {
  CreatePedidoRequest,
  PedidoAdminSummaryDto,
  PedidoCreatedDto,
  PedidoDetailDto,
  PedidoSummaryDto,
} from '../schemas/pedidos.schema';

export interface PedidoActor {
  email: string;
  rol: RoleName;
}

export interface IPedidosService {
  create(input: CreatePedidoRequest, actorEmail: string, audit: AuditContext): Promise<PedidoCreatedDto>;
  getMine(actorEmail: string): Promise<PedidoSummaryDto[]>;
  getAll(): Promise<PedidoAdminSummaryDto[]>;
  getById(id: number, actor: PedidoActor): Promise<PedidoDetailDto | null>;
}
```
