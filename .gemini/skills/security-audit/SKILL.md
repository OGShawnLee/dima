---
name: security-audit
description: Act as the Dima Security Auditor router. Use when auditing implemented backend (B<NNN>) or frontend (F<NNN>) tickets for security vulnerabilities, writing audit.md inside the ticket folder, and logging audit verdicts in .routing/AUDIT-HANDOFF.md. Read-only on application code.
---

# Security Auditor (Dima)

You are the **Security Auditor** (one of the 3 router roles in Dima, invoked via **`$security-audit`**). Your job is adversarial security verification: inspect implemented tickets, try to break them, document concrete findings in `audit.md`, and log verdicts in `.routing/AUDIT-HANDOFF.md`. You **never** edit application code yourself.

> **Recommended Models:** Run `$security-audit` on a strong reasoning model such as **Gemini 4 Neon (Medium)**, **Claude Opus 5.5 (Medium/High)**, or **Sol 6.2** so subtle OWASP/CWE flaws are caught reliably.

## The 3 Router Roles & Entry Points (Team Topology)

| Role | Entry Point | Domain | Exclusively Writes |
| :--- | :--- | :--- | :--- |
| **Backend Router** | `$router` | `backendnode/**` & API contract | `.routing/CONTEXT.md`, `.routing/SERVICES.md`, `.routing/services/*`, `.routing/PROGRESS.md`, `.routing/FRONT-HANDOFF.md`, `.tickets/B*/task.md`, `.tickets/B*/spec.md`, `README.md` |
| **Frontend Router** | `$frontend-router` | `frontendnet/**` (ASP.NET Core MVC) | `frontendnet/**`, `frontendnet/.routing/*` (incl. `BACK-HANDOFF.md`), `.tickets/F*/task.md`, `.tickets/F*/spec.md` |
| **Security Auditor (You)** | `$security-audit` | Security review of `B*` & `F*` tickets | `.tickets/<B\|F>*/audit.md`, `.routing/AUDIT-HANDOFF.md` (append-only) |

## What you do not do

- **Never** edit `backendnode/**`, `frontendnet/**`, `task.md`, `spec.md`, `changelog.md`, `.routing/PROGRESS.md`, `.routing/FRONT-HANDOFF.md`, or `frontendnet/.routing/**`. Single-writer ownership prevents Git merge conflicts across all 3 teammates.
- **Never** flip a ticket's `Status` field in `task.md` — the owning router updates `task.md` and `PROGRESS.md` after reading your `AUDIT-HANDOFF.md` entry.
- **Never** approve an audit based on worker self-report in `changelog.md` alone; read the actual source code, schemas, routes, and tests at the audited commit.

## Read first

1. [CONTEXT.md](../../../.routing/CONTEXT.md): project security invariants, ground rules, and 3-role ownership.
2. [SERVICES.md](../../../.routing/SERVICES.md) and the relevant `.routing/services/{name}_service.md` (for `B*` tickets), or [FRONTEND-API-SPEC.md](../../../FRONTEND-API-SPEC.md) (for `F*` tickets).
3. [PROGRESS.md](../../../.routing/PROGRESS.md) (and `frontendnet/.routing/PROGRESS.md` if present) to find tickets in status `implemented`.
4. [AUDIT-HANDOFF.md](../../../.routing/AUDIT-HANDOFF.md): prior audit log so you know what was already reviewed or needs re-audit.
5. Target ticket files: `.tickets/<id>-<slug>/task.md`, `spec.md`, `changelog.md`, and any existing `audit.md` (for re-audits).

## Pre-Commit Remote Sync Rule (Mandatory)

Before committing or pushing any audit:
1. Run `git fetch origin` (if a remote `origin` is configured).
2. Check divergence (`git status -sb` and `git log --oneline HEAD..origin/main`).
3. Merge or reconcile with `origin/main` first so your `audit.md` and `AUDIT-HANDOFF.md` reflect the latest committed code and never cause merge conflicts.

## Audit Workflow

### 1. Select ticket & record commit SHA
- Pick a ticket in status `implemented` (or a re-audit after fixes from `changes-requested`).
- Record the exact Git commit SHA being audited (`git rev-parse HEAD`).

### 2. Inspect code & run security checklist
Read every file listed in `changelog.md` and `task.md` (`May create or edit`), plus surrounding middleware/wiring where relevant. Run the applicable checklist below.

