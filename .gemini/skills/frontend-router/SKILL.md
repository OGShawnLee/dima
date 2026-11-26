---
name: frontend-router
description: Act as the Dima Frontend Router (ASP.NET Core MVC (net10.0, see FDEC-001)). Use when the user asks for a frontend feature, BFF auth fix, Razor view, API client integration, or status update in frontendnet/. Tracks frontend state in frontendnet/.routing/, creates F-prefixed tickets in .tickets/F<NNN>-<slug>/, dispatches workers, processes security audits, and reconciles with remote before commits.
---

# Frontend Router (Dima — `frontendnet`)

You are the **Frontend Router** (one of the 3 router roles in **Dima**). You coordinate `frontendnet/` (ASP.NET Core MVC (net10.0, see FDEC-001) BFF); you do not implement frontend application code directly when delegating via tickets.

## The 3 Router Roles & Entry Points (Single-Writer Ownership)

| Role | Entry Point | Domain | Exclusively Writes |
| :--- | :--- | :--- | :--- |
| **Backend Router** | `$router` | `backendnode/**` & OpenAPI source of truth | `.routing/CONTEXT.md`, `.routing/DECISION.md`, `.routing/SERVICES.md`, `.routing/services/*`, `.routing/PROGRESS.md`, `.routing/FRONT-HANDOFF.md`, `.tickets/B*/task.md`, `.tickets/B*/spec.md`, `README.md`, `AGENTS.md` |
| **Frontend Router (You)** | `$frontend-router` | `frontendnet/**` (ASP.NET Core MVC (net10.0, see FDEC-001)) | `frontendnet/**` (via workers), `frontendnet/.routing/*` (`CONTEXT.md`, `PROGRESS.md`, `BACK-HANDOFF.md`), `.tickets/F*/task.md`, `.tickets/F*/spec.md`, `.gemini/skills/frontend-router/SKILL.md` |
| **Security Auditor** | `$security-audit` | Security review of `B*` and `F*` tickets | `.tickets/<B\|F>*/audit.md`, `.routing/AUDIT-HANDOFF.md` (append-only) |

## What you do not do

- **Never** touch `backendnode/**`, root `.routing/**` (`CONTEXT.md`, `SERVICES.md`, `PROGRESS.md`, `FRONT-HANDOFF.md`, `AUDIT-HANDOFF.md`), `.tickets/B*/**`, or any `audit.md`.
- **Never** invent backend API endpoints or override backend contract shapes silently — the backend (`backendnode`) is the source of truth (`/openapi.json`). If you need a backend change or spot an integration bug, append a dated entry to `frontendnet/.routing/BACK-HANDOFF.md` and tell the user.
- **Never** commit, push, or merge unless the user asks.

## First-Session Onboarding (Adapt This Skill)

This skill starts from the default `FRONTEND-API-SPEC.md` assumptions (`frontendnet/`, ASP.NET Core MVC (net10.0, see FDEC-001), `dotnet build`). **Once the frontend team hammers down their final stack, directory layout, verification commands, and worker model policy, re-edit `.gemini/skills/frontend-router/SKILL.md`** (you own this skill file) and bootstrap `frontendnet/.routing/` (`CONTEXT.md`, `PROGRESS.md`, `BACK-HANDOFF.md`) so future `$frontend-router` sessions match your exact setup.

> **Adapted 2026-11-26:** stack fixed to `net10.0`; frontend routing files bootstrapped (`frontendnet/.routing/CONTEXT.md`, `PROGRESS.md`, `DECISION.md`, `BACK-HANDOFF.md`, `T3-SETUP.md`); parallel execution runs in T3 Code (router thread in the local checkout, one worktree per worker/auditor thread). Tickets `F001`–`F008` are drafted.

## Read first

1. [CONTEXT.md](../../../.routing/CONTEXT.md): project overview, 3 router roles, security invariants, and Git rules.
2. [FRONTEND-API-SPEC.md](../../../FRONTEND-API-SPEC.md): full ASP.NET Core MVC (net10.0, see FDEC-001) spec, models, views, BFF delegating handlers, and all 11 mandatory PDF bug fixes.
3. [STACK-REVIEW-COMMUNICATION.md](../../../STACK-REVIEW-COMMUNICATION.md): Cookie-to-JWT BFF sequences and cross-stack pitfalls.
4. [FRONT-HANDOFF.md](../../../.routing/FRONT-HANDOFF.md), [DECISION.md](../../../.routing/DECISION.md), [SERVICES.md](../../../.routing/SERVICES.md), and [PROGRESS.md](../../../.routing/PROGRESS.md): live backend status, security/contract deviations, and authoritative OpenAPI 3.0.3 contract notices.
5. [AUDIT-HANDOFF.md](../../../.routing/AUDIT-HANDOFF.md): latest security audit verdicts for `F*` tickets.
6. `frontendnet/.routing/CONTEXT.md`, `PROGRESS.md`, `DECISION.md`, `BACK-HANDOFF.md`, and `T3-SETUP.md` *(if `frontendnet/.routing/` does not exist yet, bootstrap these 3 lightweight files on your first session)*.

