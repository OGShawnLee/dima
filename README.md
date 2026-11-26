# Dima

> Secure Programming course project — an E-Commerce / Product Catalog system built with a hardened **Node.js + TypeScript + Drizzle + OpenAPI 3.0.3** backend (`backendnode/`, single source of truth) and an **ASP.NET Core 8.0 MVC** frontend (`frontendnet/`).

---

## Documentation Routing

Start here depending on your role or what you need:

| Document | Purpose |
| :--- | :--- |
| [.routing/CONTEXT.md](.routing/CONTEXT.md) | Stack, security invariants, repo map, model policy, and verification gates |
| [.routing/DECISION.md](.routing/DECISION.md) | Architecture & Security Decision Log (deliberate improvements and deviations from baseline specs) |
| [.routing/SERVICES.md](.routing/SERVICES.md) | Backend service routing index (glossary, shared types, dependency layers, and links to `.routing/services/*_service.md`) |
| [.routing/PROGRESS.md](.routing/PROGRESS.md) | Live backend status, active tickets, security review checklist, and roadmap (readable by everyone) |
| [.routing/FRONT-HANDOFF.md](.routing/FRONT-HANDOFF.md) | Backend → Frontend contract updates and `/openapi.json` notices |
| [.routing/AUDIT-HANDOFF.md](.routing/AUDIT-HANDOFF.md) | Security Auditor → Backend & Frontend audit verdict log |
| [BACKEND-API-SPEC.md](BACKEND-API-SPEC.md) | Full backend API specification (`backendnode`) |
| [FRONTEND-API-SPEC.md](FRONTEND-API-SPEC.md) | Full frontend MVC specification (`frontendnet`) |
| [STACK-REVIEW-COMMUNICATION.md](STACK-REVIEW-COMMUNICATION.md) | Cross-stack architecture, risks, and runtime sequence diagrams |

---

## The 3 Router Roles & Entry Points

We are a 3-member team using a **Router + Worker + Security Auditor** workflow with **strict single-writer file ownership** so GitHub merges stay conflict-free. Each teammate starts a new router session using their dedicated `$skill` entry point:

| Role | Start a Session With | Recommended Model | Owns (Exclusively Writes) | Skill File |
| :--- | :--- | :--- | :--- | :--- |
| **1. Backend Router** | **`$router`** | Strong reasoning model *(dispatches workers on **Hydrogen Medium**)* | `.routing/CONTEXT.md`, `.routing/DECISION.md`, `.routing/SERVICES.md`, `.routing/services/*`, `.routing/PROGRESS.md`, `.routing/FRONT-HANDOFF.md`, `.tickets/B*/task.md` + `spec.md`, `README.md`, `AGENTS.md` *(workers write `backendnode/**` + `changelog.md`)* | [.gemini/skills/router/SKILL.md](.gemini/skills/router/SKILL.md) + [ticket/SKILL.md](.gemini/skills/ticket/SKILL.md) |
| **2. Frontend Router** | **`$frontend-router`** | Strong reasoning model | `frontendnet/**`, `frontendnet/.routing/*` (`CONTEXT.md`, `PROGRESS.md`, `BACK-HANDOFF.md`), `.tickets/F*/task.md` + `spec.md` | [.gemini/skills/frontend-router/SKILL.md](.gemini/skills/frontend-router/SKILL.md) |
| **3. Security Auditor** | **`$security-audit`** | **Gemini 4 Neon (Medium)**, **Claude Opus 5.5 (Medium/High)**, or **Sol 6.2** | `.tickets/<B\|F>*/audit.md`, `.routing/AUDIT-HANDOFF.md` (append-only) | [.gemini/skills/security-audit/SKILL.md](.gemini/skills/security-audit/SKILL.md) |

**Why single-writer ownership matters:** No two teammates ever edit the same file. Even handoffs are one-way outboxes (`FRONT-HANDOFF.md` = Backend → Frontend, `frontendnet/.routing/BACK-HANDOFF.md` = Frontend → Backend, `AUDIT-HANDOFF.md` = Auditor → All). Everyone can freely **read** `.routing/PROGRESS.md` and `frontendnet/.routing/PROGRESS.md`.

---

## Team Workflow

### 1. Ticket Naming & Structure (`.tickets/`)
Tickets are committed to Git in root `.tickets/` with non-colliding prefixes:
- **`B<NNN>-<slug>/`** — Backend tickets (e.g., `.tickets/B001-project-scaffold/`).
- **`F<NNN>-<slug>/`** — Frontend tickets (e.g., `.tickets/F001-mvc-scaffold/`).

Each ticket folder contains up to 4 single-writer files:
- `task.md` *(Router)* — scope, inputs (routed via `.routing/SERVICES.md`), steps, and `Status`.
- `spec.md` *(Router)* — deterministic build/test/security verification checklist.
- `changelog.md` *(Worker)* — files touched, test results, and fix commits.
- `audit.md` *(Security Auditor)* — security checklist, findings (`AUD-<ID>-<NN>`), and verdict.

### 2. Ticket Lifecycle (5 States)

```text
draft ──▶ dispatched ──▶ implemented ──▶ changes-requested ──┐
                              │                  ▲            │
                              │ (audit PASS)     └────────────┘ (fix & re-audit)
                              ▼
                          completed
```

1. **Plan & Draft (`draft`):** Router writes `task.md` + `spec.md` pointing to the exact `.routing/services/{name}_service.md` domain spec and confirms with the owner.
2. **Implement (`dispatched`):** Router assigns the ticket to a worker (default: **Gemini 4 Hydrogen Medium** for backend modules) in an isolated worktree.
3. **Verify (`implemented`):** Router runs typecheck, build, and automated tests locally—never trusting worker self-report—merges the work, sets status to `implemented`, and posts any frontend contract change to `.routing/FRONT-HANDOFF.md`.
4. **Security Audit (`changes-requested` or `completed`):**
   - The **Security Auditor** pulls the latest `main`, audits the `implemented` ticket against the OWASP/CWE checklist, writes `.tickets/<id>/audit.md`, and appends the verdict to `.routing/AUDIT-HANDOFF.md`.
   - **`CHANGES REQUESTED`** (any `Critical`/`High`/`Medium` finding): Owning router sets status to `changes-requested` and routes `audit.md` back to the warm worker (or a fresh worker if stale) for fixes and regression tests, then returns to `implemented` for re-audit.
   - **`PASS` / `PASS WITH NOTES`**: Owning router sets status to `completed` and updates `PROGRESS.md`.

### 3. Mandatory Pre-Commit Remote Reconciliation
Before **any** commit, merge, or push, every router must inspect and reconcile with the remote repository first:

```bash
git fetch origin
git status -sb
git log --oneline HEAD..origin/main
# If origin/main has new commits, merge/reconcile before committing or pushing
```

---

## Quick Note for Frontend Setup (`frontendnet/`)

When initializing the frontend directory, create a miniature `frontendnet/.routing/` folder containing:
- `frontendnet/.routing/CONTEXT.md` — frontend ground rules & build gates (`dotnet build`).
- `frontendnet/.routing/PROGRESS.md` — live frontend ticket status (readable by Backend & Auditor).
- `frontendnet/.routing/BACK-HANDOFF.md` — one-way outbox for API requests or integration issues directed to the Backend Router.

Use `F<NNN>-<slug>` in root `.tickets/` so the Security Auditor can audit both `B*` and `F*` tickets from one place.