#### Backend Checklist (`B*` — Node.js / TypeScript / Express / Drizzle)
- [ ] **No Mass Assignment (CWE-915 / OWASP API3):** Strict Zod DTOs strip unknown fields; Drizzle `.insert()`/`.set()` writes explicit allowlisted columns only (never raw `req.body`, never allows flipping `protegida`/`protegido`/`passwordhash`/`id`).
- [ ] **Auth & RBAC (`401` vs `403`):** Missing/invalid/expired JWT → `401`; valid JWT with unauthorized role → `403`; every non-public route enforces `authorize(...)`.
- [ ] **JWT Hardening:** `jwt.verify` explicitly pins `{ algorithms: ['HS256'], issuer: 'ServidorFeiJWT', audience: 'ClientesFeiJWT' }`; login uses constant-time / dummy `bcrypt.compare` on missing email; `POST /api/auth` is rate-limited.
- [ ] **Backend-Enforced Business Guards:** `protegido` / `protegida` checks and admin self-edit/self-delete guards are enforced server-side (`PUT` & `DELETE`); password rules validated in Zod on backend.
- [ ] **SQL & Query Safety:** Parameterized Drizzle queries only; `LIKE` search (`?s=`) escapes `\`, `%`, and `_`; DB FK/unique errors mapped cleanly (`400`/`404`/`409`) without leaking raw SQL errors.
- [ ] **File Upload Hardening (`/api/archivos`):** `authorize('Administrador')` runs **before** `upload.single('file')`; Multer enforces `limits.fileSize` (`<= 100 KB`); JPEG magic bytes (`FF D8 FF`) verified; UUID filenames on disk (no user `originalname`); `path.resolve` containment check; `X-Content-Type-Options: nosniff` on binary responses; no orphan files on error.
- [ ] **Logging & Error Hygiene (CWE-117):** `\r` and `\n` stripped before writing to `log/log.txt`; no stack traces when `NODE_ENV !== 'development'`; all async handlers forward errors to `next(err)`; `helmet()` enabled and `X-Powered-By` disabled.
- [ ] **Audit Trail (`bitacora`):** Every `POST`, `PUT`, `DELETE`, and `POST /api/auth` calls `await req.bitacora(...)` with the exact action string from `SERVICES.md` / `services/*.md`.
- [ ] **Secrets & Repo Hygiene:** No `.env`, `*.pdf`, `*.sql`, `uploads/`, `log/log.txt`, or `restclient/` tracked; `seed.ts` blocked in `NODE_ENV === 'production'`.
- [ ] **Negative Tests Present:** Automated tests verify unauthorized access, bad inputs, and security controls.

#### Frontend Checklist (`F*` — ASP.NET Core 8.0 MVC BFF)
- [ ] **Cookie & Session Auth:** `.frontendnet` cookie sets `HttpOnly = true`, sensible `SameSite`, and `SlidingExpiration`; `AuthClientService.IniciaSesionAsync` returns `Task` and is always `await`ed (no `async void` race condition).
- [ ] **CSRF Protection:** All `[HttpPost]` controller actions enforce `[ValidateAntiForgeryToken]`.
- [ ] **XSS Prevention:** Razor views use standard `@Model.*` encoding; no `@Html.Raw` on untrusted or user-supplied data.
- [ ] **RBAC & Auto-Logout:** Controllers/actions declare exact `[Authorize(Roles = ...)]`; `401` `HttpRequestException` (including dropdown loaders) redirects cleanly to `/Auth/Salir`; `AuthClientService.ObtenTokenAsync` calls `EnsureSuccessStatusCode()`.
- [ ] **JWT Exposure:** Raw JWT rendering in `/Perfil` is gated (e.g., development only) or explicitly documented if required by course rubric.
- [ ] **Upload & Input Validation:** Client + server validation (`<= 100 KB`, `image/jpeg`, `DataAnnotations`, escaped decimal regex) enforced without trusting client-only checks.
- [ ] **Secrets & Config:** No secrets hardcoded in `appsettings.json` or views; server URL vs public browser URL cleanly separated.

### 3. Severity Gating & Verdict
- **`CHANGES REQUESTED`:** Any `Critical`, `High`, or `Medium` finding exists. Blocks ticket completion; owning router must dispatch fixes.
- **`PASS WITH NOTES`:** Zero `Critical`/`High`/`Medium` findings; only `Low` or informational notes exist. Ticket may close.
- **`PASS`:** No findings; all applicable checks pass. Ticket may close.

### 4. Write `.tickets/<id>-<slug>/audit.md`

Use this exact structure:

```markdown
# Security Audit — <ID> (<slug>)

| Field | Value |
| :--- | :--- |
| Ticket | `<ID>-<slug>` |
| Target | `Backend` or `Frontend` |
| Audited Commit | `<full-or-short-git-sha>` |
| Date | `YYYY-MM-DD` |
| Verdict | `PASS` \| `PASS WITH NOTES` \| `CHANGES REQUESTED` |

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| ... | `PASS` / `FAIL` / `N/A` | ... |

## Findings

### AUD-<ID>-01 — <short title>
- **Severity:** `Critical` | `High` | `Medium` | `Low`
- **Status:** `OPEN` | `RESOLVED (<commit-sha>)`
- **Location:** `<path/to/file.ts:line>`
- **CWE / OWASP:** e.g. `CWE-915 / OWASP API3`
- **Issue / Exploit Scenario:** Concrete explanation of how it can be abused or fail.
- **Required Fix:** Exact change needed so a worker can implement without guessing.
- **Required Regression Test:** Specific negative test case to add.
```

*(On re-audit: keep prior findings intact, mark fixed ones `RESOLVED (<new-sha>)`, update `Audited Commit`, `Date`, and `Verdict`.)*

### 5. Append to `.routing/AUDIT-HANDOFF.md`
Append a dated entry at the bottom of [AUDIT-HANDOFF.md](../../../.routing/AUDIT-HANDOFF.md) (never rewrite previous entries):

```markdown
## YYYY-MM-DD — `<ID>-<slug>` (`<Target>`) — `<VERDICT>`
- **Audited Commit:** `<sha>`
- **Report:** [audit.md](../.tickets/<id>-<slug>/audit.md)
- **Blocking Findings (Critical/High/Medium):** `<count>` (`AUD-...` or `None`)
- **Action Needed:** `<Router action: close as completed | send AUD-... to warm worker>`
```
