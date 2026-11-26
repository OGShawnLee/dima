# Dima — Service Routing Index

This file is the canonical routing map for `backendnode`. Every backend ticket (`B<NNN>`) must link to the exact service file(s) below so workers know their **SQL entities**, **Zod schemas**, **API endpoints**, and **TypeScript service interface** without ambiguity.

> **Source of Truth:** The backend OpenAPI 3.0.3 contract defined across these services is authoritative. Where legacy PDF quirks conflicted with clean REST typing (e.g., `rolid` vs `rol` on `POST /api/usuarios`, `id` vs `archivoId` on `POST /api/archivos`), each service file documents the standardized contract.

---

## Quick Glossary (Key Terms Used Here)

- **Track (`A`, `B`, `C`):** Parallel workstream lanes for our 3-member backend team so everyone can build independent modules at the same time with minimal Git merge conflicts (defined in [CONTEXT.md](CONTEXT.md)).
  - **Track A:** Auth, JWT/RBAC, Users, Roles, Audit Log (`bitacora`).
  - **Track B:** Database catalog domain (`categorias`, `productos`, `categoriaproducto`).
  - **Track C:** Hardened File Uploads (`archivos`), OpenAPI 3.0.3 registry, and automated test suite.
- **Layer (`0`, `1`, `2`):** Dependency order based on SQL foreign keys (**FK**) and service calls. Lower layers must exist before higher layers can be migrated or implemented:
  - **Layer 0 (Foundational):** Tables with **no** foreign keys to other tables (`rol`, `categoria`, `archivo`, `bitacora`).
  - **Layer 1 (Dependent Entities):** Tables with foreign keys pointing to Layer 0 (`usuario` references `rol`; `producto` references `archivo`).
  - **Layer 2 (Join Tables & Orchestrators):** Tables or services that combine multiple lower-layer entities (`categoriaproducto` joins `categoria` + `producto`; `auth` reads `usuario` + `rol`).
- **DTO (Data Transfer Object):** The exact JSON shape sent over HTTP (request body or response payload), decoupled from raw database rows so internal columns like `passwordhash` or raw `id` names never leak.
- **FK (Foreign Key):** A database column referencing the primary key of another table to enforce referential integrity (e.g., `usuario.rolid → rol.id`).
- **`operationId`:** A unique PascalCase method name in OpenAPI 3.0.3 (e.g., `GetProductos`) that C#/SDK generators turn into client method names.
- **RBAC (Role-Based Access Control):** Restricting each endpoint to specific user roles (`Administrador`, `Usuario`).
- **Mass Assignment (CWE-915):** A vulnerability where raw `req.body` is passed straight into a DB `.update()` call, letting attackers overwrite protected columns like `protegida` or `passwordhash`.
- **CRLF Injection (CWE-117):** Injecting carriage-return/newline characters (`\r`, `\n`) into user input that gets written to plain-text logs (`log/log.txt`) to forge fake log entries.

---

## Service Map

| Service | Spec File | Base Route | Owned SQL Tables | Dependencies | Track |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Auth** | [auth_service.md](services/auth_service.md) | `/api/auth` | _(none — reads `usuario`, `rol`)_ | `usuarios`, `roles`, `bitacora` | A |
| **Bitácora** | [bitacora_service.md](services/bitacora_service.md) | `/api/bitacora` | `bitacora` | _(none)_ | A |
| **Roles** | [roles_service.md](services/roles_service.md) | `/api/roles` | `rol` | _(none)_ | A |
| **Usuarios** | [usuarios_service.md](services/usuarios_service.md) | `/api/usuarios` | `usuario` | `roles`, `bitacora` | A |
| **Categorías** | [categorias_service.md](services/categorias_service.md) | `/api/categorias` | `categoria` | `bitacora` | B |
| **Productos** | [productos_service.md](services/productos_service.md) | `/api/productos` | `producto`, `categoriaproducto` | `categorias`, `archivos`, `bitacora` | B |
| **Archivos** | [archivos_service.md](services/archivos_service.md) | `/api/archivos` | `archivo` | `bitacora` | C |

---

## Dependency Order (Layers — Migration & Build Sequence)

