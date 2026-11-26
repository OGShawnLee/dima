# Dima — Project Context

## Overview

- **Project:** Dima (Secure Programming course project)
- **Components:** `backendnode/` (Node.js/TS/Express/Drizzle/MySQL API) and `frontendnet/` (ASP.NET Core 8.0 MVC BFF)
- **Team:** 3 members operating under **3 distinct Router Roles**
- **Domain:** E-Commerce / Product Catalog Management (Products, Categories, Users, Roles, Files, Audit Log)
- **Source of Truth:** **The backend (`backendnode`) is the single source of truth** for validation, authorization, business rules, and the OpenAPI 3.0.3 API contract (`/openapi.json`). Frontend clients consume the backend contract and are never trusted to enforce security controls.

---

## The 3 Router Roles & Single-Writer Ownership

To prevent GitHub merge conflicts across 3 teammates working concurrently, every routing file and ticket artifact has **exactly one writer**:

| Role | Entry Point | Member Focus | Skill | Exclusively Writes | Reads From Others |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend Router** | `$router` | Coordinates `backendnode/**`, schema, OpenAPI contract, and `B`-tickets | [router](../.gemini/skills/router/SKILL.md) | `.routing/CONTEXT.md`, `.routing/SERVICES.md`, `.routing/services/*`, `.routing/PROGRESS.md`, `.routing/FRONT-HANDOFF.md`, `.tickets/B*/task.md`, `.tickets/B*/spec.md`, `README.md` | `.routing/AUDIT-HANDOFF.md`, `.tickets/B*/audit.md`, `.tickets/B*/changelog.md`, `frontendnet/.routing/BACK-HANDOFF.md` |
| **Frontend Router** | `$frontend-router` | Coordinates `frontendnet/**` (ASP.NET Core MVC) and `F`-tickets | [frontend-router](../.gemini/skills/frontend-router/SKILL.md) | `frontendnet/**`, `frontendnet/.routing/*` (`CONTEXT.md`, `PROGRESS.md`, `BACK-HANDOFF.md`), `.tickets/F*/task.md`, `.tickets/F*/spec.md` | `.routing/PROGRESS.md`, `.routing/SERVICES.md`, `.routing/FRONT-HANDOFF.md`, `.routing/AUDIT-HANDOFF.md`, `.tickets/F*/audit.md` |
| **Security Auditor** | `$security-audit` | Audits implemented `B*` and `F*` tickets for vulnerabilities | [security-audit](../.gemini/skills/security-audit/SKILL.md) | `.tickets/<B\|F>*/audit.md`, `.routing/AUDIT-HANDOFF.md` (append-only) | `backendnode/**`, `frontendnet/**`, `.routing/*`, `frontendnet/.routing/*`, `.tickets/<B\|F>*/task.md`, `spec.md`, `changelog.md` |

*Implementation workers* only edit source files explicitly listed in their ticket's `May create or edit` plus `.tickets/<id>/changelog.md`.

### Agent Model Policy

| Agent Role | Entry Point | Recommended Model | Rationale |
| :--- | :--- | :--- | :--- |
| **Backend Implementation Workers** | _(dispatched via `$ticket`)_ | **Gemini 4 Hydrogen (Medium)** | Project scope is cleanly modularized in `.routing/services/*.md`; fast, cost-effective execution for well-specced CRUD/Drizzle/Zod tickets. |
| **Backend Router** | `$router` | Higher-reasoning model (owner choice) | Architecture decisions, contract integrity, and local verification. |
| **Frontend Router** | `$frontend-router` | Higher-reasoning model (owner choice) | ASP.NET Core MVC BFF coordination, contract alignment, and verification. |
| **Security Auditor** | `$security-audit` | **Gemini 4 Neon (Medium)**, **Claude Opus 5.5 (Medium/High)**, or **Sol 6.2** | Strong adversarial reasoning to catch subtle OWASP/CWE flaws missed during implementation. |

---

## Backend Stack (`backendnode/`)

