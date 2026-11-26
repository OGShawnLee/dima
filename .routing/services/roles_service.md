# Roles Service (`roles`)

- **Base Route:** `/api/roles`
- **Owned Files:**
  - `src/services/roles.service.ts`
  - `src/schemas/roles.schema.ts`
  - `src/controllers/roles.controller.ts`
  - `src/routes/roles.routes.ts`
- **Dependencies:** None (referenced by `usuarios` and `auth`).

---

## 1. SQL Schema Entities

### Table: `rol`

| Column | MySQL / Drizzle Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `varchar('id', { length: 36 }).primaryKey()` | UUID string, PK, NOT NULL |
| `nombre` | `varchar('nombre', { length: 255 }).notNull()` | NOT NULL (recommend `UNIQUE` index) |
| `createdAt` | `datetime('createdAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL |
| `updatedAt` | `datetime('updatedAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL (on update) |

**Seeded Values:** `'Administrador'`, `'Usuario'` (UUIDs via `crypto.randomUUID()`).

---

## 2. Zod Mappings (`src/schemas/roles.schema.ts`)

```ts
import { z } from 'zod';
import { RoleNameSchema } from './common.schema';

export const RolDtoSchema = z.object({
  id: z.string().uuid(),
  nombre: RoleNameSchema,
}).openapi('RolDto');

export const RolListResponseSchema = z
  .array(RolDtoSchema)
  .openapi('RolListResponse');

export type RolDto = z.infer<typeof RolDtoSchema>;
```

---

## 3. API Endpoints

| Method | Path | `operationId` | Roles | Request | Response | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/roles` | `GetRoles` | `Administrador` | None | `200` `RolDto[]` \| `401` \| `403` | None |

### Security & Business Rules
1. **Read-only catalog:** Roles are fixed system principals (`Administrador`, `Usuario`) seeded at setup; no mutation endpoints are exposed.
2. **Async error safety:** Wrap DB call in `try/catch` and pass errors to `next(err)` (fixing the PDF's unhandled rejection).

---

## 4. TypeScript Interface

```ts
import type { RoleName } from '../schemas/common.schema';
import type { RolDto } from '../schemas/roles.schema';

export interface IRolesService {
  getAll(): Promise<RolDto[]>;
  findByNombre(nombre: RoleName): Promise<RolDto | null>;
}
```