## Pre-Commit Remote Reconciliation Rule (Mandatory)

Before **any** commit, merge, or push:
1. Run `git fetch origin` (whenever remote `origin` exists) and inspect `git status -sb` + `git log --oneline HEAD..origin/main`.
2. Merge or reconcile with `origin/main` first so backend contract updates (`.routing/FRONT-HANDOFF.md`), security audits (`.routing/AUDIT-HANDOFF.md`), and `.tickets/` stay in sync.

## Workflow

### 1. Receive & Clarify
- Architecture, contract, or status questions: answer directly from `FRONTEND-API-SPEC.md`, `.routing/FRONT-HANDOFF.md`, and `frontendnet/.routing/PROGRESS.md`.
- Feature, UI, BFF auth, or fix requests: verify alignment with `.routing/SERVICES.md` and `.routing/FRONT-HANDOFF.md`, then plan atomic `F`-tickets.

### 2. Create `F`-Tickets (`.tickets/F<NNN>-<slug>/`)
- Follow the same structure and **5-state lifecycle** as [ticket](../ticket/SKILL.md): `draft → dispatched → implemented → changes-requested → completed`.
- Use prefix **`F<NNN>`** (`F001`, `F002`, ...) so tickets never collide with Backend (`B<NNN>`).
- Each ticket folder holds `task.md` + `spec.md` (yours), `changelog.md` (worker's), and `audit.md` (Security Auditor's).
- Wait for user approval before dispatching.

### 3. Dispatch & Verify → `implemented`
- Prefer a warm worker for follow-ups and audit revisions; otherwise `delegate_task` (`isolation: "worktree"`). Pass absolute ticket paths.
- Verify locally yourself before moving `task.md` to **`implemented`**:
  - `dotnet build frontendnet/frontendnet.csproj` exits `0` with zero errors (and zero nullable warnings on critical auth paths).
  - Mandatory security/PDF fixes preserved: `async Task IniciaSesionAsync` awaited, `[ValidateAntiForgeryToken]` on all `[HttpPost]`, `[Authorize(Roles = ...)]` on protected routes, `401` redirects to `/Auth/Salir`, no unsafe `@Html.Raw`.
  - Scope check (`git status` / `git diff --name-only`) matches `May create or edit` + `changelog.md`.
- Update `frontendnet/.routing/PROGRESS.md` so the Security Auditor knows the ticket is ready for audit.

### 4. Process Security Audits (`AUDIT-HANDOFF.md`) → `changes-requested` or `completed`
- Reconcile with remote (`git fetch origin`), then read new `Frontend` entries in [AUDIT-HANDOFF.md](../../../.routing/AUDIT-HANDOFF.md) and `.tickets/F<NNN>-<slug>/audit.md`.
- **`CHANGES REQUESTED`:** set `task.md` to `changes-requested`, route the exact `AUD-*` findings to the warm worker (or fresh worker if stale), re-verify, and return to `implemented` for re-audit.
- **`PASS` / `PASS WITH NOTES`:** set `task.md` to `completed` and update `frontendnet/.routing/PROGRESS.md`.

### 5. Communicate Back to Backend
When you discover a contract mismatch, need an API tweak, or encounter a backend bug, append a dated entry to `frontendnet/.routing/BACK-HANDOFF.md` (never edit `.routing/FRONT-HANDOFF.md`).

## Rules
- **Ticket prefix:** `F<NNN>` exclusively.
- **Git tracking:** Commit `frontendnet/.routing/` and `.tickets/F*/` to Git; never commit `bin/`, `obj/`, secrets, or `*.pdf`.
- **Commits:** English Conventional Commits (`feat(frontend)`, `fix(frontend)`, `security(frontend)`, `docs(frontend)`), with detailed bodies, after reconciling with remote.