- **Runtime & Language:** Node.js v20+ (LTS), TypeScript `^5.x` (`strict: true`)
- **Web Framework:** Express `^4.19.2`, `cors`, `helmet`, `express-rate-limit`
- **Database & ORM:** MySQL 8.0 (`utf8mb4`), Drizzle ORM (`mysql2` pool), `drizzle-kit`
- **Validation & Contract:** Zod, `drizzle-zod`, `@asteasolutions/zod-to-openapi` (OpenAPI 3.0.3), `swagger-ui-express` (`/swagger`), `@scalar/express-api-reference` (`/docs`)
- **Security & Auth:** `bcrypt` (cost 10), `jsonwebtoken` (`HS256`, WS-Federation claim URIs, 20m TTL, <5m sliding refresh via `Set-Authorization`)
- **Uploads & Audit:** `multer` (JPG only, hardened), `request-ip`, database-persisted `bitacora`, file-based error log (`log/log.txt`)
- **Testing:** Vitest + Supertest (unit, contract, and security regression tests)

## Key Reference Documents

| File | Purpose |
| :--- | :--- |
| [README.md](../README.md) | Root project overview, 3 router roles, workflow guide, and documentation index |
| [BACKEND-API-SPEC.md](../BACKEND-API-SPEC.md) | Primary backend specification (structure, DB schema, endpoints, OpenAPI rules) |
| [FRONTEND-API-SPEC.md](../FRONTEND-API-SPEC.md) | Reference consumer contract (`frontendnet` ASP.NET Core 8.0 MVC) |
| [STACK-REVIEW-COMMUNICATION.md](../STACK-REVIEW-COMMUNICATION.md) | Stack evaluation, cross-stack risks, and runtime sequence diagrams |
| [.routing/SERVICES.md](SERVICES.md) | Service routing index mapping each domain (`services/{name}_service.md`) to SQL, Zod, endpoints, and TS interfaces |
| [.routing/PROGRESS.md](PROGRESS.md) | Tracker for completed work, active tickets, pending security/contract items, and roadmap |
| [.routing/FRONT-HANDOFF.md](FRONT-HANDOFF.md) | One-way outbox from Backend → Frontend for contract and OpenAPI updates |
| [.routing/AUDIT-HANDOFF.md](AUDIT-HANDOFF.md) | One-way outbox from Security Auditor → Backend & Frontend with audit verdicts |

## Repo Map

```text
dima/
├── AGENTS.md                    # Universal agent pointer to README, CONTEXT, and skills
├── README.md                    # Onboarding, 3 router roles, workflow, doc routing
├── .gemini/skills/
│   ├── router/SKILL.md          # Backend Router entry point ($router)
│   ├── frontend-router/SKILL.md # Frontend Router entry point ($frontend-router)
│   ├── security-audit/SKILL.md  # Security Auditor entry point ($security-audit)
│   └── ticket/SKILL.md          # Backend B-ticket creation & lifecycle skill ($ticket)
├── .routing/                    # Backend-owned routing + Auditor outbox (COMMITTED)
│   ├── CONTEXT.md               # This file: roles, stack, security invariants, gates
│   ├── PROGRESS.md              # Live backend status & pending items
│   ├── SERVICES.md              # Service routing index + glossary + shared types
│   ├── FRONT-HANDOFF.md         # Outbox: Backend -> Frontend (Backend-only write)
│   ├── AUDIT-HANDOFF.md         # Outbox: Auditor -> All (Auditor-only write)
│   └── services/                # Per-domain service specs (SQL, Zod, endpoints, TS interface)
├── .tickets/                    # Unified ticket store (COMMITTED): B<NNN>-* and F<NNN>-*
├── BACKEND-API-SPEC.md
├── FRONTEND-API-SPEC.md
├── STACK-REVIEW-COMMUNICATION.md
├── backendnode/                 # Backend implementation (Backend Router domain)
│   ├── src/
│   │   ├── config/              # env.ts, claimtypes.ts, openapi.ts
│   │   ├── controllers/
│   │   ├── db/                  # index.ts, schema.ts, seed.ts
│   │   ├── middlewares/         # auth, bitacora, errorhandler, upload, validate
│   │   ├── routes/
│   │   ├── schemas/             # Zod DTOs & OpenAPI component schemas
│   │   ├── services/            # Per-domain service implementations + jwttoken.service.ts
│   │   ├── types/               # express.d.ts
│   │   └── index.ts
│   ├── tests/                   # Automated API & security tests
│   ├── drizzle/                 # Drizzle SQL migrations (if managed locally)
│   ├── log/                     # Runtime error logs (GITIGNORED)
│   └── uploads/                 # Uploaded JPG files when FILES_IN_BD=false (GITIGNORED)
└── frontendnet/                 # Frontend implementation (Frontend Router domain)
    └── .routing/                # Miniature frontend routing dir (CONTEXT.md, PROGRESS.md, BACK-HANDOFF.md)
```

