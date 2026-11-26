---
name: ticket
description: Create a Dima backend ticket (task.md and spec.md) in .tickets/B<NNN>-<slug>/. Use when a backend task must be handed to a worker agent. The ticket must route the worker via .routing/SERVICES.md and include unambiguous, executable verification checks.
---

# Ticket (Dima Backend)

A ticket is a folder in `.tickets/` tracked in Git so all 3 team roles (Backend Router, Frontend Router, Security Auditor) share visibility without merge conflicts.

## Prefix Convention (No Collisions)

- **`B`** = Backend (`backendnode`) — owned by Backend Router (`B001`, `B002`, ...).
- **`F`** = Frontend (`frontendnet`) — owned by Frontend Router (`F001`, `F002`, ...). Never create or modify `F` tickets from the backend router.

## Files Inside a Ticket Folder (Single-Writer Ownership)

| File | Owner | Purpose |
| :--- | :--- | :--- |
| `task.md` | Owning Router (`B` or `F`) | Scope, service inputs, numbered steps, and ticket `Status` |
| `spec.md` | Owning Router (`B` or `F`) | Deterministic verification commands and security/contract checklist |
| `changelog.md` | Implementation Worker | Files touched, tests run, security checks verified, fix commits, blockers |
| `audit.md` | Security Auditor (`security-audit` skill) | Adversarial security review, findings (`AUD-<ID>-<NN>`), and verdict |

## Ticket Status Lifecycle (5 States)

```text
draft ──▶ dispatched ──▶ implemented ──▶ changes-requested ──┐
                              │                  ▲            │
                              │ (audit PASS)     └────────────┘ (worker fixes & re-submits)
                              ▼
                          completed
```

- **`draft`:** Created by router, awaiting user approval before dispatch.
- **`dispatched`:** Handed to a worker agent.
- **`implemented`:** Worker finished and router verified build/typecheck/tests/scope; ready for Security Auditor.
- **`changes-requested`:** Security Auditor logged blocking findings (`Critical`/`High`/`Medium`) in `audit.md`; returned to warm worker (or fresh worker if stale) for fixes, then moves back to `implemented` for re-audit.
- **`completed`:** Security Auditor logged `PASS` or `PASS WITH NOTES` in `audit.md` + `AUDIT-HANDOFF.md`, and router closed the ticket in `PROGRESS.md`.

## Before writing: ask the user

If anything is unclear, **ask the user before writing the ticket**. Ask when:
- An API endpoint, DTO field, status code, or security rule is missing from [.routing/SERVICES.md](../../../.routing/SERVICES.md) and its target `.routing/services/{name}_service.md`.
- Database provisioning or migration behavior is uncertain.
- File boundaries (`May create or edit` / `Must not touch`) are uncertain.
- The task is too broad for one atomic deliverable or conflicts with [.routing/CONTEXT.md](../../../.routing/CONTEXT.md).

## Folder and naming

- Location: `.tickets/B<NNN>-<slug>/`
- `<NNN>`: next free three-digit number for prefix `B` (`001`, `002`, ...). Check `.tickets/` first.
- `<slug>`: lowercase words joined by hyphens naming the outcome.
- New tickets start with status `draft`.
- Examples: `.tickets/B001-project-scaffold/`, `.tickets/B003-auth-and-bitacora/`.

## `task.md`

Use this exact structure:

1. **Title:** `# B<NNN> — <short outcome>`
2. **Metadata table:**
   | ID | Status | Model | Track | Services | Spec |
   | :--- | :--- | :--- | :--- | :--- | :--- |
   | `B<NNN>` | `draft` | `Gemini 4 Hydrogen (Medium)` | `Shared` / `A` / `B` / `C` | e.g. `auth`, `bitacora` | [spec.md](spec.md) |
3. **Security & Contract Items Addressed:** exact bullet list of pending items from [.routing/PROGRESS.md](../../../.routing/PROGRESS.md) this ticket closes, or `N/A`.
4. **Scope**
   - **May create or edit:** exact file paths (e.g., `backendnode/src/services/auth.service.ts`, `backendnode/src/routes/auth.routes.ts`).
   - **Must not touch:** exact files or folders (always include unrelated services, `frontendnet/**`, `.routing/**`, and `audit.md`).
5. **Inputs:** links to exact files the worker must read first — **always** include [.routing/SERVICES.md](../../../.routing/SERVICES.md) and the exact `.routing/services/{name}_service.md` file(s) for this domain, plus [.routing/CONTEXT.md](../../../.routing/CONTEXT.md). *(On a revision pass, also include [audit.md](audit.md).)*
6. **Task:** numbered imperative steps (`Create`, `Implement`, `Register`, `Write tests`, `Run`). One concrete action per step.
7. **Verification:** one line pointing to [spec.md](spec.md).
8. **Change log:** instruct the worker to write/update `changelog.md` in the ticket folder listing files touched, tests run, security checks verified, and any blockers (stop and log instead of guessing).

## `spec.md`

- Deterministic yes/no checklist with exact commands and expected outputs.
- Include the applicable verification gates from [.routing/CONTEXT.md](../../../.routing/CONTEXT.md):
  - **Typecheck (mandatory):** `npm run typecheck` (`tsc --noEmit`) inside `backendnode/` exits `0` with zero errors.
  - **Build (mandatory):** `npm run build` (`tsc`) inside `backendnode/` exits `0`.
  - **Tests (two speeds):** While iterating, run only the targeted test file (`npx vitest run tests/<area>.test.ts`). Run the full suite (`npm test`) **once**, right before committing; that run is the gate (`0` failures). Every `task.md` specifies which targeted test file fits the ticket.
  - **OpenAPI 3.0.3 check:** Whenever routes or DTOs change, verify `/openapi.json` includes every new/updated route with its exact `operationId`, named component schemas, and `bearerAuth` security (unless public).
  - **Security invariants check:** List the concrete negative/security tests required for this ticket (e.g., mass-assignment fields stripped, `authorize` runs before `upload`, `401` vs `403`, magic-bytes rejection, CRLF log sanitization, `protegido` / self-edit `403`, `await req.bitacora` called).
  - **Scope check:** `git status` / `git diff --name-only` shows only files listed in `May create or edit` (plus `changelog.md`).
  - **Secrets hygiene check:** No `.env`, `*.pdf`, `*.sql`, `restclient/`, `uploads/`, or `log/log.txt` tracked in Git.
  - **Commit check (when applicable):** English Conventional Commit (`feat`, `fix`, `security`, `refactor`, `test`, `docs`, `chore`) with detailed body.

## Rules

- One ticket, one atomic deliverable.
- Route every domain ticket through `.routing/SERVICES.md` and `.routing/services/{name}_service.md`.
- Use exact paths, symbol names, HTTP statuses, and expected outputs — never "etc." or "relevant files".
- Never hand out a ticket until the user approves the draft.
