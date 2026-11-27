# B002 — Database Schema (Drizzle) & Idempotent Seeder

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B002` | `completed` | `Gemini 4 Hydrogen (Medium)` | `Shared` | All 7 SQL entities (`rol`, `categoria`, `archivo`, `bitacora`, `usuario`, `producto`, `categoriaproducto`) | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-002` — Local MySQL 8.0 **schema-first** Drizzle layer (`src/db/schema.ts` as authoritative DDL for all 7 tables + `drizzle.config.ts` + lazy `mysql2` pool in `src/db/index.ts`).
- `DEC-002` — Production-guarded, idempotent `src/db/seed.ts` (refuses to run when `NODE_ENV === 'production'` so default course credentials can never be seeded in prod).
- Consolidating all 7 tables in `B002` prevents downstream merge conflicts across parallel service tickets (`B003`–`B006`).

## Scope

### May create or edit
- `backendnode/drizzle.config.ts`
- `backendnode/src/db/schema.ts`
- `backendnode/src/db/index.ts`
- `backendnode/src/db/seed.ts`
- `backendnode/tests/db.test.ts`
- `.tickets/B002-database-schema-seed/changelog.md`

### Must not touch
- `backendnode/package.json`, `package-lock.json`, `tsconfig.json`, `src/app.ts`, `src/index.ts`, or any middleware/schema file from `B001`
- `.routing/**`
- `.gemini/**`
- `frontendnet/**`
- `.tickets/B001-project-scaffold/**`
- `.tickets/B002-database-schema-seed/task.md`, `spec.md`, or `audit.md`
- Never stage or commit any `*.sql` files (must remain ignored per `.gitignore` and `BACKEND-API-SPEC.md` §10).

## Inputs

Read these files first before writing code:
1. [.routing/CONTEXT.md](../../.routing/CONTEXT.md)
2. [.routing/DECISION.md](../../.routing/DECISION.md) (`DEC-002`)
3. [.routing/SERVICES.md](../../.routing/SERVICES.md) (Dependency Layers 0 → 1 → 2)
4. All 7 service schema sections:
   - [.routing/services/roles_service.md](../../.routing/services/roles_service.md) (`rol`)
   - [.routing/services/categorias_service.md](../../.routing/services/categorias_service.md) (`categoria`)
   - [.routing/services/archivos_service.md](../../.routing/services/archivos_service.md) (`archivo`)
   - [.routing/services/bitacora_service.md](../../.routing/services/bitacora_service.md) (`bitacora`)
   - [.routing/services/usuarios_service.md](../../.routing/services/usuarios_service.md) (`usuario`)
   - [.routing/services/productos_service.md](../../.routing/services/productos_service.md) (`producto`, `categoriaproducto`)
5. [BACKEND-API-SPEC.md](../../BACKEND-API-SPEC.md) (Section 5 — Database Schema & Seed Data Requirements)

## Task

1. Create `backendnode/drizzle.config.ts` using `defineConfig` from `drizzle-kit` and `dotenv/config`:
   - `schema: './src/db/schema.ts'`
   - `out: './drizzle'`
   - `dialect: 'mysql'`
   - `dbCredentials` reading `DB_HOST`, `DB_PORT` (number), `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` from `process.env`.
2. Create `backendnode/src/db/schema.ts` defining all 7 exact singular MySQL tables in Layer order (`Layer 0` → `Layer 1` → `Layer 2`) plus Drizzle `relations(...)`:
   - **`rol`**: `id` (`varchar(36)` PK), `nombre` (`varchar(255)` NOT NULL `.unique()`), `createdAt` (`datetime` NOT NULL default `CURRENT_TIMESTAMP`), `updatedAt` (`datetime` NOT NULL default `CURRENT_TIMESTAMP` `.onUpdateNow()`).
   - **`categoria`**: `id` (`int` autoincrement PK), `nombre` (`varchar(255)` NOT NULL), `protegida` (`boolean` NOT NULL default `false`), `createdAt`, `updatedAt`.
   - **`archivo`**: `id` (`int` autoincrement PK), `mime` (`varchar(255)` NOT NULL), `nombre` (`varchar(255)` NOT NULL), `size` (`int` NOT NULL), `indb` (`boolean` NOT NULL default `true`), `datos` (`customType<{ data: Buffer }>({ dataType: () => 'longblob' })('datos')`, nullable), `createdAt`, `updatedAt`.
   - **`bitacora`**: `id` (`int` autoincrement PK), `accion` (`varchar(255)` NOT NULL), `elementoid` (`varchar(255)`, nullable), `ip` (`varchar(255)` NOT NULL), `usuario` (`varchar(255)` NOT NULL), `fecha` (`datetime` NOT NULL default `CURRENT_TIMESTAMP`), `createdAt`, `updatedAt`.
   - **`usuario`**: `id` (`varchar(36)` PK), `email` (`varchar(255)` NOT NULL `.unique()`), `passwordhash` (`varchar(255)` NOT NULL), `nombre` (`varchar(255)` NOT NULL), `protegido` (`boolean` NOT NULL default `false`), `rolid` (`varchar(36)` NOT NULL `.references(() => rol.id, { onUpdate: 'cascade', onDelete: 'cascade' })`), `createdAt`, `updatedAt`.
   - **`producto`**: `id` (`int` autoincrement PK), `titulo` (`varchar(255)` NOT NULL default `'Sin título'`), `descripcion` (`text` NOT NULL), `precio` (`decimal('precio', { precision: 10, scale: 2 })` NOT NULL), `archivoid` (`int`, nullable, `.references(() => archivo.id, { onUpdate: 'cascade', onDelete: 'set null' })`), `createdAt`, `updatedAt`.
   - **`categoriaproducto`**: `categoriaid` (`int` NOT NULL `.references(() => categoria.id, { onUpdate: 'cascade', onDelete: 'cascade' })`), `productoid` (`int` NOT NULL `.references(() => producto.id, { onUpdate: 'cascade', onDelete: 'cascade' })`), composite `primaryKey({ columns: [table.categoriaid, table.productoid] })`, `createdAt`, `updatedAt`.
   - Export Drizzle `relations(...)` for `rol`, `usuario`, `categoria`, `producto`, `categoriaproducto`, and `archivo`, plus inferred select/insert types for every table.
