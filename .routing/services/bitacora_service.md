# Bitácora Service (`bitacora`)

- **Base Route:** `/api/bitacora`
- **Owned Files:**
  - `src/services/bitacora.service.ts`
  - `src/middlewares/bitacora.middleware.ts`
  - `src/schemas/bitacora.schema.ts`
  - `src/controllers/bitacora.controller.ts`
  - `src/routes/bitacora.routes.ts`
- **Dependencies:** None (consumed by all mutating services via `req.bitacora` / `IBitacoraService`).

---

## 1. SQL Schema Entities

### Table: `bitacora`

| Column | MySQL / Drizzle Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `int('id').autoincrement().primaryKey()` | PK, NOT NULL |
| `accion` | `varchar('accion', { length: 255 }).notNull()` | NOT NULL |
| `elementoid` | `varchar('elementoid', { length: 255 })` | NULLABLE |
| `ip` | `varchar('ip', { length: 255 }).notNull()` | NOT NULL |
| `usuario` | `varchar('usuario', { length: 255 }).notNull()` | NOT NULL |
| `fecha` | `datetime('fecha').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL |
| `createdAt` | `datetime('createdAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL |
| `updatedAt` | `datetime('updatedAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL (on update) |

---

## 2. Zod Mappings (`src/schemas/bitacora.schema.ts`)

```ts
import { z } from 'zod';

export const BitacoraDtoSchema = z.object({
  bitacoraId: z.number().int().positive(),
  accion: z.string(),
  elementoid: z.string().nullable(),
  ip: z.string(),
  usuario: z.string(),
  fecha: z.string().datetime(),
}).openapi('BitacoraDto');

export const BitacoraListResponseSchema = z
  .array(BitacoraDtoSchema)
  .openapi('BitacoraListResponse');

export type BitacoraDto = z.infer<typeof BitacoraDtoSchema>;
```

---

## 3. API Endpoints

| Method | Path | `operationId` | Roles | Request | Response | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/bitacora` | `GetBitacora` | `Administrador` | None | `200` `BitacoraDto[]` ordered by `id DESC` \| `401` \| `403` | None |

### Security & Business Rules
1. **Append-only:** No `POST`, `PUT`, or `DELETE` HTTP endpoints exist for `bitacora`; records are written exclusively from server-side actions.
2. **Actor resolution:** Middleware resolves `usuario` dynamically at call time from `req.decodedToken?.[ClaimTypes.Name] ?? 'invitado'` (so it works even when `bitacoraMiddleware` runs before `authorize`).
3. **Trusted IP & sanitization:** Extract IP via `request-ip` honoring Express `trust proxy` config; clamp/sanitize control characters (`\r`, `\n`) and length (`<= 255`).
4. **Always awaited:** Controllers/services must `await req.bitacora(...)` (or `await bitacoraService.registrar(...)`) with proper error propagation/handling—never fire-and-forget unhandled promises.

---

## 4. TypeScript Interface

```ts
import type { BitacoraDto } from '../schemas/bitacora.schema';

export interface CreateBitacoraInput {
  accion: string;
  elementoid?: string | number | null;
  ip: string;
  usuario: string;
}

export interface IBitacoraService {
  registrar(input: CreateBitacoraInput): Promise<void>;
  getAll(): Promise<BitacoraDto[]>;
}
```
