# B001 — Project Scaffold & Core Security Pipeline

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B001` | `completed` | `Gemini 4 Hydrogen (Medium)` | `Shared` | Shared foundation (`common.schema`, `env`, `claimtypes`, `app`, `errorhandler`, `validate`) | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-001` — TypeScript (`strict: true`) + Express 4 + Zod + OpenAPI 3.0.3 foundation (`zod@^3.24.2`, `@asteasolutions/zod-to-openapi@^7.3.0`).
- `DEC-009` — HTTP hardening (`helmet()`, `x-powered-by` disabled), `express.json({ limit: '100kb' })`, reusable `express-rate-limit` factory for `/api/auth`, CRLF-safe logging (`\r`/`\n` stripped before appending to `log/log.txt`, CWE-117), and no stack trace leakage outside `NODE_ENV === 'development'`.
- `DEC-010` — `ZodError` mapped cleanly to `400 Bad Request` with structured `detalles` (fixing PDF's `500` on validation errors) and method-agnostic `app.use(...)` `404` catch-all (fixing PDF's Express 5 `app.get('/*splat')`).
- Secret hygiene — `.env.example` contains placeholder values only (no real/default DB passwords or leaked JWT secrets).

## Scope

### May create or edit
- `backendnode/package.json`
- `backendnode/package-lock.json`
- `backendnode/tsconfig.json`
- `backendnode/vitest.config.ts`
- `backendnode/.env.example`
- `backendnode/src/config/env.ts`
- `backendnode/src/config/claimtypes.ts`
- `backendnode/src/types/express.d.ts`
- `backendnode/src/utils/httpError.ts`
- `backendnode/src/schemas/common.schema.ts`
- `backendnode/src/middlewares/validate.middleware.ts`
- `backendnode/src/middlewares/errorhandler.middleware.ts`
- `backendnode/src/middlewares/ratelimit.middleware.ts`
- `backendnode/src/app.ts`
- `backendnode/src/index.ts`
- `backendnode/tests/core.test.ts`
- `.tickets/B001-project-scaffold/changelog.md`

### Must not touch
- Any file outside `backendnode/**` and `.tickets/B001-project-scaffold/changelog.md`
- `.routing/**`
- `.gemini/**`
- `frontendnet/**`
- `.tickets/B001-project-scaffold/task.md`, `spec.md`, or `audit.md`
- Do **not** create database schema (`src/db/**`) or domain route/controller/service files (`auth`, `usuarios`, `roles`, `categorias`, `productos`, `archivos`, `bitacora`) — those belong to `B002`–`B006`.

## Inputs

Read these files first before writing code:
1. [.routing/CONTEXT.md](../../.routing/CONTEXT.md)
2. [.routing/DECISION.md](../../.routing/DECISION.md) (`DEC-001`, `DEC-009`, `DEC-010`)
3. [.routing/SERVICES.md](../../.routing/SERVICES.md) (`Shared Types & Conventions`, `Standard HTTP Status Policy`, `Security Invariants`)
4. [BACKEND-API-SPEC.md](../../BACKEND-API-SPEC.md) (Sections 2, 3, 4, 6, 7.3, 10)

## Task

