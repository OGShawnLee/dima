# Software Specification Document (SSD): Backend API (Node.js + TypeScript)

**Project Name:** `backendnode`  
**Architecture Pattern:** MVC (Model-View-Controller — Stateless RESTful JSON API)  
**Target Domain:** E-Commerce / Product Catalog Management (Products, Categories, Users, Roles, Files, Audit Log)  
**Primary Stack:** Node.js (v20.x) / TypeScript / Express / Drizzle ORM / MySQL 8.0 / Zod + OpenAPI 3.0.3  
**Primary Consumers:** C# / .NET Client (via generated OpenAPI SDK) & Web Clients

---

## 1. System Overview

This system is a stateless, strongly typed RESTful Web API built with **Node.js**, **TypeScript**, **Express**, and **Drizzle ORM** backed by an existing **MySQL 8.0** relational schema. It exposes full CRUD operations for managing products, categories, users, roles, and image files, alongside role-based access control (RBAC) using JSON Web Tokens (JWT), automatic sliding token refresh, database-persisted audit logging (`bitacora`), centralized file-based error logging, and a schema-driven **OpenAPI 3.0.3** contract tailored for **C# client code generation**.

### Core Capabilities

* **Type-Safe Persistence (Drizzle ORM):** Single source of truth in TypeScript (`src/db/schema.ts`) mapped 1:1 to the existing MySQL 8.0 tables (`utf8mb4`), using `mysql2` connection pooling.
* **Schema-Driven Validation & OpenAPI 3.0.3:** Request/response payloads are defined once with **Zod** (`drizzle-zod` + `@asteasolutions/zod-to-openapi`), powering runtime validation, TypeScript types, and `/openapi.json` generation simultaneously.
* **Dual API Documentation UI:** Serves **Swagger UI** at `/swagger` and **Scalar API Reference** (with C# `HttpClient` snippets) at `/docs`, both reading `/openapi.json`.
* **Authentication & Authorization:** Stateless JWT authentication using .NET-compatible WS-Federation claim URIs, role-based route protection (`Administrador`, `Usuario`), and sliding token renewal via the `Set-Authorization` response header.
* **Dual-Mode File Storage:** Image upload (`JPG` only via `multer`) configurable to store binary payloads either on the local filesystem (`uploads/`) or directly inside MySQL (`LONGBLOB`) via `FILES_IN_BD`.
* **Audit Trail (`Bitácora`):** Database-persisted action log capturing action name, affected resource ID/email, client IP, authenticated user email, and timestamp.
* **Error Handling & Logging:** Centralized Express error handler appending error records to `log/log.txt` and adapting JSON error verbosity based on `NODE_ENV`.

---

## 2. Technology Stack & Dependencies

### Runtime & Database
* **Node.js:** `v20.16.0+` (LTS)
* **TypeScript:** `^5.x` (`strict: true`, `moduleResolution: "node"` or `"bundler"`)
* **Database:** MySQL `8.0` (`CHARACTER SET utf8mb4`)

### Production Dependencies (`package.json`)

| Package | Purpose |
| :--- | :--- |
| `express` (`^4.19.2`) | HTTP server and routing framework |
| `drizzle-orm` | Lightweight, SQL-first TypeScript ORM |
| `mysql2` | High-performance MySQL driver & connection pool |
| `zod` | Runtime payload validation & TypeScript type inference |
| `drizzle-zod` | Derives Zod schemas directly from Drizzle table definitions |
| `@asteasolutions/zod-to-openapi` | Generates OpenAPI 3.0.3 specification from Zod schemas |
| `swagger-ui-express` | Serves classic Swagger UI at `/swagger` |
| `@scalar/express-api-reference` | Serves modern Scalar API Reference (with C# snippets) at `/docs` |
| `dotenv` | Loads environment variables from `.env` |
| `cors` | Cross-Origin Resource Sharing middleware |
| `bcrypt` | Password hashing (cost factor `10`) |
| `jsonwebtoken` | JWT signing and verification (`HS256`) |
| `multer` | `multipart/form-data` file upload handling |
| `request-ip` | Client IP extraction for audit and error logs |

### Development Dependencies

| Package | Purpose |
| :--- | :--- |
| `typescript` | TypeScript compiler (`tsc --noEmit` for agent verification, `tsc` for build) |
| `tsx` | Fast TypeScript execution & hot-reload watcher (`tsx watch src/index.ts`) |
| `drizzle-kit` | Schema introspection (`pull`), diffing (`generate`), and migration CLI |
| `@types/node`, `@types/express`, `@types/cors`, `@types/bcrypt`, `@types/jsonwebtoken`, `@types/multer`, `@types/swagger-ui-express` | TypeScript ambient type definitions |

---

## 3. Project Directory Structure

All agents must adhere to the following TypeScript layout:

```text
backendnode/
├── src/
│   ├── config/
│   │   ├── claimtypes.ts           # Standard WS-Identity JWT claim URI constants
│   │   ├── env.ts                  # Zod-validated environment variable parser
│   │   └── openapi.ts              # OpenAPI 3.0.3 registry & document generator
│   ├── controllers/
│   │   ├── archivos.controller.ts
│   │   ├── auth.controller.ts
│   │   ├── bitacora.controller.ts
│   │   ├── categorias.controller.ts
│   │   ├── productos.controller.ts
│   │   ├── roles.controller.ts
│   │   └── usuarios.controller.ts
│   ├── db/
│   │   ├── index.ts                # mysql2 pool + Drizzle db instance
│   │   ├── schema.ts               # Drizzle MySQL table & relation definitions
│   │   └── seed.ts                 # Idempotent initial catalog & user seeder
│   ├── middlewares/
│   │   ├── auth.middleware.ts      # JWT verification, RBAC, and sliding refresh
│   │   ├── bitacora.middleware.ts  # Attaches req.bitacora() logger helper
│   │   ├── errorhandler.middleware.ts # Global error formatter & log/log.txt writer
│   │   ├── upload.middleware.ts    # Multer diskStorage & JPG-only filter
│   │   └── validate.middleware.ts  # Reusable Zod request validator middleware
│   ├── routes/
│   │   ├── archivos.routes.ts
│   │   ├── auth.routes.ts
│   │   ├── bitacora.routes.ts
│   │   ├── categorias.routes.ts
│   │   ├── productos.routes.ts
│   │   ├── roles.routes.ts
│   │   └── usuarios.routes.ts
│   ├── schemas/                    # Zod DTOs & OpenAPI component schemas
│   │   ├── archivos.schema.ts
│   │   ├── auth.schema.ts
│   │   ├── bitacora.schema.ts
│   │   ├── categorias.schema.ts
│   │   ├── common.schema.ts        # Shared error & param schemas
│   │   ├── productos.schema.ts
│   │   ├── roles.schema.ts
│   │   └── usuarios.schema.ts
│   ├── services/
│   │   └── jwttoken.service.ts     # Token generation & remaining time calculator
│   ├── types/
│   │   └── express.d.ts            # Express Request augmentation (decodedToken, bitacora)
│   └── index.ts                    # Application entry point
├── drizzle/                        # Generated SQL migrations (if managed via drizzle-kit)
├── log/                            # Runtime error logs (log.txt)
├── restclient/                     # Local .http test files & assets/ (GITIGNORED)
├── uploads/                        # Uploaded JPG files (when FILES_IN_BD=false)
├── .env                            # Environment variables (GITIGNORED)
├── .gitignore                      # Excludes node_modules, dist, .env, restclient, *.sql
├── drizzle.config.ts               # Drizzle Kit CLI configuration
├── package.json
└── tsconfig.json
```

### Express Type Augmentation (`src/types/express.d.ts`)

Agents must declare custom properties attached by middlewares so controllers remain strictly typed without `any`:

```ts
import { JwtPayload } from 'jsonwebtoken';

export interface DecodedTokenPayload extends JwtPayload {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': string;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': string;
}

declare global {
  namespace Express {
    interface Request {
      decodedToken?: DecodedTokenPayload;
      bitacora: (accion: string, elementoid?: string | number | null) => Promise<void>;
    }
  }
}
```

---

## 4. Environment & Configuration

### Environment Variables (`.env`)

Validated at startup via Zod in `src/config/env.ts` (fail-fast if required keys are missing):

```env
DB_HOST=localhost
DB_DATABASE=mercadolibrenode
DB_USER=mercadolibre_user
DB_PASSWORD=M3rc@d0
DB_PORT=3306
SERVER_PORT=3000
NODE_ENV=development
JWT_SECRET=<70-char hex string generated via crypto.randomBytes(35).toString('hex')>
FILES_IN_BD=false
```

> **Note:** Preserve the exact variable name `FILES_IN_BD` (`"true"` / `"false"`), parsed into a boolean in `src/config/env.ts`.

### CORS Configuration (`src/index.ts`)
* **Allowed Origins:** `["http://localhost:8080", "http://localhost:8081"]`
* **Allowed Methods:** `"GET, PUT, POST, DELETE"`
* **Exposed Headers:** `["Set-Authorization"]` *(Required so browser-based clients can read the refreshed JWT header; C# `HttpClient` reads it automatically).*

---

## 5. Database Schema & Drizzle ORM Mapping

The database schema already exists in MySQL (`mercadolibrenode`, `utf8mb4`). Drizzle ORM maps directly to these exact singular table and column names in `src/db/schema.ts`. Agents can also verify alignment against the live database using `npx drizzle-kit pull`.

All tables include `createdAt` (`datetime`/`timestamp`, NOT NULL, default `NOW()`) and `updatedAt` (`datetime`/`timestamp`, NOT NULL, default `NOW()`, on update `NOW()`).

### Entity Definitions (`src/db/schema.ts`)

#### 5.1 `categoria`
| Column | Drizzle MySQL Type | Constraints / Defaults |
| :--- | :--- | :--- |
| `id` | `int('id').autoincrement().primaryKey()` | PK, Auto-Increment, NOT NULL |
| `nombre` | `varchar('nombre', { length: 255 }).notNull()` | NOT NULL |
| `protegida` | `boolean('protegida').notNull().default(false)` | Default: `false` |

#### 5.2 `producto`
| Column | Drizzle MySQL Type | Constraints / Defaults |
| :--- | :--- | :--- |
| `id` | `int('id').autoincrement().primaryKey()` | PK, Auto-Increment, NOT NULL |
| `titulo` | `varchar('titulo', { length: 255 }).notNull().default('Sin título')` | Default: `"Sin título"` |
| `descripcion` | `text('descripcion').notNull()` | Default handled in app/DB: `"Sin descripcion"` |
| `precio` | `decimal('precio', { precision: 10, scale: 2 }).notNull()` | NOT NULL *(Note: MySQL `DECIMAL` returns string in `mysql2`; coerce to `number` in JSON DTOs if needed for C# `decimal`)* |
| `archivoid` | `int('archivoid').references(() => archivo.id, { onUpdate: 'cascade', onDelete: 'set null' })` | NULLABLE, FK → `archivo(id)` |

#### 5.3 `categoriaproducto` (Join Table)
| Column | Drizzle MySQL Type | Constraints / Defaults |
| :--- | :--- | :--- |
| `categoriaid` | `int('categoriaid').notNull().references(() => categoria.id, { onUpdate: 'cascade', onDelete: 'cascade' })` | Composite PK, FK → `categoria(id)` |
| `productoid` | `int('productoid').notNull().references(() => producto.id, { onUpdate: 'cascade', onDelete: 'cascade' })` | Composite PK, FK → `producto(id)` |

#### 5.4 `rol`
| Column | Drizzle MySQL Type | Constraints / Defaults |
| :--- | :--- | :--- |
| `id` | `varchar('id', { length: 36 }).primaryKey()` | UUID string, PK, NOT NULL |
| `nombre` | `varchar('nombre', { length: 255 }).notNull()` | NOT NULL |

#### 5.5 `usuario`
| Column | Drizzle MySQL Type | Constraints / Defaults |
| :--- | :--- | :--- |
| `id` | `varchar('id', { length: 36 }).primaryKey()` | UUID string, PK, NOT NULL |
| `email` | `varchar('email', { length: 255 }).notNull().unique()` | UNIQUE, NOT NULL |
| `passwordhash` | `varchar('passwordhash', { length: 255 }).notNull()` | NOT NULL (`bcrypt` hash) |
| `nombre` | `varchar('nombre', { length: 255 }).notNull()` | NOT NULL |
| `protegido` | `boolean('protegido').notNull().default(false)` | Default: `false` |
| `rolid` | `varchar('rolid', { length: 36 }).notNull().references(() => rol.id, { onUpdate: 'cascade', onDelete: 'cascade' })` | NOT NULL, FK → `rol(id)` |

#### 5.6 `archivo`
| Column | Drizzle MySQL Type | Constraints / Defaults |
| :--- | :--- | :--- |
| `id` | `int('id').autoincrement().primaryKey()` | PK, Auto-Increment, NOT NULL |
| `mime` | `varchar('mime', { length: 255 }).notNull()` | NOT NULL |
| `nombre` | `varchar('nombre', { length: 255 }).notNull()` | NOT NULL |
| `size` | `int('size').notNull()` | NOT NULL |
| `indb` | `boolean('indb').notNull().default(true)` | NOT NULL, Default: `true` |
| `datos` | `customType<{ data: Buffer }>({ dataType: () => 'longblob' })('datos')` | NULLABLE (`LONGBLOB`) |

#### 5.7 `bitacora`
| Column | Drizzle MySQL Type | Constraints / Defaults |
| :--- | :--- | :--- |
| `id` | `int('id').autoincrement().primaryKey()` | PK, Auto-Increment, NOT NULL |
| `accion` | `varchar('accion', { length: 255 }).notNull()` | NOT NULL |
| `elementoid` | `varchar('elementoid', { length: 255 })` | NULLABLE |
| `ip` | `varchar('ip', { length: 255 }).notNull()` | NOT NULL |
| `usuario` | `varchar('usuario', { length: 255 }).notNull()` | NOT NULL |
| `fecha` | `datetime('fecha').notNull()` | Default: `NOW()` |

### Seed Data Requirements (`src/db/seed.ts`)
Run via `npx tsx src/db/seed.ts` (must be idempotent using `onDuplicateKeyUpdate` / existence checks):
1. **Roles:** `Administrador` and `Usuario` (UUIDs via `crypto.randomUUID()`).
2. **Default Users** (password `'patito'` hashed with `bcrypt.hash('patito', 10)`):
   * Admin: `gvera@uv.mx` | Name: `Guillermo Vera` | Role: `Administrador` | `protegido: true`
   * Standard User: `patito@uv.mx` | Name: `Usuario patito` | Role: `Usuario` | `protegido: false`
3. **Categories (15 protected categories, `protegida: true`):**  
   1. Televisores, 2. Celulares y tecnología, 3. Laptops, 4. Electrodomésticos, 5. Hogar y muebles, 6. Moda, 7. Deportes, 8. Construcción, 9. Oficina, 10. Juguetes, 11. Bebés, 12. Salud, 13. Belleza, 14. Videojuegos, 15. Supermercado.
4. **Products & Category-Product Mappings:** 15 initial products mapped 1-to-1 with Categories `1` through `15`.

---

## 6. Security, Authentication & Authorization

### JWT Claims Structure (`src/config/claimtypes.ts`)
Tokens must use standard WS-Federation / .NET-compatible claim URIs so `System.Security.Claims` in the C# client maps them natively:
* `ClaimTypes.Name`: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` → User `email`
* `ClaimTypes.GivenName`: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` → User `nombre`
* `ClaimTypes.Role`: `http://schemas.microsoft.com/ws/2008/06/identity/claims/role` → Role `nombre`

### Token Service (`src/services/jwttoken.service.ts`)
* **`generaToken(email: string, nombre: string, rol: string): string`**
  * Signs payload with the 3 claims above plus `"iss": "ServidorFeiJWT"` and `"aud": "ClientesFeiJWT"`.
  * Signed with `env.JWT_SECRET` using HMAC-SHA256 (`HS256`), `expiresIn: '20m'`.
* **`tiempoRestanteToken(req: Request): string | null`**
  * Extracts Bearer token from `Authorization` header, verifies it, and returns remaining validity formatted as `"00:MM:SS"`. Returns `null` if invalid or expired.

### Authorization Middleware (`src/middlewares/auth.middleware.ts`)
`authorize(...allowedRoles: ('Administrador' | 'Usuario')[])` returns a typed Express middleware performing:
1. **Header Check:** Guards `if (!authHeader || !authHeader.startsWith('Bearer '))` and forwards a `401` Error (`"Acceso denegado"`).
2. **Signature & Expiry Verification:** Validates via `jwt.verify(token, env.JWT_SECRET)` and narrows to `DecodedTokenPayload`.
3. **RBAC Check:** Verifies `allowedRoles.includes(decodedToken[ClaimTypes.Role])`. Using rest parameters (`authorize('Usuario', 'Administrador')`) eliminates whitespace-splitting bugs.
4. **Context Attachment:** Assigns `req.decodedToken = decodedToken`.
5. **Sliding Session Refresh:** Calculates remaining minutes from `decodedToken.exp`. If `minutosRestantes < 5`, generates a fresh 20-minute token and sets:
   ```http
   Set-Authorization: <new_jwt_token>
   ```

---

## 7. Middleware Pipeline & Cross-Cutting Concerns

The middleware execution order in `src/index.ts` must be:
1. Startup directory check: `fs.mkdirSync('log', { recursive: true })` and `fs.mkdirSync('uploads', { recursive: true })`
2. `express.json()` & `express.urlencoded({ extended: false })`
3. `cors(corsOptions)`
4. OpenAPI JSON endpoint (`GET /openapi.json`), Swagger UI (`/swagger`), and Scalar API Reference (`/docs`)
5. `bitacoraMiddleware` (global)
6. API Route handlers (`/api/*`)
7. Catch-all `404` handler (`res.status(404).send("Recurso no encontrado")`)
8. `errorHandler` (**must be registered last**)

### 7.1 Audit Logging (`src/middlewares/bitacora.middleware.ts`)
* Extracts client IP via `requestIp.getClientIp(req) ?? 'unknown'`.
* Attaches `req.bitacora = async (accion, id) => { ... }` to `req`.
* Resolves `email` from `req.decodedToken?.[ClaimTypes.Name] ?? 'invitado'` and inserts into `bitacora` via Drizzle (`db.insert(bitacora).values(...)`).

### 7.2 File Upload (`src/middlewares/upload.middleware.ts`)
* Uses `multer.diskStorage` targeting `uploads/` with filename `${Date.now()}-${file.originalname}`.
* **File Filter:** Strictly accepts `image/jpeg` MIME type AND `.jpg` extension (case-insensitive check recommended). Rejects others with `new Error("Solo se permiten imágenes con extensión JPG.")`.
* **Expected Form Field:** `file` (`upload.single("file")`).
* **Security Order:** Always place `authorize('Administrador')` **before** `upload.single("file")` in routes so unauthorized requests cannot write files to disk.

### 7.3 Error Handling (`src/middlewares/errorhandler.middleware.ts`)
* Supports custom `HttpError` class (`statusCode: number`) and `ZodError` (mapped to `400 Bad Request` with structured validation details).
* Default HTTP status: `500`. Default message: `'No se ha podido procesar la petición. Inténtelo nuevamente más tarde.'`.
* Appends log line to `log/log.txt`:
  ```text
  <ISO Date> - <statusCode> - <ip> - <email> - <err.message || defaultMessage>
  ```
* **HTTP Response:**
  * `NODE_ENV === 'development'`: `{ status, mensaje, stack }`
  * Otherwise: `{ mensaje }`

---

## 8. API Endpoint Specifications

All JSON responses and request bodies must match these exact property names to remain backward-compatible with existing clients and strongly typed in the generated C# SDK.

### 8.1 Authentication (`/api/auth`)

| Method | Endpoint | Roles | Request / Response & Business Rules | Audit Action |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth` | Public | Body: `{ email, password }`. Returns `200` `{ email, nombre, rol, jwt }` or `401` `{ mensaje: 'Usuario o contraseña incorrectos.' }`. | `usuario.login` (`email`) |
| `GET` | `/api/auth/tiempo` | `Usuario`, `Administrador` | Returns `200` `text/plain` remaining time string (`"00:MM:SS"`), or `404` if unavailable. | None |

### 8.2 Categories (`/api/categorias`)
* **Zod Validation:** `nombre`: `z.string().min(1)` (required).

| Method | Endpoint | Roles | Request / Response & Business Rules | Audit Action |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/categorias` | `Usuario`, `Administrador` | Returns `200` array of `{ categoriaId, nombre, protegida }`. | None |
| `GET` | `/api/categorias/:id` | `Usuario`, `Administrador` | Returns `200` `{ categoriaId, nombre, protegida }` or `404`. | None |
| `POST` | `/api/categorias` | `Administrador` | Body: `{ nombre }`. Returns `201` created category. | `categoria.crear` (`id`) |
| `PUT` | `/api/categorias/:id` | `Administrador` | Body: `{ nombre }`. Returns `204` on success, `404` if not found. | `categoria.editar` (`id`) |
| `DELETE` | `/api/categorias/:id` | `Administrador` | Returns `404` if not found. **Business Rule:** If `protegida === true`, returns `400`. Otherwise deletes and returns `204`. | `categoria.eliminar` (`id`) |

### 8.3 Products (`/api/productos`)
* **Zod Validation:** `titulo`: `z.string().min(1)`, `descripcion`: `z.string().min(1)`, `precio`: `z.coerce.number().nonnegative()`, `archivoid`: `z.number().int().nullable().optional()`.

| Method | Endpoint | Roles | Request / Response & Business Rules | Audit Action |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/productos` | `Usuario`, `Administrador` | Optional query `?s=<search>` filters `titulo` with `LIKE %s%`. Returns `200` array of `{ productoId, titulo, descripcion, precio, archivoid, categorias: [{ categoriaId, nombre, protegida }] }`. | None |
| `GET` | `/api/productos/:id` | `Usuario`, `Administrador` | Returns `200` product with nested `categorias` array, or `404`. | None |
| `POST` | `/api/productos` | `Administrador` | Body: `{ titulo, descripcion, precio, archivoid? }`. Returns `201` created product. | `producto.crear` (`id`) |
| `PUT` | `/api/productos/:id` | `Administrador` | Body: `{ titulo, descripcion, precio, archivoid? }`. Returns `204` or `404`. | `producto.editar` (`id`) |
| `DELETE` | `/api/productos/:id` | `Administrador` | Returns `204` on deletion or `404` if not found. | `producto.eliminar` (`id`) |
| `POST` | `/api/productos/:id/categoria` | `Administrador` | Body: `{ categoriaid }`. Inserts into `categoriaproducto` (verify both entities exist first). Returns `204` or `404`. | `productocategoria.agregar` (`productId:categoriaId`) |
| `DELETE` | `/api/productos/:id/categoria/:categoriaid` | `Administrador` | Deletes row from `categoriaproducto` (verify both entities exist first). Returns `204` or `404`. | `productocategoria.remover` (`productId:categoriaId`) |

### 8.4 Files (`/api/archivos`)

| Method | Endpoint | Roles | Request / Response & Business Rules | Audit Action |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/archivos` | `Administrador` | Returns `200` metadata list: `{ archivoId, mime, indb, nombre, size }`. | None |
| `GET` | `/api/archivos/:id` | **Public** | Streams raw binary file (`application/octet-stream` or `data.mime`). Reads from `data.datos` if `indb === true`, else reads `uploads/<nombre>`. Returns `404` if not found. | None |
| `GET` | `/api/archivos/:id/detalle` | `Administrador` | Returns `200` metadata `{ archivoId, mime, indb, nombre, size }` or `404`. | None |
| `POST` | `/api/archivos` | `Administrador` | `multipart/form-data` (`file`). Returns `400` if missing. If `FILES_IN_BD === true`, reads buffer into DB and unlinks disk copy. Returns `201` `{ id, mime, indb, nombre }`. | `archivos.crear` (`id`) |
| `PUT` | `/api/archivos/:id` | `Administrador` | `multipart/form-data` (`file`). Replaces metadata/binary; unlinks temp upload if record not found (`404`); deletes old disk file if `!imagen.indb`. Returns `204`. | `archivos.editar` (`id`) |
| `DELETE` | `/api/archivos/:id` | `Administrador` | Deletes DB record and unlinks `uploads/<nombre>` if `!imagen.indb`. Returns `204` or `404`. | `archivos.eliminar` (`id`) |

### 8.5 Users (`/api/usuarios`)
> **Note:** Individual user operations use `:email` as the route identifier rather than UUID `:id`.

| Method | Endpoint | Roles | Request / Response & Business Rules | Audit Action |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/usuarios` | `Administrador` | Returns `200` list of `{ id, email, nombre, rol }` (joined with `rol`, never returns `passwordhash`). | None |
| `GET` | `/api/usuarios/:email` | `Administrador` | Returns `200` `{ id, email, nombre, rol }` or `404`. | None |
| `POST` | `/api/usuarios` | `Administrador` | Body: `{ email, password, nombre, rol }`. Looks up `rol` by `nombre` (`400`/`404` if invalid), hashes password with `bcrypt(10)`, generates UUID. Returns `201` `{ id, email, nombre, rolid: rolusuario.nombre }`. | `usuarios.crear` (`email`) |
| `PUT` | `/api/usuarios/:email` | `Administrador` | Body: `{ nombre?, rol }`. Resolves `rolid` from `rol` name and updates record. Returns `204` or `404`. | `usuarios.editar` (`email`) |
| `DELETE` | `/api/usuarios/:email` | `Administrador` | Returns `404` if user not found. **Business Rule:** If `protegido === true`, returns `403`. Otherwise deletes user and returns `204`. | `usuarios.eliminar` (`email`) |

### 8.6 Roles (`/api/roles`)

| Method | Endpoint | Roles | Request / Response & Business Rules | Audit Action |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/roles` | `Administrador` | Returns `200` list of `{ id, nombre }`. | None |

### 8.7 Audit Log (`/api/bitacora`)

| Method | Endpoint | Roles | Request / Response & Business Rules | Audit Action |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/bitacora` | `Administrador` | Returns `200` list of `{ bitacoraId, accion, elementoid, ip, usuario, fecha }` ordered by `id DESC`. | None |

---

## 9. OpenAPI 3.0.3 & C# Client Integration Contract

Because a **C# / .NET client** consumes this API, the OpenAPI specification is a first-class contract—not an afterthought.

### 9.1 OpenAPI Generation Rules (`src/config/openapi.ts`)
* **Version:** Emit **OpenAPI `3.0.3`** (using `OpenApiGeneratorV3` from `@asteasolutions/zod-to-openapi`) for maximum compatibility across **Microsoft Kiota**, **Refitter (Refit)**, and **NSwag**.
* **Explicit `operationId`:** Every registered route must declare a clean, PascalCase `operationId` (e.g., `GetProductos`, `CreateCategoria`, `AssignProductoCategoria`) so generated C# methods have clean names.
* **Named Component Schemas:** Register all DTOs via `.openapi('ProductoDto')`, `.openapi('CategoriaDto')`, `.openapi('LoginRequest')`, etc., so C# generators emit clean POCO classes instead of anonymous `Anonymous1` types.
* **Security Scheme:** Register `bearerAuth` (`type: 'http'`, `scheme: 'bearer'`, `bearerFormat: 'JWT'`) globally and apply it to all protected routes.
* **Binary & Multipart Endpoints:**
  * `POST /api/archivos` & `PUT /api/archivos/:id`: declare `multipart/form-data` with `file` (`type: 'string'`, `format: 'binary'`).
  * `GET /api/archivos/:id`: declare `200` response with `image/jpeg` (`type: 'string'`, `format: 'binary'`).
* **Documentation Routes:**
  * `GET /openapi.json` → Raw OpenAPI 3.0.3 JSON document (consumed by C# generators).
  * `GET /swagger` → `swagger-ui-express` pointing to `/openapi.json`.
  * `GET /docs` → `@scalar/express-api-reference` pointing to `/openapi.json`.

### 9.2 C# Client Generation & Auth Handling
* **Recommended SDK Generator:** **Microsoft Kiota** (`kiota generate -l CSharp -d http://localhost:3000/openapi.json -c BackendApiClient -n Backend.Client -o ./Client`) or **Refitter**.
* **Sliding JWT Refresh (`DelegatingHandler`):** The C# `HttpClient` pipeline must register a `DelegatingHandler` that:
  1. Attaches `Authorization: Bearer <token>` on every outgoing request (except `POST /api/auth` and `GET /api/archivos/:id`).
  2. Inspects every incoming `HttpResponseMessage.Headers` for `Set-Authorization`.
  3. If present, atomically replaces the stored JWT token in the client's token store so active sessions never expire mid-workflow.
* **Decimal Precision:** `producto.precio` is serialized as a JSON number (or numeric string coerced to `number`) representing `DECIMAL(10,2)` so C# maps it cleanly to `decimal`/`double`.

---

## 10. Development Commands & Agent Verification Checklist

### NPM Scripts (`package.json`)
* `npm run dev` → `tsx watch src/index.ts` (development server with hot reload)
* `npm run build` → `tsc` (compiles TypeScript to `dist/`)
* `npm start` → `node dist/index.js` (production start)
* `npm run typecheck` → `tsc --noEmit` (**mandatory gate for all agents before completing any task**)
* `npm run db:pull` → `drizzle-kit pull` (introspects existing MySQL schema)
* `npm run db:seed` → `tsx src/db/seed.ts` (populates initial catalog & users)

### Agent Guardrails & Definition of Done
Before any agent marks a task complete, it must verify:
1. `npm run typecheck` passes with **zero** TypeScript errors.
2. All routes have matching Zod schemas registered in `src/config/openapi.ts` and render cleanly at `/openapi.json`, `/swagger`, and `/docs`.
3. Every mutating endpoint (`POST`, `PUT`, `DELETE`, and `POST /api/auth`) calls `await req.bitacora(...)` with the exact action string defined in Section 8.
4. `authorize(...)` runs **before** `upload.single("file")` on file upload/update endpoints.
5. No sensitive files (`.env`, `restclient/`, `*.sql`, `uploads/`, `log/log.txt`) are tracked in Git.