## Ground Rules & Security Invariants

1. **Backend is the source of truth:** Never rely on the frontend for input validation, file size/type checks, self-edit/self-delete prevention, or RBAC.
2. **Strict TypeScript:** `strict: true`, zero `any`. Augment `Express.Request` in `src/types/express.d.ts` for `decodedToken` and `bitacora`.
3. **Schema-driven OpenAPI 3.0.3:** Define request/response schemas once with Zod and register every route in `src/config/openapi.ts` with PascalCase `operationId` and named component schemas.
4. **Middleware ordering:**
   - Security headers (`helmet`) and body limits before routes.
   - `authorize(...)` **always** runs before `upload.single("file")` so unauthenticated/unauthorized requests never touch disk or memory buffers.
   - `errorHandler` is always registered last.
5. **Audit logging:** Every mutating endpoint (`POST`, `PUT`, `DELETE`, and `POST /api/auth`) must call `await req.bitacora(...)` with the exact documented action string.
6. **Defense in depth:**
   - Pin JWT `algorithms: ['HS256']`, `issuer`, and `audience` on verification.
   - Validate uploaded files by size limit, MIME/extension, **and** JPEG magic bytes (`FF D8 FF`); never use user-supplied `originalname` as a disk path.
   - Sanitize CRLF (`\r`, `\n`) before writing to `log/log.txt` (prevent CWE-117 log injection).
   - Never expose stack traces or raw DB errors when `NODE_ENV !== 'development'`.
7. **Git, Commits & Remote Reconciliation:**
   - **Conventional Commits only:** Every commit must use English Conventional Commits (`feat`, `fix`, `security`, `refactor`, `test`, `docs`, `chore`, optionally scoped like `feat(backend): ...`, `fix(frontend): ...`, `security(audit): ...`) followed by a **brief body overview of what changed**.
   - `.routing/` and `.tickets/` **are tracked in Git** so all 3 teammates stay synchronized.
   - **Pre-commit rule:** Before any commit, merge, or push, every router must check the remote repository (`git fetch origin`, inspect divergence, and merge/reconcile with `origin/main` first).
   - Never commit `.env`, `*.pdf`, `*.sql`, `restclient/`, `uploads/`, or `log/log.txt`. Guard `seed.ts` from executing in production.

## Verification Gates (Definition of Done)

Every backend ticket must pass before moving to `implemented`:

1. `npm run typecheck` (`tsc --noEmit`) exits `0` with zero errors.
2. `npm run build` (`tsc`) exits `0`.
3. `npm test` passes with `0` failures.
4. OpenAPI 3.0.3 output (`/openapi.json`) includes all added/modified routes with named schemas and `operationId`s.
5. Scope check (`git status` / `git diff --name-only`) touches only files permitted by the ticket (plus `changelog.md`).

A ticket moves from `implemented` → **`completed`** only after the **Security Auditor** logs `PASS` or `PASS WITH NOTES` in `.tickets/<id>/audit.md` and `.routing/AUDIT-HANDOFF.md`.

## Backend Parallel Workstream Tracks (For Worker Concurrency)

Inside `backendnode/`, tickets are grouped into 3 logical module lanes so independent backend workers can run in parallel without file collisions:

| Track | Backend Modules |
| :--- | :--- |
| **Track A — Auth, Security & Audit** | `env.ts`, `helmet`/rate-limit, `jwttoken.service.ts`, `auth.middleware.ts`, `bitacora.middleware.ts`, `errorhandler.middleware.ts`, `/api/auth`, `/api/usuarios`, `/api/roles`, `/api/bitacora` |
| **Track B — Catalog Domain & DB** | `src/db/index.ts`, `schema.ts`, `seed.ts`, Docker/MySQL setup, `/api/categorias`, `/api/productos` (search + M:N category mappings) |
| **Track C — Files, OpenAPI & Tests** | Hardened `upload.middleware.ts`, `/api/archivos` (disk & `LONGBLOB`), `src/config/openapi.ts` (`/openapi.json`, `/swagger`, `/docs`), Vitest + Supertest contract & security test suite |