1. Create `backendnode/package.json` with:
   - Production dependencies: `express` (`^4.19.2`), `drizzle-orm`, `mysql2`, `zod` (`^3.24.2`), `drizzle-zod`, `@asteasolutions/zod-to-openapi` (`^7.3.0`), `swagger-ui-express`, `@scalar/express-api-reference`, `dotenv`, `cors`, `helmet`, `express-rate-limit`, `bcrypt`, `jsonwebtoken`, `multer`, `request-ip`.
   - Dev dependencies: `typescript`, `tsx`, `drizzle-kit`, `vitest`, `supertest`, `@types/node`, `@types/express`, `@types/cors`, `@types/bcrypt`, `@types/jsonwebtoken`, `@types/multer`, `@types/swagger-ui-express`, `@types/supertest`.
   - Scripts: `dev` (`tsx watch src/index.ts`), `build` (`tsc`), `start` (`node dist/index.js`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `db:generate` (`drizzle-kit generate`), `db:push` (`drizzle-kit push`), `db:pull` (`drizzle-kit pull`), `db:seed` (`tsx src/db/seed.ts`).
2. Run `npm install` inside `backendnode/` to generate `backendnode/package-lock.json`.
3. Create `backendnode/tsconfig.json` (`target: "ES2022"`, `module: "CommonJS"`, `moduleResolution: "node"`, `strict: true`, `esModuleInterop: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`, `rootDir: "src"`, `outDir: "dist"`, `include: ["src/**/*.ts"]`) and `backendnode/vitest.config.ts` (Node environment, matching `tests/**/*.test.ts`).
4. Create `backendnode/.env.example` containing placeholder-only values for `DB_HOST`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, `SERVER_PORT`, `NODE_ENV`, `JWT_SECRET`, `FILES_IN_BD`, `CORS_ORIGINS`, `TRUST_PROXY` (never include real or default course passwords).
5. Create `backendnode/src/config/env.ts` exporting `parseEnv(source: NodeJS.ProcessEnv)` (Zod-validated fail-fast parser with `JWT_SECRET` min 32 chars, `FILES_IN_BD` `'true'|'false'` → boolean, `DB_PORT`/`SERVER_PORT` coerced positive ints, `NODE_ENV` enum `'development'|'test'|'production'`, `CORS_ORIGINS` comma-separated string → `string[]` defaulting to `['http://localhost:8080', 'http://localhost:8081']`, `TRUST_PROXY` `'true'|'false'` → boolean defaulting to `false`) and a lazy/cached `getEnv()` + `env` export that loads `.env` via `dotenv/config` cleanly without crashing unit tests that call `parseEnv(...)`.
6. Create `backendnode/src/config/claimtypes.ts` with the exact WS-Federation claim URI constants (`Name`, `GivenName`, `Role`) from `BACKEND-API-SPEC.md` §6.
7. Create `backendnode/src/types/express.d.ts` declaring `DecodedTokenPayload` (extending `JwtPayload` with the 3 `ClaimTypes` string keys, `Role` typed as `RoleName`) and augmenting `Express.Request` with `decodedToken?: DecodedTokenPayload` and `bitacora: (accion: string, elementoid?: string | number | null) => Promise<void>`.
8. Create `backendnode/src/utils/httpError.ts` exporting `HttpError` (`statusCode: number`, optional `detalles?: Array<{ path: string; message: string }>`) and clean helper constructors (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`).
9. Create `backendnode/src/schemas/common.schema.ts` calling `extendZodWithOpenApi(z)` once and exporting `RoleNameSchema`, `RoleName`, `NumericIdParamSchema`, `ErrorResponseSchema`, and `AuditContext` matching `.routing/SERVICES.md`.
10. Create `backendnode/src/middlewares/validate.middleware.ts` exporting `validate({ body?, params?, query? })` middleware that validates with Zod (`safeParse`), replaces `req.body`/`req.params`/`req.query` with the parsed strict output (stripping unknown keys), and forwards `ZodError` to `next(err)` on failure.
11. Create `backendnode/src/middlewares/ratelimit.middleware.ts` exporting `createAuthRateLimiter(options?)` built on `express-rate-limit` (default window 15 minutes, max 10 requests, standard headers, JSON `{ mensaje: 'Demasiados intentos de inicio de sesión. Inténtelo nuevamente más tarde.' }` on `429`) ready for `B003` to mount on `POST /api/auth`.
12. Create `backendnode/src/middlewares/errorhandler.middleware.ts` exporting `sanitizeLogField(value: string)` and `createErrorHandler(options?: { logFilePath?: string; nodeEnv?: string })` plus default `errorHandler`:
    - Maps `HttpError` → `err.statusCode`, `ZodError` → `400` with `detalles`, malformed JSON `SyntaxError` (`status === 400`) → `400`, Multer `LIMIT_FILE_SIZE` → `400`, unknown errors → `500` (`'No se ha podido procesar la petición. Inténtelo nuevamente más tarde.'`).
    - Strips `\r`, `\n`, and `\t` from `ip`, `email`, and error message before appending `<ISO Date> - <statusCode> - <ip> - <email> - <message>\n` to `logFilePath` (ensuring parent directory exists).
    - Sends `{ status, mensaje, stack, ...(detalles ? { detalles } : {}) }` when `nodeEnv === 'development'`, else `{ mensaje, ...(detalles ? { detalles } : {}) }` (never leaking `stack` or raw DB errors outside development).
13. Create `backendnode/src/app.ts` exporting `createApp(options?: { corsOrigins?: string[]; trustProxy?: boolean; nodeEnv?: string; logFilePath?: string; registerRoutes?: (app: Express) => void })`:
    - Applies `app.disable('x-powered-by')`, optional `app.set('trust proxy', ...)`, `helmet()`, `express.json({ limit: '100kb' })`, `express.urlencoded({ extended: false, limit: '100kb' })`, and `cors({ origin, methods: 'GET,PUT,POST,DELETE', exposedHeaders: ['Set-Authorization'] })`.
    - Mounts `GET /health` returning `200` `{ status: 'ok' }`.
    - Calls optional `registerRoutes(app)` hook (for tests and future route mounting).
    - Mounts catch-all `app.use((_req, res) => { res.status(404).send('Recurso no encontrado'); })` across all HTTP methods.
    - Mounts `createErrorHandler(...)` **last**.
14. Create `backendnode/src/index.ts` that validates env via `getEnv()`, ensures `log/` and `uploads/` directories exist (`fs.mkdirSync(..., { recursive: true })`), instantiates `createApp(...)`, and starts listening on `env.SERVER_PORT`.
15. Create `backendnode/tests/core.test.ts` (targeted test file for this ticket) using Vitest + Supertest covering:
    - `parseEnv` fail-fast on missing `JWT_SECRET` / short `JWT_SECRET` and correct parsing of `FILES_IN_BD` (`'true'`/`'false'`).
    - Security headers: `X-Powered-By` absent, `X-Content-Type-Options: nosniff` present from `helmet()`.
    - CORS: allowed origin receives `Access-Control-Expose-Headers: Set-Authorization`; disallowed origin does not receive `Access-Control-Allow-Origin`.
    - Body size limit: JSON payload `> 100kb` rejected with `413`.
    - `validate` middleware: valid payload passes with unknown fields stripped (mass-assignment defense); invalid payload returns `400` with `detalles` (not `500`).
    - Catch-all `404`: unknown paths return `404` (`'Recurso no encontrado'`) for `GET`, `POST`, `PUT`, and `DELETE`.
    - `errorHandler`: `NODE_ENV=development` includes `stack`; `NODE_ENV=production` omits `stack` and internal error details on `500`.
    - CRLF log injection test (`CWE-117`): an error whose message contains `\r\nFAKE LOG LINE` writes a **single** sanitized line to a temporary log file (zero injected newline).
    - `createAuthRateLimiter`: returns `429` after exceeding configured max requests.
16. Run `npx vitest run tests/core.test.ts` while iterating, then run the full verification suite (`npm run typecheck`, `npm run build`, `npm test`) once before finishing.

## Verification

Follow every check in [spec.md](spec.md).

## Change log

Write `.tickets/B001-project-scaffold/changelog.md` listing:
- Exact files created/edited
- Exact verification commands run and their results
- Security checks verified (`helmet`, `100kb` cap, `validate` field stripping, CRLF sanitization, `429` rate limit, stack suppression in prod)
- Any warnings or blockers encountered (stop and log instead of guessing)