3. Create `backendnode/src/db/index.ts` exporting:
   - `createDbPool(config?)` creating a `mysql2/promise` pool (`charset: 'utf8mb4'`, `waitForConnections: true`, `connectionLimit: 10`, reading defaults from `getEnv()`).
   - `createDb(pool?)` wrapping the pool with `drizzle(pool, { schema, mode: 'default' })` and `export type DbClient = ReturnType<typeof createDb>`.
   - Lazy `getDb()` + `closeDb()` + lazy `db` Proxy so importing `src/db` in tests does not require `.env` or open live TCP connections until accessed.
4. Create `backendnode/src/db/seed.ts` exporting:
   - `assertSeedAllowed(nodeEnv: string): void` — throws an explicit `Error('Seeding is disabled in production environment.')` if `nodeEnv === 'production'`.
   - `SEED_ROLES`: `['Administrador', 'Usuario']` (as const).
   - `SEED_CATEGORIAS`: exact 15 protected categories (`id: 1..15`, `protegida: true`) from `BACKEND-API-SPEC.md` §5 (`Televisores`, `Celulares y tecnología`, `Laptops`, `Electrodomésticos`, `Hogar y muebles`, `Moda`, `Deportes`, `Construcción`, `Oficina`, `Juguetes`, `Bebés`, `Salud`, `Belleza`, `Videojuegos`, `Supermercado`).
   - `SEED_PRODUCTOS`: 15 initial Spanish e-commerce products (`id: 1..15`, `titulo`, `descripcion`, `precio` formatted as `DECIMAL(10,2)` string, `archivoid: null`) corresponding 1-to-1 with categories `1..15`.
   - `SEED_CATEGORIA_PRODUCTOS`: 15 1-to-1 mappings `{ productoid: 1..15, categoriaid: 1..15 }`.
   - `SEED_USERS`: `gvera@uv.mx` (`Guillermo Vera`, role `'Administrador'`, `protegido: true`) and `patito@uv.mx` (`Usuario patito`, role `'Usuario'`, `protegido: false`), default password `'patito'` hashed with `bcrypt.hash('patito', 10)`.
   - `runSeed(dbClient: DbClient, nodeEnv: string): Promise<void>` — calls `assertSeedAllowed(nodeEnv)` first, then performs idempotent inserts (`onDuplicateKeyUpdate` / existence checks so running repeatedly creates zero duplicates and preserves existing UUIDs for seeded roles/users).
   - Guard CLI execution with `if (require.main === module)` so importing `seed.ts` in tests does not connect to MySQL.
5. Create `backendnode/tests/db.test.ts` (targeted test file for this ticket) using Vitest + `getTableConfig` from `drizzle-orm/mysql-core` verifying:
   - Exact singular table names for all 7 tables (`rol`, `categoria`, `archivo`, `bitacora`, `usuario`, `producto`, `categoriaproducto`).
   - Column metadata: `archivo.datos` SQL type is `longblob`, `producto.precio` is `decimal(10, 2)`, `usuario.email` and `rol.nombre` have unique constraints, `categoriaproducto` has composite PK `(categoriaid, productoid)`.
   - All 4 foreign keys exist with exact reference targets and `onUpdate`/`onDelete` rules (`usuario.rolid → rol.id` cascade/cascade, `producto.archivoid → archivo.id` cascade/set null, `categoriaproducto.categoriaid → categoria.id` cascade/cascade, `categoriaproducto.productoid → producto.id` cascade/cascade).
   - `assertSeedAllowed('production')` throws; `'development'` and `'test'` succeed.
   - `SEED_CATEGORIAS` has exact 15 protected entries matching the spec list; `SEED_PRODUCTOS` has 15 entries with valid non-negative decimal prices; `SEED_CATEGORIA_PRODUCTOS` maps 1..15 1-to-1; `SEED_USERS` defines `gvera@uv.mx` (Admin, protected) and `patito@uv.mx` (Usuario, unprotected).
   - Importing `src/db/index.ts` without `.env` set does not throw or open connections eagerly.
6. Run `npx vitest run tests/db.test.ts` while iterating, then run the full gates once right before committing: `npm run typecheck`, `npm run build`, and `npm test`.

## Verification

Follow every check in [spec.md](spec.md).

## Change log

Write `.tickets/B002-database-schema-seed/changelog.md` listing:
- Exact files created/edited
- Exact verification commands run and their results
- Schema & security checks verified (all 7 tables, FKs, `longblob`, prod-seed block, idempotency)
- Any warnings or blockers encountered (stop and log instead of guessing)
