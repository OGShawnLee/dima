# Usuarios Service (`usuarios`)

- **Base Route:** `/api/usuarios`
- **Owned Files:**
  - `src/services/usuarios.service.ts`
  - `src/schemas/usuarios.schema.ts`
  - `src/controllers/usuarios.controller.ts`
  - `src/routes/usuarios.routes.ts`
- **Dependencies:** References `rol` ([roles_service.md](roles_service.md)); logs via `IBitacoraService` ([bitacora_service.md](bitacora_service.md)).

---

## 1. SQL Schema Entities

### Table: `usuario`

| Column | MySQL / Drizzle Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `varchar('id', { length: 36 }).primaryKey()` | UUID string, PK, NOT NULL |
| `email` | `varchar('email', { length: 255 }).notNull().unique()` | UNIQUE, NOT NULL |
| `passwordhash` | `varchar('passwordhash', { length: 255 }).notNull()` | NOT NULL (`bcrypt` cost 10) |
| `nombre` | `varchar('nombre', { length: 255 }).notNull()` | NOT NULL |
| `protegido` | `boolean('protegido').notNull().default(false)` | NOT NULL, Default: `false` |
| `rolid` | `varchar('rolid', { length: 36 }).notNull().references(() => rol.id, { onUpdate: 'cascade', onDelete: 'cascade' })` | NOT NULL, FK → `rol(id)` |
| `createdAt` | `datetime('createdAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL |
| `updatedAt` | `datetime('updatedAt').notNull().default(sql\`CURRENT_TIMESTAMP\`)` | NOT NULL (on update) |

**Seeded Values (dev/test only — blocked in `NODE_ENV=production`):**
- `gvera@uv.mx` (`Guillermo Vera`, `Administrador`, `protegido: true`)
- `patito@uv.mx` (`Usuario patito`, `Usuario`, `protegido: false`)

---

## 2. Zod Mappings (`src/schemas/usuarios.schema.ts`)

```ts
import { z } from 'zod';
import { RoleNameSchema } from './common.schema';

export const UsuarioEmailParamSchema = z.object({
  email: z.string().trim().email().max(255),
});

export const UsuarioDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nombre: z.string(),
  rol: RoleNameSchema,
}).openapi('UsuarioDto');

export const CreateUsuarioRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: StrongPasswordSchema, // min 12, max 128, upper+lower+digit+symbol (DEC-014)
  nombre: z.string().trim().min(1).max(255),
  rol: RoleNameSchema,
}).openapi('CreateUsuarioRequest');

export const UpdateUsuarioRequestSchema = z.object({
  nombre: z.string().trim().min(1).max(255).optional(),
  rol: RoleNameSchema,
}).openapi('UpdateUsuarioRequest');

export type UsuarioDto = z.infer<typeof UsuarioDtoSchema>;
export type CreateUsuarioRequest = z.infer<typeof CreateUsuarioRequestSchema>;
export type UpdateUsuarioRequest = z.infer<typeof UpdateUsuarioRequestSchema>;
```

> **Contract Standardization Note:** `POST /api/usuarios` returns `UsuarioDto` (`{ id, email, nombre, rol }`) instead of the legacy PDF's `{ ..., rolid: rolusuario.nombre }`, keeping `POST` and `GET` responses identical in OpenAPI 3.0.3.

---

## 3. API Endpoints

| Method | Path | `operationId` | Roles | Request | Response | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/usuarios` | `GetUsuarios` | `Administrador` | None | `200` `UsuarioDto[]` \| `401` \| `403` | None |
| `GET` | `/api/usuarios/:email` | `GetUsuarioByEmail` | `Administrador` | Param `email` | `200` `UsuarioDto` \| `400` \| `401` \| `403` \| `404` | None |
| `POST` | `/api/usuarios` | `CreateUsuario` | `Administrador` | `CreateUsuarioRequest` | `201` `UsuarioDto` \| `400` \| `401` \| `403` \| `409` Duplicate email | `usuarios.crear` (`email`) |
| `PUT` | `/api/usuarios/:email` | `UpdateUsuario` | `Administrador` | Param `email` + `UpdateUsuarioRequest` | `204` \| `400` \| `401` \| `403` Protected/self \| `404` | `usuarios.editar` (`email`) |
| `DELETE` | `/api/usuarios/:email` | `DeleteUsuario` | `Administrador` | Param `email` | `204` \| `400` \| `401` \| `403` Protected/self \| `404` | `usuarios.eliminar` (`email`) |

### Security & Business Rules
1. **Never expose `passwordhash`:** All read/create queries project explicit columns only (`id`, `email`, `nombre`, `rol`).
2. **No mass assignment:** `PUT` explicitly updates only `rolid` (resolved from `rol`) and optional `nombre`. Callers can never modify `id`, `email`, `protegido`, or `passwordhash`.
3. **Backend-enforced protection (`PUT` & `DELETE`):**
   - Return `404` if target user does not exist (checked before `protegido`).
   - Return `403` if `target.protegido === true`.
   - Return `403` if `target.email.toLowerCase() === audit.actorEmail.toLowerCase()` (admin cannot edit/demote or delete their own active account).
4. **Role validation & duplicate email:** Verify `rol` exists (`400` if invalid); map duplicate `email` to `409 Conflict`.
5. **Password hashing:** Hash with `bcrypt.hash(password, 10)` using a fresh `crypto.randomUUID()`.

---

## 4. TypeScript Interface

```ts
import type { AuditContext } from '../schemas/common.schema';
import type {
  CreateUsuarioRequest,
  UpdateUsuarioRequest,
  UsuarioDto,
} from '../schemas/usuarios.schema';

export interface IUsuariosService {
  getAll(): Promise<UsuarioDto[]>;
  getByEmail(email: string): Promise<UsuarioDto | null>;
  create(input: CreateUsuarioRequest, audit: AuditContext): Promise<UsuarioDto>;
  update(email: string, input: UpdateUsuarioRequest, audit: AuditContext): Promise<void>;
  delete(email: string, audit: AuditContext): Promise<void>;
}
```