Build and migrate tables from Layer 0 → Layer 1 → Layer 2 so foreign-key constraints always resolve:

```text
Layer 0 (No FKs):         rol, categoria, archivo, bitacora
Layer 1 (FK -> Layer 0):  usuario (-> rol), producto (-> archivo)
Layer 2 (Join / Auth):    categoriaproducto (-> categoria, producto), auth (-> usuario, rol)
```

All mutating endpoints (`POST`, `PUT`, `DELETE`, and `POST /api/auth`) invoke `IBitacoraService.registrar(...)` (wired through `req.bitacora(...)`).

---

## Shared Types & Conventions (`src/schemas/common.schema.ts`)

These shared definitions live in a single file (`src/schemas/common.schema.ts`) so every service uses the same validation rules, error format, and audit metadata instead of duplicating them:

| Symbol | What It Is | Where It Comes From / Why It Exists |
| :--- | :--- | :--- |
| `RoleNameSchema` / `RoleName` | Zod enum & TS union `'Administrador' \| 'Usuario'` | Derived from the two system roles seeded in table `rol` ([BACKEND-API-SPEC.md](../BACKEND-API-SPEC.md#L246)). Used by `authorize(...)`, user/role DTOs, and OpenAPI enums. |
| `NumericIdParamSchema` | Validates & coerces `{ id }` URL param to positive integer | In Express, `req.params.id` is always a raw `string`. Coercing and validating it up front rejects bad IDs like `/api/productos/abc` with `400` instead of crashing DB queries. |
| `ErrorResponseSchema` | Standard JSON error envelope (`mensaje`, optional `status`, `stack`, `detalles`) | Derived from `errorhandler.middleware.ts` ([BACKEND-API-SPEC.md](../BACKEND-API-SPEC.md#L307-L316)). `mensaje` is always returned; `status` and `stack` appear only when `NODE_ENV === 'development'`; `detalles` lists field-level Zod validation errors on `400`. |
| `AuditContext` | Plain TS interface `{ ip, actorEmail }` | Populated by `bitacora.middleware.ts` using `request-ip` and `req.decodedToken[ClaimTypes.Name]` (default `'invitado'`). Passed into service methods so services stay decoupled from Express `Request` and remain easy to unit-test. |

```ts
import { z } from 'zod';

export const RoleNameSchema = z.enum(['Administrador', 'Usuario']);
export type RoleName = z.infer<typeof RoleNameSchema>;

export const NumericIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const ErrorResponseSchema = z.object({
  mensaje: z.string(),
  status: z.number().int().optional(),
  stack: z.string().optional(),
  detalles: z.array(z.object({
    path: z.string(),
    message: z.string(),
  })).optional(),
}).openapi('ErrorResponse');

export interface AuditContext {
  ip: string;
  actorEmail: string; // decodedToken[ClaimTypes.Name] ?? 'invitado'
}
```

### Standard HTTP Status Policy

| Status | Meaning |
| :--- | :--- |
| `200` | Successful read or login |
| `201` | Resource created (returns canonical DTO matching `GET`) |
| `204` | Successful update, delete, or relation link/unlink (empty body) |
| `400` | Zod validation error, invalid FK reference, protected category delete, invalid file upload |
| `401` | Missing, malformed, invalid, or expired JWT; invalid login credentials |
| `403` | Valid JWT with insufficient role; attempt to edit/delete `protegido` user or self-edit/self-delete |
| `404` | Target resource not found by `:id` or `:email` |
| `409` | Unique/composite constraint conflict (duplicate user email or duplicate product-category link) |

### Security Invariants Across All Services

1. **No mass assignment:** Every write accepts a strict Zod DTO and writes only explicitly allowlisted columns to Drizzle.
2. **Auth before upload:** `authorize(...)` always precedes `upload.single('file')`.
3. **Async safety:** Controllers forward all errors via `next(err)` to the centralized CRLF-safe `errorHandler`.
4. **OpenAPI 3.0.3:** Every endpoint declares a PascalCase `operationId`, named `.openapi('...')` schemas, and `bearerAuth` security unless explicitly public.
